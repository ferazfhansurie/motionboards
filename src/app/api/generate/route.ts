import { NextRequest, NextResponse } from "next/server";
import { getSettings, createGeneration, updateGeneration, getUserFromToken, deductCredits, putFile, getFile } from "@/lib/db";
import { models } from "@/lib/models";
import { submitPrompt, uploadFromUrl } from "@/lib/comfy";
import wanAnimatePoseWorkflow from "@/lib/comfy-workflows/wan-animate-pose.json";

// Synchronous providers (Segmind, Gemini image, Fish TTS, OpenAI TTS) block the
// route until the upstream returns. Nano Banana 2 at 4K can take 60–120s, so
// the gateway-level cap needs to clear that with margin. 300s is the Vercel Pro
// per-request limit; on Hobby this gets clamped down to 60.
export const maxDuration = 300;

// Persist a generated binary blob to Neon and return an absolute URL.
async function storeOutput(
  origin: string,
  buffer: Buffer,
  mimeType: string,
  userId: string
): Promise<string> {
  const { id } = await putFile(buffer, mimeType, userId);
  return `${origin}/api/files/${id}`;
}

// Re-encode a user-supplied image to a clean 8-bit sRGB JPEG before handing
// the URL to an external model. Wan Animate (and other OpenCV-based pipelines)
// call cv2.imread under the hood, which silently returns None for things like
// HEIC, AVIF, 16-bit PNGs, paletted PNGs, or PNGs with unusual ICC profiles.
// Downstream code then crashes with "NoneType is not subscriptable". Normalizing
// here strips every one of those sharp-edges in a single pass.
// For URLs that point at our own /api/files/:id, read the bytes directly from
// Neon rather than issuing an HTTP fetch back to the deployment. Vercel's
// platform-level routing/auth can intercept self-origin fetches and return an
// HTML shell, which is what sharp saw when it complained "unsupported image
// format" on a known-good PNG.
function extractOwnFileId(url: string, origin: string): string | null {
  try {
    const u = url.startsWith("/") ? new URL(url, origin) : new URL(url);
    const originHost = new URL(origin).host;
    if (u.host !== originHost) return null;
    const m = u.pathname.match(/^\/api\/files\/([^/?#]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function loadImageBytes(sourceUrl: string, origin: string): Promise<Buffer> {
  const ownId = extractOwnFileId(sourceUrl, origin);
  if (ownId) {
    const file = await getFile(ownId);
    if (!file) throw new Error(`file ${ownId} not found in storage`);
    return Buffer.from(file.data.buffer, file.data.byteOffset, file.data.byteLength);
  }
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`fetch ${sourceUrl} returned ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error(`fetched 0 bytes from ${sourceUrl}`);
  return buf;
}

async function normalizeImageForV2V(sourceUrl: string, origin: string, userId: string): Promise<string> {
  const inputBuf = await loadImageBytes(sourceUrl, origin);
  const sharp = (await import("sharp")).default;
  const normalized = await sharp(inputBuf, { failOn: "none" })
    .rotate() // honor EXIF orientation so the model sees the image upright
    .flatten({ background: "#000000" }) // drop alpha so RGBA → RGB
    .toColorspace("srgb")
    .jpeg({ quality: 92 })
    .toBuffer();
  const { id } = await putFile(normalized, "image/jpeg", userId);
  return `${origin}/api/files/${id}`;
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated. Please login." }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });

    const body = await req.json();
    const { prompt, model: modelId, inputImage, inputImages, inputVideo, startFrame, endFrame, inputAudio, generationOptions } = body;

    const modelInfo = models.find((m) => m.id === modelId);
    if (!modelInfo) return NextResponse.json({ error: "Invalid model" }, { status: 400 });

    // Check credits
    const creditCost = modelInfo.creditCost;
    if (!user.credits || user.credits <= 0) return NextResponse.json({ error: "No credits. Please top up." }, { status: 402 });
    if (user.credits < creditCost) {
      return NextResponse.json({ error: `Insufficient credits. ${modelInfo.name} costs RM${(creditCost / 100).toFixed(2)}. You have RM${(user.credits / 100).toFixed(2)}.` }, { status: 402 });
    }

    const needsPrompt = modelInfo.inputs.some((inp) => inp.type === "text" && inp.required);
    if (needsPrompt && (!prompt || !prompt.trim())) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    const settings = getSettings();

    // Build input
    const input: Record<string, unknown> = {};

    // Generation options
    if (generationOptions && typeof generationOptions === "object") {
      for (const [key, value] of Object.entries(generationOptions)) {
        if (value !== undefined && value !== null && value !== "") input[key] = value;
      }
    }

    // Map inputs based on model definition
    const imageInputs = modelInfo.inputs.filter((i) => i.type === "image");
    const videoInputs = modelInfo.inputs.filter((i) => i.type === "video");
    const audioInputs = modelInfo.inputs.filter((i) => i.type === "audio");
    const textInputs = modelInfo.inputs.filter((i) => i.type === "text");
    const allImages = Array.isArray(inputImages) ? inputImages as string[] : [];

    for (const inp of textInputs) {
      if (prompt && prompt.trim()) input[inp.name] = prompt.trim();
    }

    if (modelInfo.type === "s2e") {
      for (const inp of imageInputs) {
        const n = inp.name.toLowerCase();
        if (n.includes("first") || n.includes("start")) { if (startFrame) input[inp.name] = startFrame; }
        else if (n.includes("last") || n.includes("end")) { if (endFrame) input[inp.name] = endFrame; }
        else if (inputImage) input[inp.name] = inputImage;
      }
    } else {
      for (let idx = 0; idx < imageInputs.length; idx++) {
        const inp = imageInputs[idx];
        if (inp.name.endsWith("_urls") || inp.name.endsWith("_images")) {
          const urls = allImages.length > 0 ? allImages : (inputImage ? [inputImage] : []);
          if (urls.length > 0) input[inp.name] = urls;
        } else if (inp.name.toLowerCase().includes("end") || inp.name.toLowerCase().includes("last")) {
          if (endFrame) input[inp.name] = endFrame;
        } else {
          const src = allImages[idx] || (idx === 0 ? inputImage : null);
          if (src) input[inp.name] = src;
        }
      }
    }

    // Video inputs — pull from the dedicated inputVideo slot; fall back to
    // inputImage only for legacy SFX/mmaudio flows that sometimes pass the
    // same item through both channels.
    for (const inp of videoInputs) {
      if (inputVideo) input[inp.name] = inputVideo;
      else if (inputImage && modelInfo.type === "sfx") input[inp.name] = inputImage;
    }
    for (const inp of audioInputs) { if (inputAudio) input[inp.name] = inputAudio; }

    // Create generation record
    const generation = await createGeneration({
      prompt: prompt || "",
      model: modelId,
      provider: modelInfo.provider,
      mode: modelInfo.type,
      status: "processing",
      inputImage: inputImage ? "uploaded" : null,
      userId: user.id,
      creditCost,
    });

    // Validate required inputs before submitting
    for (const inp of modelInfo.inputs) {
      if (inp.required && !input[inp.name]) {
        return NextResponse.json({ error: `Missing required input: ${inp.description}. Please set it as a reference on the canvas.` }, { status: 400 });
      }
    }

    // OpenAI Sora: async video generation via openai.videos.create
    if (modelInfo.provider === "openai" && ["t2v", "i2v", "s2e"].includes(modelInfo.type)) {
      if (!settings.openaiApiKey) {
        return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
      }
      try {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: settings.openaiApiKey });

        // Map aspect_ratio + model type to OpenAI size
        const ar = (input.aspect_ratio as string) || "16:9";
        const size = ar === "9:16" ? "720x1280" : "1280x720";

        // Parse duration — OpenAI SDK expects string VideoSeconds: '4' | '8' | '12'
        const durStr = (input.duration as string) || "8s";
        const seconds = durStr.replace("s", "") as "4" | "8" | "12";

        // Strip /i2v suffix to get the raw model name
        const openaiModel = modelId.replace(/\/i2v$/, "") as "sora-2" | "sora-2-pro";

        // I2V: pass reference image
        const imageUrl = input.image_url as string | undefined;

        const video = await openai.videos.create({
          model: openaiModel,
          prompt: prompt?.trim() || "Generate a video",
          seconds,
          size: size as "720x1280" | "1280x720",
          ...(imageUrl ? { input_reference: { image_url: imageUrl } } : {}),
        });

        return NextResponse.json({
          generationId: generation.id,
          requestId: video.id,
          modelId,
          status: "processing",
          openaiVideo: true,
        });
      } catch (oaiErr) {
        const msg = oaiErr instanceof Error ? oaiErr.message : "OpenAI API error";
        await updateGeneration(generation.id, { status: "failed", error: msg, duration: 0 });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Segmind: synchronous API — call directly and return result
    if (modelInfo.provider === "segmind") {
      if (!settings.segmindApiKey) {
        return NextResponse.json({ error: "Segmind API key not configured." }, { status: 500 });
      }
      try {
        const segRes = await fetch(`https://api.segmind.com/v1/${modelId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": settings.segmindApiKey },
          body: JSON.stringify({ ...input, base64: true }),
        });
        if (!segRes.ok) {
          const errData = await segRes.json().catch(() => ({ error: "Segmind API error" }));
          await updateGeneration(generation.id, { status: "failed", error: (errData as Record<string, string>).error || "Generation failed", duration: 0 });
          return NextResponse.json({ error: (errData as Record<string, string>).error || "Segmind generation failed" }, { status: 400 });
        }
        // Response is base64 image string — store as a real file in Neon
        const b64 = await segRes.text();
        const buffer = Buffer.from(b64, "base64");
        const outputUrl = await storeOutput(req.nextUrl.origin, buffer, "image/png", user.id);
        await deductCredits(user.id, creditCost);
        await updateGeneration(generation.id, { status: "completed", outputUrl, duration: 0 });
        return NextResponse.json({
          generationId: generation.id,
          status: "completed",
          outputUrl,
        });
      } catch (segErr) {
        const msg = segErr instanceof Error ? segErr.message : "Segmind error";
        await updateGeneration(generation.id, { status: "failed", error: msg, duration: 0 });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Gemini: prefer Vertex AI (direct Google Cloud, service-account auth) for
    // both video and images when the GCP env vars are set. Falls back to the
    // AI Studio API key if only that's configured.
    if (modelInfo.provider === "gemini") {
      const gcpProject = process.env.GOOGLE_PROJECT_ID;
      const gcpServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const hasVertexAI = !!(gcpProject && gcpServiceAccount);
      const isVideo = ["t2v", "i2v", "s2e"].includes(modelInfo.type);
      // Vertex AI for everything when it's available; otherwise fall back to the API key
      const useVertexAI = hasVertexAI;
      const gcpLocation = process.env.GOOGLE_LOCATION || "global";

      if (!useVertexAI && !settings.geminiApiKey) {
        return NextResponse.json({
          error: "Google API not configured. Set GOOGLE_PROJECT_ID + GOOGLE_SERVICE_ACCOUNT_KEY for Vertex AI, or a GEMINI_API_KEY for AI Studio.",
        }, { status: 500 });
      }
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = useVertexAI
          ? new GoogleGenAI({
              vertexai: true,
              project: gcpProject,
              location: gcpLocation,
              googleAuthOptions: { credentials: JSON.parse(gcpServiceAccount!) },
            })
          : new GoogleGenAI({ apiKey: settings.geminiApiKey });

        if (isVideo) {
          // --- Gemini Video Generation (async long-running operation) ---
          const videoConfig: Record<string, unknown> = {};
          // Fall back to model defaults if user didn't explicitly set an option
          const ar = (input.aspect_ratio as string) || modelInfo.options?.aspect_ratio?.default;
          if (ar && ar !== "auto") videoConfig.aspectRatio = ar;
          const res = (input.resolution as string) || modelInfo.options?.resolution?.default;
          if (res) videoConfig.resolution = res;
          const dur = (input.duration as string) || modelInfo.options?.duration?.default;
          if (dur) videoConfig.durationSeconds = parseInt(dur.toString().replace("s", ""));
          // Veo exposes a generateAudio toggle — defaults to true when the
          // model declares the option, but the user can turn it off to get a
          // silent clip (and occasionally bypass flakey audio-path failures).
          if (modelInfo.options?.generate_audio) {
            videoConfig.generateAudio = input.generate_audio !== undefined
              ? !!input.generate_audio
              : (modelInfo.options.generate_audio.default ?? true);
          }

          // Build image input for I2V / S2E (first frame)
          let imageInput: { imageBytes: string; mimeType: string } | undefined;
          const imgUrl = (input.image_url || input.first_frame_url) as string | undefined;
          if (imgUrl) {
            const imgRes = await fetch(imgUrl);
            const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
            const mimeType = imgRes.headers.get("content-type") || "image/png";
            imageInput = { imageBytes: imgBuffer.toString("base64"), mimeType };
          }

          // Build last frame for S2E
          const lastFrameUrl = input.last_frame_url as string | undefined;
          if (lastFrameUrl) {
            const lastRes = await fetch(lastFrameUrl);
            const lastBuffer = Buffer.from(await lastRes.arrayBuffer());
            const lastMime = lastRes.headers.get("content-type") || "image/png";
            videoConfig.lastFrame = { imageBytes: lastBuffer.toString("base64"), mimeType: lastMime };
          }

          // Strip /i2v, /s2e suffixes — Gemini uses same model for all modes.
          // Vertex AI uses -001 suffix; AI Studio uses -preview suffix.
          let geminiModelId = modelId.replace(/\/(i2v|s2e)$/, "");
          // Vertex AI uses -001 suffix, AI Studio uses -preview (dots stay the same)
          if (useVertexAI) geminiModelId = geminiModelId.replace(/-preview$/, "-001");

          const operation = await ai.models.generateVideos({
            model: geminiModelId,
            prompt: prompt?.trim() || "Generate a video",
            image: imageInput,
            config: videoConfig as Parameters<typeof ai.models.generateVideos>[0]["config"],
          });
          const opName = operation.name;

          return NextResponse.json({
            generationId: generation.id,
            requestId: opName,
            modelId,
            status: "processing",
            geminiVideo: true,
          });
        }

        // --- Gemini Image Generation (synchronous) ---
        const imageConfig: Record<string, string> = {};
        if (input.aspect_ratio && input.aspect_ratio !== "auto") {
          imageConfig.aspectRatio = input.aspect_ratio as string;
        }
        if (input.resolution) {
          imageConfig.imageSize = input.resolution as string;
        }

        // Build contents: text prompt + optional image inputs for editing
        const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
        contentParts.push({ text: prompt?.trim() || "Generate an image" });

        // Support multiple images via image_urls array
        const imageUrls = input.image_urls as string[] | undefined;
        if (imageUrls && imageUrls.length > 0) {
          for (const url of imageUrls) {
            if (!url || url.startsWith("blob:")) {
              await updateGeneration(generation.id, { status: "failed", error: "Image not ready", duration: 0 });
              return NextResponse.json({ error: "One or more images are still processing. Please wait and try again." }, { status: 400 });
            }
            const imgRes = await fetch(url);
            if (!imgRes.ok) {
              await updateGeneration(generation.id, { status: "failed", error: "Failed to fetch image", duration: 0 });
              return NextResponse.json({ error: "Failed to fetch input image. Try refreshing the page." }, { status: 400 });
            }
            const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
            const mimeType = imgRes.headers.get("content-type") || "image/png";
            contentParts.push({ inlineData: { mimeType, data: imgBuffer.toString("base64") } });
          }
        }

        // Vertex AI uses -001 suffix; AI Studio uses -preview suffix
        // Gemini image models use the same ID on both AI Studio and Vertex AI
        const imageModelId = modelId;

        const response = await ai.models.generateContent({
          model: imageModelId,
          contents: contentParts,
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: Object.keys(imageConfig).length > 0 ? imageConfig : undefined,
          },
        });

        const parts = response.candidates?.[0]?.content?.parts;
        let imageBase64: string | null = null;
        let imageMime = "image/png";
        if (parts) {
          for (const part of parts) {
            if ((part as Record<string, unknown>).inlineData) {
              const inlineData = (part as Record<string, unknown>).inlineData as { data: string; mimeType: string };
              imageBase64 = inlineData.data;
              imageMime = inlineData.mimeType || "image/png";
              break;
            }
          }
        }

        if (!imageBase64) {
          // Gemini accepted the call but returned no image. Usually this means
          // the content filter silently rejected the prompt or the reference
          // image. Pull the finishReason / promptFeedback so we can give the
          // user an actionable message instead of "returned no image".
          const cand = response.candidates?.[0] as Record<string, unknown> | undefined;
          const finishReason = (cand?.finishReason as string | undefined) || "";
          const feedback = (response as unknown as { promptFeedback?: { blockReason?: string } }).promptFeedback;
          const blockReason = feedback?.blockReason || "";
          let userMsg = "No image came back. Try again.";
          if (finishReason === "SAFETY" || blockReason || finishReason === "PROHIBITED_CONTENT") {
            userMsg = "Blocked by content policy. Rephrase the prompt or change the reference images.";
          } else if (finishReason === "RECITATION") {
            userMsg = "Blocked by content policy (too close to copyrighted material). Try a more original prompt.";
          } else if (finishReason) {
            userMsg = "Blocked by content policy. Rephrase the prompt.";
          }
          await updateGeneration(generation.id, { status: "failed", error: userMsg, duration: 0 });
          return NextResponse.json({ error: userMsg }, { status: 400 });
        }

        // Store the result in Neon and return a /api/files/:id URL
        const buffer = Buffer.from(imageBase64, "base64");
        const outputUrl = await storeOutput(req.nextUrl.origin, buffer, imageMime, user.id);

        await deductCredits(user.id, creditCost);
        await updateGeneration(generation.id, { status: "completed", outputUrl, duration: 0 });
        return NextResponse.json({
          generationId: generation.id,
          status: "completed",
          outputUrl,
        });
      } catch (gemErr) {
        const raw = gemErr instanceof Error ? gemErr.message : "Gemini API error";
        // Translate common Google API errors into actionable copy.
        let userMsg = raw;
        let status = 500;
        if (/RESOURCE_EXHAUSTED|429|quota/i.test(raw)) {
          userMsg = "Image model is rate-limited right now. Wait a minute and try again.";
          status = 429;
        } else if (/SAFETY|blocked|PROHIBITED/i.test(raw)) {
          userMsg = "Blocked by content policy. Rephrase the prompt.";
          status = 400;
        } else if (/PERMISSION_DENIED|API key|credential/i.test(raw)) {
          userMsg = "Image credentials are missing or invalid. Contact the admin.";
          status = 500;
        }
        await updateGeneration(generation.id, { status: "failed", error: userMsg, duration: 0 });
        return NextResponse.json({ error: userMsg }, { status });
      }
    }

    // OpenAI: handles both Sora (async, existing) AND TTS (synchronous, new)
    if (modelInfo.provider === "openai" && modelInfo.type === "audio") {
      if (!settings.openaiApiKey) {
        return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
      }
      try {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: settings.openaiApiKey });
        // aspect_ratio option is reused to carry the voice name (UI constraint)
        const voice = (input.aspect_ratio as string) || "alloy";
        const text = (input.text as string) || prompt || "";
        if (!text.trim()) {
          return NextResponse.json({ error: "Text is required for TTS." }, { status: 400 });
        }
        const speech = await openai.audio.speech.create({
          model: modelId, // "tts-1" or "tts-1-hd"
          voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
          input: text,
        });
        const buffer = Buffer.from(await speech.arrayBuffer());
        const outputUrl = await storeOutput(req.nextUrl.origin, buffer, "audio/mpeg", user.id);
        await deductCredits(user.id, creditCost);
        await updateGeneration(generation.id, { status: "completed", outputUrl, duration: 0 });
        return NextResponse.json({ generationId: generation.id, status: "completed", outputUrl });
      } catch (ttsErr) {
        const msg = ttsErr instanceof Error ? ttsErr.message : "OpenAI TTS error";
        await updateGeneration(generation.id, { status: "failed", error: msg, duration: 0 });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Fish Audio: voice clone + TTS in one synchronous flow
    if (modelInfo.provider === "fish") {
      if (!settings.fishApiKey) {
        return NextResponse.json({ error: "Fish Audio API key not configured." }, { status: 500 });
      }
      try {
        const audioUrl = input.audio_url as string;
        const text = input.text as string;
        if (!audioUrl || !text) {
          return NextResponse.json({ error: "Text and audio reference are required." }, { status: 400 });
        }

        // Step 1: Clone voice — upload audio to create a model
        const audioRes = await fetch(audioUrl);
        const audioBlob = await audioRes.blob();
        const cloneForm = new FormData();
        cloneForm.append("type", "tts");
        cloneForm.append("title", `clone_${Date.now()}`);
        cloneForm.append("train_mode", "fast");
        cloneForm.append("visibility", "private");
        cloneForm.append("voices", new File([audioBlob], "voice.mp3", { type: audioBlob.type || "audio/mpeg" }));

        const cloneRes = await fetch("https://api.fish.audio/model", {
          method: "POST",
          headers: { "Authorization": `Bearer ${settings.fishApiKey}` },
          body: cloneForm,
        });
        if (!cloneRes.ok) {
          const err = await cloneRes.text();
          throw new Error(`Voice clone failed: ${err}`);
        }
        const cloneData = await cloneRes.json() as Record<string, unknown>;
        const voiceId = cloneData._id as string;

        // Step 2: Generate TTS with cloned voice
        const ttsRes = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${settings.fishApiKey}`,
            "Content-Type": "application/json",
            "model": "s2-pro",
          },
          body: JSON.stringify({
            text,
            reference_id: voiceId,
            format: "mp3",
          }),
        });
        if (!ttsRes.ok) {
          const err = await ttsRes.text();
          throw new Error(`TTS failed: ${err}`);
        }

        // Store the TTS audio in Neon and return a /api/files/:id URL
        const ttsBuffer = Buffer.from(await ttsRes.arrayBuffer());
        const outputUrl = await storeOutput(req.nextUrl.origin, ttsBuffer, "audio/mpeg", user.id);

        // Cleanup: delete the temporary voice model
        fetch(`https://api.fish.audio/model/${voiceId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${settings.fishApiKey}` },
        }).catch(() => {});

        await deductCredits(user.id, creditCost);
        await updateGeneration(generation.id, { status: "completed", outputUrl, duration: 0 });
        return NextResponse.json({
          generationId: generation.id,
          status: "completed",
          outputUrl,
        });
      } catch (fishErr) {
        const msg = fishErr instanceof Error ? fishErr.message : "Fish Audio error";
        await updateGeneration(generation.id, { status: "failed", error: msg, duration: 0 });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // ByteDance ModelArk (Seedance 2.0). Async task — POST to create, poll in
    // the status route. The model id already contains any /i2v or /s2e suffix
    // we added for UI routing, so strip it before sending to Ark.
    if (modelInfo.provider === "byteplus") {
      if (!settings.arkApiKey) {
        return NextResponse.json({ error: "ByteDance Ark API key not configured." }, { status: 500 });
      }
      try {
        const arkModel = modelId.replace(/\/(i2v|s2e)$/, "");

        // ModelArk's /contents/generations/tasks takes a `content` array of
        // role-tagged parts: a text prompt, plus image_url entries where the
        // role decides whether it's a first frame, last frame, or reference.
        type ContentPart =
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string }; role?: string };
        const content: ContentPart[] = [];

        const text = prompt?.trim();
        if (text) content.push({ type: "text", text });

        if (modelInfo.type === "s2e") {
          if (input.first_frame_url) {
            content.push({ type: "image_url", image_url: { url: input.first_frame_url as string }, role: "first_frame" });
          }
          if (input.last_frame_url) {
            content.push({ type: "image_url", image_url: { url: input.last_frame_url as string }, role: "last_frame" });
          }
        } else if (modelInfo.type === "i2v") {
          const imgUrl = (input.image_url as string | undefined);
          if (imgUrl) {
            content.push({ type: "image_url", image_url: { url: imgUrl } });
          }
        }

        // Map option fields to the names Ark expects — they use `ratio` not
        // aspect_ratio, and accept duration as an integer (seconds).
        const durStr = (input.duration as string) || modelInfo.options?.duration?.default || "5s";
        const durSeconds = Math.max(4, Math.min(15, parseInt(durStr.replace("s", "")) || 5));
        const resolution = (input.resolution as string) || modelInfo.options?.resolution?.default || "720p";
        const ratio = (input.aspect_ratio as string) || modelInfo.options?.aspect_ratio?.default || "16:9";
        const genAudio = input.generate_audio !== undefined
          ? !!input.generate_audio
          : (modelInfo.options?.generate_audio?.default ?? true);

        const arkBody: Record<string, unknown> = {
          model: arkModel,
          content,
          ratio,
          resolution,
          duration: durSeconds,
          watermark: false,
        };
        // Audio gen is only valid on i2v / s2e / t2v for Seedance 2 — we pass
        // the boolean through always since the model accepts it everywhere.
        arkBody.generate_audio = genAudio;

        console.log("[ByteplusArk] Submitting", arkModel, JSON.stringify(arkBody).slice(0, 500));

        const createRes = await fetch(
          "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${settings.arkApiKey}`,
            },
            body: JSON.stringify(arkBody),
          }
        );
        const createData = await createRes.json() as Record<string, unknown>;
        if (!createRes.ok) {
          // Ark surfaces errors either as { error: { message } } or a plain
          // { message } depending on tier. Normalize.
          const errObj = (createData.error as Record<string, unknown>) || createData;
          const errMsg = (errObj.message as string) || (errObj.code as string) || "ByteDance Ark submission failed";
          console.error("[ByteplusArk] Submission rejected", createRes.status, JSON.stringify(createData).slice(0, 500));
          await updateGeneration(generation.id, { status: "failed", error: errMsg, duration: 0 });
          return NextResponse.json({ error: errMsg }, { status: 400 });
        }

        return NextResponse.json({
          generationId: generation.id,
          requestId: createData.id as string,
          modelId,
          status: "processing",
          byteplusVideo: true,
        });
      } catch (arkErr) {
        const msg = arkErr instanceof Error ? arkErr.message : "ByteDance Ark error";
        await updateGeneration(generation.id, { status: "failed", error: msg, duration: 0 });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Replicate: async prediction — POST to create, poll in status route
    if (modelInfo.provider === "replicate") {
      if (!settings.replicateApiKey) {
        return NextResponse.json({ error: "Replicate API key not configured." }, { status: 500 });
      }
      try {
        // Strip /i2v or /s2e suffixes to get the Replicate model slug
        const replicateModel = modelId.replace(/\/(i2v|s2e)$/, "");
        const isSfx = modelInfo.type === "sfx";
        const isImage = ["t2i", "i2i"].includes(modelInfo.type);
        const isV2V = modelInfo.type === "v2v";

        const repInput: Record<string, unknown> = {
          prompt: prompt?.trim() || (isSfx ? "Generate audio" : isImage ? "Generate an image" : "Generate a video"),
          seed: Math.floor(Math.random() * 2_147_483_647),
        };

        if (isImage) {
          // FLUX Schnell, etc. — aspect_ratio only (duration/resolution irrelevant)
          repInput.aspect_ratio = (input.aspect_ratio as string) || modelInfo.options?.aspect_ratio?.default || "1:1";
        } else if (isSfx) {
          // MMAudio can take a video reference; Stable Audio is text-only.
          const durStr = (input.duration as string) || modelInfo.options?.duration?.default || "8s";
          const dur = parseInt(durStr.replace("s", ""));
          if (dur > 0) repInput.duration = dur;
          if (replicateModel === "zsxkib/mmaudio" && input.video_url) {
            repInput.video = input.video_url;
          }
        } else if (isV2V) {
          // Wan Animate and friends: each model declares its exact Replicate
          // schema names in models.ts (e.g. `character_image`), so forward
          // image + video inputs 1:1 without renaming. Prompt is optional —
          // strip it if empty so we don't bias the model.
          if (!prompt?.trim()) delete repInput.prompt;
          repInput.resolution = (input.resolution as string) || modelInfo.options?.resolution?.default || "480";

          // Normalize every image input first so the model's cv2.imread can't
          // choke on an unusual PNG/HEIC/etc. Do this sequentially instead of
          // in parallel — usually there's only one image, and keeping it serial
          // makes the error surface point at the specific input that failed.
          for (const inp of modelInfo.inputs) {
            if (inp.type === "image" && typeof input[inp.name] === "string") {
              try {
                input[inp.name] = await normalizeImageForV2V(input[inp.name] as string, req.nextUrl.origin, user.id);
              } catch (normErr) {
                const msg = normErr instanceof Error ? normErr.message : "Image normalize failed";
                console.error(`[V2V normalize] ${inp.name} failed:`, normErr);
                await updateGeneration(generation.id, { status: "failed", error: `Could not prepare input "${inp.name}": ${msg}`, duration: 0 });
                return NextResponse.json({ error: `Could not prepare input "${inp.name}": ${msg}` }, { status: 400 });
              }
            }
          }

          for (const inp of modelInfo.inputs) {
            if ((inp.type === "image" || inp.type === "video") && input[inp.name] !== undefined) {
              repInput[inp.name] = input[inp.name];
            }
          }
        } else {
          // Video pipeline (Seedance 1.x, Seedance 2.x, and similar Replicate
          // video models). Field names are aspect_ratio / resolution /
          // duration / generate_audio / image / last_frame_image across the
          // board.
          repInput.aspect_ratio = (input.aspect_ratio as string) || modelInfo.options?.aspect_ratio?.default || "16:9";
          repInput.resolution = (input.resolution as string) || modelInfo.options?.resolution?.default || "720p";
          const durStr = (input.duration as string) || modelInfo.options?.duration?.default || "5s";
          const dur = parseInt(durStr.replace("s", ""));
          if (dur > 0) repInput.duration = dur;
          if (modelInfo.options?.generate_audio) {
            repInput.generate_audio = input.generate_audio !== undefined ? !!input.generate_audio : (modelInfo.options.generate_audio.default ?? true);
          }

          const imageUrl = input.image_url as string | undefined;
          if (imageUrl) repInput.image = imageUrl;
          if (input.first_frame_url) repInput.image = input.first_frame_url;
          if (input.last_frame_url) repInput.last_frame_image = input.last_frame_url;
        }

        // Log the exact payload so we can diagnose content-filter rejections
        console.log("[Replicate] Submitting", replicateModel, JSON.stringify(repInput).slice(0, 500));

        const predRes = await fetch(`https://api.replicate.com/v1/models/${replicateModel}/predictions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${settings.replicateApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: repInput }),
        });
        const predData = await predRes.json() as Record<string, unknown>;
        if (!predRes.ok) {
          // Replicate returns either a string "detail" or a structured error object
          let errMsg = "Replicate submission failed";
          if (typeof predData.detail === "string") errMsg = predData.detail;
          else if (predData.detail && typeof predData.detail === "object") errMsg = JSON.stringify(predData.detail);
          else if (typeof predData.error === "string") errMsg = predData.error;
          console.error("[Replicate] Submission rejected", predRes.status, JSON.stringify(predData).slice(0, 500));
          await updateGeneration(generation.id, { status: "failed", error: errMsg, duration: 0 });
          return NextResponse.json({ error: errMsg }, { status: 400 });
        }

        return NextResponse.json({
          generationId: generation.id,
          requestId: predData.id as string,
          modelId,
          status: "processing",
          replicateVideo: true,
        });
      } catch (repErr) {
        const msg = repErr instanceof Error ? repErr.message : "Replicate error";
        await updateGeneration(generation.id, { status: "failed", error: msg, duration: 0 });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Comfy Cloud: async ComfyUI workflow. Upload inputs, patch the workflow
    // graph at known node IDs, submit, then poll in the status route.
    if (modelInfo.provider === "comfy") {
      if (!process.env.COMFY_CLOUD_API_KEY) {
        await updateGeneration(generation.id, { status: "failed", error: "Comfy Cloud API key not configured", duration: 0 });
        return NextResponse.json({ error: "Comfy Cloud API key not configured." }, { status: 500 });
      }
      try {
        // Pick the workflow template + node IDs for this model. Only Wan Animate
        // Pose-to-Character is wired today; add a switch here for additional
        // Comfy workflows later.
        let workflowTemplate: Record<string, unknown>;
        let imageNodeId: string;
        let videoNodeId: string;
        let promptNodeId: string | null;
        if (modelId === "comfy/wan-animate-pose") {
          workflowTemplate = wanAnimatePoseWorkflow as Record<string, unknown>;
          imageNodeId = "479";
          videoNodeId = "420";
          promptNodeId = null; // this workflow doesn't surface a caption slot
        } else {
          await updateGeneration(generation.id, { status: "failed", error: "Unknown Comfy workflow", duration: 0 });
          return NextResponse.json({ error: `No Comfy workflow registered for model "${modelId}".` }, { status: 400 });
        }

        const characterImageUrl = input.character_image as string | undefined;
        const poseVideoUrl = input.video as string | undefined;
        if (!characterImageUrl || !poseVideoUrl) {
          await updateGeneration(generation.id, { status: "failed", error: "Missing character image or pose video", duration: 0 });
          return NextResponse.json({ error: "Both a character image and a pose reference video are required." }, { status: 400 });
        }

        const [characterUpload, poseUpload] = await Promise.all([
          uploadFromUrl(characterImageUrl, `character_${generation.id}.png`),
          uploadFromUrl(poseVideoUrl, `pose_${generation.id}.mp4`),
        ]);

        // Deep clone so concurrent generations don't stomp on each other.
        const workflow = JSON.parse(JSON.stringify(workflowTemplate)) as Record<string, { inputs: Record<string, unknown> }>;
        if (workflow[imageNodeId]) workflow[imageNodeId].inputs.image = characterUpload.name;
        if (workflow[videoNodeId]) workflow[videoNodeId].inputs.file = poseUpload.name;
        if (promptNodeId && workflow[promptNodeId] && prompt?.trim()) {
          workflow[promptNodeId].inputs.text = prompt.trim();
        }

        const promptId = await submitPrompt(workflow);
        return NextResponse.json({
          generationId: generation.id,
          requestId: promptId,
          modelId,
          status: "processing",
          comfyVideo: true,
        });
      } catch (comfyErr) {
        const msg = comfyErr instanceof Error ? comfyErr.message : "Comfy Cloud error";
        await updateGeneration(generation.id, { status: "failed", error: msg, duration: 0 });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // No matching provider
    await updateGeneration(generation.id, { status: "failed", error: "Provider not supported", duration: 0 });
    return NextResponse.json({ error: `Provider "${modelInfo.provider}" is not supported.` }, { status: 400 });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}
