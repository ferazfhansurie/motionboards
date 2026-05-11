import { NextRequest, NextResponse } from "next/server";
import { getSettings, createGeneration, finalizeGeneration, putFile, getFile, chargeForGeneration } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { estimateChargeForModel } from "@/lib/pricing";
import { models } from "@/lib/models";
import { submitPrompt, uploadFromUrl } from "@/lib/comfy";
import wanAnimatePoseWorkflow from "@/lib/comfy-workflows/wan-animate-pose.json";

// Synchronous providers (Segmind, Gemini image, Fish TTS, OpenAI TTS) block the
// route until the upstream returns. Nano Banana 2 at 4K runs 60–120s, and
// Seedance at 1080p gets close. 300s is Vercel Pro's per-request ceiling —
// which we're now on, so this takes effect.
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

// Parse a same-origin /api/files/:id URL and return the file id, or null if
// the URL points somewhere else (external / unrelated path).
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

function mimeKind(mime: string | null | undefined): "image" | "video" | "audio" | "other" {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "other";
}

// Fallback when Content-Type is missing / generic (R2 buckets sometimes
// store octet-stream, Veo's GCS URLs occasionally come back without the
// header). Inspect the file extension on the URL path. Returns "other"
// when we can't tell — the type checker treats "other" as "skip" rather
// than "reject," matching the original conservative behavior.
function kindFromUrlExtension(url: string): "image" | "video" | "audio" | "other" {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp|bmp|avif|tiff?|heic|heif)$/.test(path)) return "image";
    if (/\.(mp4|mov|webm|m4v|avi|mkv|3gp|ogv)$/.test(path)) return "video";
    if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)$/.test(path)) return "audio";
  } catch { /* fall through */ }
  return "other";
}

// For each file-typed input, confirm the bytes actually match the declared
// slot type (image/video/audio). Canvas lets users drag any item into any
// slot, and without this check an MP4 tagged as an image blows up deep in
// the provider's pipeline with an opaque error. Reads the stored mime from
// Neon (fast — no byte transfer) for same-origin URLs; HEAD-requests external
// URLs. Skips on any network failure — downstream branches still report.
async function validateInputTypes(
  input: Record<string, unknown>,
  modelInputs: { name: string; type: string; description: string }[],
  origin: string,
): Promise<string | null> {
  for (const inp of modelInputs) {
    if (inp.type !== "image" && inp.type !== "video" && inp.type !== "audio") continue;
    const url = input[inp.name];
    if (typeof url !== "string" || !url) continue;

    // Reject browser-only URLs immediately. The client's resolveUrl waits +
    // retries upload, but if it gives up we'd otherwise forward a blob:/data:
    // URL to the provider (Replicate, Vertex) which then fails with a
    // confusing "couldn't fetch input" error.
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      return `Input "${inp.description}" hasn't finished uploading yet. Wait a moment, then try generate again — or drag the file again if it's been more than a few seconds.`;
    }
    if (!/^https?:\/\//i.test(url)) {
      return `Input "${inp.description}" has an invalid URL. Re-upload or re-tag the file on the canvas.`;
    }

    let mime: string | null = null;
    const ownId = extractOwnFileId(url, origin);
    if (ownId) {
      const file = await getFile(ownId);
      if (!file) {
        return `Input "${inp.description}" points to a file that no longer exists. Re-upload it.`;
      }
      mime = file.mimeType;
    } else {
      // External URL — confirm Replicate/Vertex/etc. can actually fetch it.
      // We HEAD from the server (server-to-server, ignores CORS). A 404 or
      // network error here means the provider would also fail, so we'd
      // rather surface a clear message now than have it bounce back as a
      // generic "input fetch failed" 5 minutes later.
      try {
        const headRes = await fetch(url, { method: "HEAD" });
        if (!headRes.ok) {
          // Some CDNs (Vercel Blob, certain S3 configs) return 405 on HEAD
          // even though GET works. Don't reject on 405 — only on 4xx that
          // imply the resource itself is gone.
          if (headRes.status === 404 || headRes.status === 410) {
            return `Input "${inp.description}" returned ${headRes.status} — the file isn't reachable. Re-upload or re-tag.`;
          }
          // Other non-OK statuses: continue (might still be fetchable by GET).
        } else {
          mime = headRes.headers.get("content-type");
        }
      } catch {
        // Network error — let the downstream provider try; it'll surface a
        // clearer error if the URL really is dead.
      }
    }

    let actual = mimeKind(mime);
    // If Content-Type is missing or generic (octet-stream), fall back to
    // the URL extension. Without this, an image stored in R2 with no
    // explicit Content-Type sails through validation as "other" → skipped
    // → forwarded to the provider, where it fails with an opaque error.
    if (actual === "other") actual = kindFromUrlExtension(url);
    if (actual !== "other" && actual !== inp.type) {
      return `Input "${inp.description}" needs ${inp.type === "audio" ? "an audio file" : `a ${inp.type}`}, but you tagged a ${mime || actual} file. Drag a ${inp.type} onto the canvas and tag it as the ${inp.description.toLowerCase()}.`;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Auth check (cookie OR Bearer API key)
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated. Please login or pass a valid Bearer API key." }, { status: 401 });

    const body = await req.json();
    const { prompt, model: modelId, inputImage, inputImages, inputVideo, startFrame, endFrame, inputAudio, generationOptions } = body;

    const modelInfo = models.find((m) => m.id === modelId);
    if (!modelInfo) {
      return NextResponse.json(
        { error: "This model isn't available anymore. Pick another one from the model picker." },
        { status: 400 }
      );
    }
    if (modelInfo.disabled) {
      return NextResponse.json(
        { error: modelInfo.disabledReason || `${modelInfo.name} is currently unavailable.` },
        { status: 400 }
      );
    }

    // Pre-flight affordability check using the estimate (provider cost + markup).
    // Actual deduction happens AFTER the generation succeeds via chargeForGeneration.
    const creditCost = estimateChargeForModel(modelId);
    if (!user.credits || user.credits <= 0) return NextResponse.json({ error: "No credits. Please top up." }, { status: 402 });
    if (user.credits < creditCost) {
      return NextResponse.json({ error: `Insufficient credits. ${modelInfo.name} costs RM${(creditCost / 100).toFixed(2)}. You have RM${(user.credits / 100).toFixed(2)}.` }, { status: 402 });
    }

    const needsPrompt = modelInfo.inputs.some((inp) => inp.type === "text" && inp.required);
    if (needsPrompt && (!prompt || !prompt.trim())) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    // Server-side cap so non-browser callers (Bearer-token API clients) and
    // race conditions in the client char counter can't push past the model's
    // limit. Replicate's Seedance rejects prompts over 2000 chars with an
    // opaque error.
    const promptText = (typeof prompt === "string" ? prompt : "").trim();
    const cappedPrompt = modelInfo.maxPromptChars && promptText.length > modelInfo.maxPromptChars
      ? promptText.slice(0, modelInfo.maxPromptChars)
      : promptText;

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
      if (cappedPrompt) input[inp.name] = cappedPrompt;
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

    // Type-check every file input — catches the misclick where a video is
    // tagged into an image slot (or vice versa) before it reaches the provider.
    const typeErr = await validateInputTypes(input, modelInfo.inputs, req.nextUrl.origin);
    if (typeErr) {
      await finalizeGeneration(generation.id, { status: "failed", error: typeErr });
      return NextResponse.json({ error: typeErr }, { status: 400 });
    }

    // Audio-translation workflow models. Three model ids, one shared
    // pipeline: Whisper transcribes (auto-detects source language), GPT-4o-mini
    // translates the transcript to the target, OpenAI TTS synthesizes the
    // result as an MP3. No prompt input — the model id alone decides the
    // target language. Special-cased before the generic OpenAI dispatch.
    if (
      modelId === "translate-audio-english" ||
      modelId === "translate-audio-mandarin" ||
      modelId === "translate-audio-malay"
    ) {
      if (!settings.openaiApiKey) {
        await finalizeGeneration(generation.id, { status: "failed", error: "OpenAI API key not configured" });
        return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
      }
      try {
        const audioUrl = input.audio as string | undefined;
        if (!audioUrl) {
          await finalizeGeneration(generation.id, { status: "failed", error: "Missing audio input" });
          return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
        }

        // Pull the audio bytes — same-origin /api/files/* skips the public
        // round-trip via direct Neon read; external URLs fetch normally.
        let audioBytes: Buffer;
        let audioMime = "audio/mpeg";
        const ownAudioId = extractOwnFileId(audioUrl, req.nextUrl.origin);
        if (ownAudioId) {
          const file = await getFile(ownAudioId);
          if (!file) {
            await finalizeGeneration(generation.id, { status: "failed", error: "Audio not found" });
            return NextResponse.json({ error: "Audio file not found. Re-upload it." }, { status: 400 });
          }
          audioBytes = Buffer.from(file.data.buffer, file.data.byteOffset, file.data.byteLength);
          audioMime = file.mimeType || "audio/mpeg";
        } else {
          const audioRes = await fetch(audioUrl);
          if (!audioRes.ok) throw new Error(`Couldn't fetch audio (${audioRes.status})`);
          audioBytes = Buffer.from(await audioRes.arrayBuffer());
          audioMime = audioRes.headers.get("content-type") || "audio/mpeg";
        }

        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: settings.openaiApiKey });

        // Whisper file uploads need a recognisable filename extension —
        // OpenAI's SDK sniffs the extension to pick the decoder. Map mime →
        // ext defensively; anything we don't recognise falls back to mp3.
        const ext = /mp3|mpeg/i.test(audioMime) ? "mp3"
          : /wav|wave/i.test(audioMime) ? "wav"
          : /m4a|aac/i.test(audioMime) ? "m4a"
          : /ogg|opus/i.test(audioMime) ? "ogg"
          : /webm/i.test(audioMime) ? "webm"
          : /flac/i.test(audioMime) ? "flac"
          : "mp3";
        const audioFile = new File([new Uint8Array(audioBytes)], `audio.${ext}`, { type: audioMime });

        // Step 1 — Whisper transcribe. Auto-detects the source language so
        // we don't have to ask the user.
        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
        });
        const sourceText = (transcription.text || "").trim();
        if (!sourceText) {
          await finalizeGeneration(generation.id, { status: "failed", error: "No speech detected in audio" });
          return NextResponse.json({ error: "No speech detected. Make sure the audio contains spoken voice and isn't pure music or silence." }, { status: 400 });
        }

        // Step 2 — GPT-4o-mini translate. One call, two outputs: the target
        // language for TTS synthesis AND an English version for the
        // transcription text item that gets dropped beneath the audio. Single
        // round trip = lower latency + simpler accounting than two calls.
        // When the target is already English, both fields end up identical.
        const targetLanguage =
          modelId === "translate-audio-english" ? "English"
          : modelId === "translate-audio-mandarin" ? "Mandarin Chinese (Simplified)"
          : "Malay (Bahasa Malaysia)";
        const translation = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are a professional translator. Translate the user's transcribed audio text to BOTH (a) ${targetLanguage} and (b) English. Preserve tone and natural speech patterns. Output ONLY a JSON object with exactly two keys: "target" (the ${targetLanguage} translation) and "english" (the English translation). No commentary, no extra keys.`,
            },
            { role: "user", content: sourceText },
          ],
          temperature: 0.2,
        });
        const raw = translation.choices?.[0]?.message?.content || "{}";
        let translatedText = "";
        let englishText = "";
        try {
          const parsed = JSON.parse(raw) as { target?: string; english?: string };
          translatedText = (parsed.target || "").trim();
          englishText = (parsed.english || "").trim();
        } catch {
          // Defensive fallback if the JSON mode somehow misbehaves: treat
          // the raw text as the target translation, use Whisper's source
          // text as the English fallback (still meaningful if the source
          // language is already English).
          translatedText = raw.trim();
          englishText = sourceText;
        }
        if (!translatedText) throw new Error("Translation step returned empty output");
        if (!englishText) englishText = translatedText; // last-resort fallback

        // Step 3 — OpenAI TTS. "alloy" is the most multilingual default
        // voice in the tts-1 lineup; it handles English / Mandarin / Malay
        // acceptably without needing per-language voice routing.
        const speech = await openai.audio.speech.create({
          model: "tts-1",
          voice: "alloy",
          input: translatedText,
        });
        const ttsBuffer = Buffer.from(await speech.arrayBuffer());
        const outputUrl = await storeOutput(req.nextUrl.origin, ttsBuffer, "audio/mpeg", user.id);

        await chargeForGeneration({ userId: user.id, generationId: generation.id, modelId });
        await finalizeGeneration(generation.id, { status: "completed", outputUrl });
        return NextResponse.json({
          generationId: generation.id,
          status: "completed",
          outputUrl,
          transcription: englishText,
        });
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Translation failed";
        // Friendly translations for the most common failure modes.
        let msg = raw;
        if (/file.*too large|413|payload/i.test(raw)) {
          msg = "Audio file is too large. Whisper caps inputs at 25 MB — try trimming the clip first.";
        } else if (/invalid_request|format|unsupported/i.test(raw)) {
          msg = "Audio format not supported. Convert to MP3, WAV, or M4A and try again.";
        } else if (/quota|rate ?limit|429/i.test(raw)) {
          msg = "OpenAI is rate-limited right now. Wait a minute and try again.";
        }
        await finalizeGeneration(generation.id, { status: "failed", error: msg });
        return NextResponse.json({ error: msg }, { status: 500 });
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
        await finalizeGeneration(generation.id, { status: "failed", error: msg });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // OpenAI image generation (gpt-image-1 / ChatGPT Image): synchronous.
    // Routes to /v1/images/generations when no reference image, or
    // /v1/images/edits when the user tagged one as image_url.
    if (modelInfo.provider === "openai" && ["t2i", "i2i"].includes(modelInfo.type)) {
      if (!settings.openaiApiKey) {
        return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
      }
      try {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: settings.openaiApiKey });

        const requestedSize = (input.aspect_ratio as string) || "auto";
        const allowedSizes = ["auto", "1024x1024", "1024x1536", "1536x1024"];
        const size = (allowedSizes.includes(requestedSize) ? requestedSize : "auto") as "auto" | "1024x1024" | "1024x1536" | "1536x1024";
        const p = prompt?.trim() || "";
        if (!p) {
          await finalizeGeneration(generation.id, { status: "failed", error: "Prompt is required" });
          return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
        }

        const refImageUrl = input.image_url as string | undefined;
        let b64: string | undefined;
        if (refImageUrl) {
          // Edit mode: fetch the reference image and upload it as form data.
          // Pull from Neon directly for same-origin /api/files/:id URLs so we
          // don't round-trip through the public origin.
          const ownId = extractOwnFileId(refImageUrl, req.nextUrl.origin);
          let imgBytes: Buffer;
          let imgMime = "image/png";
          if (ownId) {
            const file = await getFile(ownId);
            if (!file) throw new Error("Reference image not found");
            imgBytes = Buffer.from(file.data.buffer, file.data.byteOffset, file.data.byteLength);
            imgMime = file.mimeType || "image/png";
          } else {
            const imgRes = await fetch(refImageUrl);
            if (!imgRes.ok) throw new Error(`Couldn't fetch reference image (${imgRes.status})`);
            imgBytes = Buffer.from(await imgRes.arrayBuffer());
            imgMime = imgRes.headers.get("content-type") || "image/png";
          }
          const ext = imgMime.includes("jpeg") ? "jpg" : imgMime.includes("webp") ? "webp" : "png";
          const imgFile = new File([new Uint8Array(imgBytes)], `ref.${ext}`, { type: imgMime });
          const edit = await openai.images.edit({
            model: modelId,
            image: imgFile,
            prompt: p,
            size,
            n: 1,
          });
          b64 = edit.data?.[0]?.b64_json;
        } else {
          const gen = await openai.images.generate({
            model: modelId,
            prompt: p,
            size,
            n: 1,
          });
          b64 = gen.data?.[0]?.b64_json;
        }

        if (!b64) {
          await finalizeGeneration(generation.id, { status: "failed", error: "No image returned" });
          return NextResponse.json({ error: "OpenAI returned no image." }, { status: 500 });
        }

        const buffer = Buffer.from(b64, "base64");
        const outputUrl = await storeOutput(req.nextUrl.origin, buffer, "image/png", user.id);
        await chargeForGeneration({ userId: user.id, generationId: generation.id, modelId });
        await finalizeGeneration(generation.id, { status: "completed", outputUrl });
        return NextResponse.json({ generationId: generation.id, status: "completed", outputUrl });
      } catch (oaiErr) {
        const msg = oaiErr instanceof Error ? oaiErr.message : "OpenAI image error";
        await finalizeGeneration(generation.id, { status: "failed", error: msg });
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
          await finalizeGeneration(generation.id, { status: "failed", error: (errData as Record<string, string>).error || "Generation failed" });
          return NextResponse.json({ error: (errData as Record<string, string>).error || "Segmind generation failed" }, { status: 400 });
        }
        // Response is base64 image string — store as a real file in Neon
        const b64 = await segRes.text();
        const buffer = Buffer.from(b64, "base64");
        const outputUrl = await storeOutput(req.nextUrl.origin, buffer, "image/png", user.id);
        await chargeForGeneration({ userId: user.id, generationId: generation.id, modelId });
        await finalizeGeneration(generation.id, { status: "completed", outputUrl });
        return NextResponse.json({
          generationId: generation.id,
          status: "completed",
          outputUrl,
        });
      } catch (segErr) {
        const msg = segErr instanceof Error ? segErr.message : "Segmind error";
        await finalizeGeneration(generation.id, { status: "failed", error: msg });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Gemini: image (Nano Banana 2) uses GEMINI_API_KEY directly via AI Studio.
    // Video (Veo) uses a dedicated set — GEMINI_VEO_API_KEY for AI Studio, or
    // GEMINI_VEO_PROJECT_ID + GEMINI_VEO_SERVICE_ACCOUNT_KEY for Vertex AI —
    // so Veo's quota / billing stays separate from image generation.
    if (modelInfo.provider === "gemini") {
      const isVideo = ["t2v", "i2v", "s2e"].includes(modelInfo.type);

      let apiKey: string | undefined;
      let gcpProject: string | undefined;
      let gcpServiceAccount: string | undefined;
      let useVertexAI = false;

      if (isVideo) {
        apiKey = process.env.GEMINI_VEO_API_KEY;
        gcpProject = process.env.GEMINI_VEO_PROJECT_ID;
        gcpServiceAccount = process.env.GEMINI_VEO_SERVICE_ACCOUNT_KEY;
        useVertexAI = !!(gcpProject && gcpServiceAccount);
        if (!useVertexAI && !apiKey) {
          return NextResponse.json({
            error: "Veo not configured. Set GEMINI_VEO_API_KEY (AI Studio), or GEMINI_VEO_PROJECT_ID + GEMINI_VEO_SERVICE_ACCOUNT_KEY (Vertex AI).",
          }, { status: 500 });
        }
      } else {
        apiKey = settings.geminiApiKey;
        if (!apiKey) {
          return NextResponse.json({
            error: "Gemini Image not configured. Set GEMINI_API_KEY.",
          }, { status: 500 });
        }
      }

      const gcpLocation = process.env.GOOGLE_LOCATION || "global";

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = useVertexAI
          ? new GoogleGenAI({
              vertexai: true,
              project: gcpProject,
              location: gcpLocation,
              googleAuthOptions: { credentials: JSON.parse(gcpServiceAccount!) },
            })
          : new GoogleGenAI({ apiKey });

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
          // Veo exposes a generateAudio toggle — Vertex AI only. AI Studio's
          // generateVideos endpoint rejects the field and always emits audio,
          // so we drop it on the AI Studio path.
          if (useVertexAI && modelInfo.options?.generate_audio) {
            videoConfig.generateAudio = input.generate_audio !== undefined
              ? !!input.generate_audio
              : (modelInfo.options.generate_audio.default ?? true);
          }

          // Pick a sane image mime: prefer the response header, fall back to
          // the URL extension. Vertex rejects with an opaque error when the
          // declared mime doesn't match the actual bytes — and a number of
          // R2/blob paths come back without a Content-Type header at all.
          const imageMimeFromUrl = (u: string): string => {
            const ext = kindFromUrlExtension(u);
            if (ext !== "image") return "image/png";
            const lower = u.toLowerCase();
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
            if (lower.endsWith(".webp")) return "image/webp";
            if (lower.endsWith(".gif")) return "image/gif";
            return "image/png";
          };

          // Build image input for I2V / S2E (first frame)
          let imageInput: { imageBytes: string; mimeType: string } | undefined;
          const imgUrl = (input.image_url || input.first_frame_url) as string | undefined;
          if (imgUrl) {
            const imgRes = await fetch(imgUrl);
            const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
            const headerMime = imgRes.headers.get("content-type");
            const mimeType = headerMime && headerMime.startsWith("image/") ? headerMime : imageMimeFromUrl(imgUrl);
            imageInput = { imageBytes: imgBuffer.toString("base64"), mimeType };
          }

          // Build last frame for S2E
          const lastFrameUrl = input.last_frame_url as string | undefined;
          if (lastFrameUrl) {
            const lastRes = await fetch(lastFrameUrl);
            const lastBuffer = Buffer.from(await lastRes.arrayBuffer());
            const lastHeaderMime = lastRes.headers.get("content-type");
            const lastMime = lastHeaderMime && lastHeaderMime.startsWith("image/") ? lastHeaderMime : imageMimeFromUrl(lastFrameUrl);
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
              await finalizeGeneration(generation.id, { status: "failed", error: "Image not ready" });
              return NextResponse.json({ error: "One or more images are still processing. Please wait and try again." }, { status: 400 });
            }
            const imgRes = await fetch(url);
            if (!imgRes.ok) {
              await finalizeGeneration(generation.id, { status: "failed", error: "Failed to fetch image" });
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

        // 4K Nano Banana 2 sees frequent 503 UNAVAILABLE bursts when Google's
        // GPU pool is hot. Single auto-retry after a short wait clears most.
        const callGemini = () => ai.models.generateContent({
          model: imageModelId,
          contents: contentParts,
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: Object.keys(imageConfig).length > 0 ? imageConfig : undefined,
          },
        });
        let response;
        try {
          response = await callGemini();
        } catch (firstErr) {
          const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
          if (/503|UNAVAILABLE|high demand/i.test(msg)) {
            await new Promise((r) => setTimeout(r, 8000));
            response = await callGemini();
          } else {
            throw firstErr;
          }
        }

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
          await finalizeGeneration(generation.id, { status: "failed", error: userMsg });
          return NextResponse.json({ error: userMsg }, { status: 400 });
        }

        // Store the result in Neon and return a /api/files/:id URL
        const buffer = Buffer.from(imageBase64, "base64");
        const outputUrl = await storeOutput(req.nextUrl.origin, buffer, imageMime, user.id);

        await chargeForGeneration({ userId: user.id, generationId: generation.id, modelId });
        await finalizeGeneration(generation.id, { status: "completed", outputUrl });
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
        if (/503|UNAVAILABLE|high demand/i.test(raw)) {
          // Transient capacity spike on Google's side, mostly hitting 4K.
          // The auto-retry above catches most; this fires only when both
          // attempts fail. 2K runs on a different pool and is almost
          // always available.
          const res = (input.resolution as string) || "";
          const lower4k = /4k/i.test(res) ? " Try dropping resolution to 2K — 4K hits Google's capacity ceiling first." : " Try again in a minute.";
          userMsg = "Google's image servers are busy right now." + lower4k;
          status = 503;
        } else if (/RESOURCE_EXHAUSTED|429|quota/i.test(raw)) {
          userMsg = "Image model is rate-limited right now. Wait a minute and try again.";
          status = 429;
        } else if (/SAFETY|blocked|PROHIBITED/i.test(raw)) {
          userMsg = "Blocked by content policy. Rephrase the prompt.";
          status = 400;
        } else if (/PERMISSION_DENIED|API key|credential/i.test(raw)) {
          userMsg = "Image credentials are missing or invalid. Contact the admin.";
          status = 500;
        }
        await finalizeGeneration(generation.id, { status: "failed", error: userMsg });
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
        await chargeForGeneration({ userId: user.id, generationId: generation.id, modelId });
        await finalizeGeneration(generation.id, { status: "completed", outputUrl });
        return NextResponse.json({ generationId: generation.id, status: "completed", outputUrl });
      } catch (ttsErr) {
        const msg = ttsErr instanceof Error ? ttsErr.message : "OpenAI TTS error";
        await finalizeGeneration(generation.id, { status: "failed", error: msg });
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

        await chargeForGeneration({ userId: user.id, generationId: generation.id, modelId });
        await finalizeGeneration(generation.id, { status: "completed", outputUrl });
        return NextResponse.json({
          generationId: generation.id,
          status: "completed",
          outputUrl,
        });
      } catch (fishErr) {
        const msg = fishErr instanceof Error ? fishErr.message : "Fish Audio error";
        await finalizeGeneration(generation.id, { status: "failed", error: msg });
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

        // Multi-reference (Omni) routing for Ark, mirrors the Replicate logic:
        // when more than one ref is attached (or the model has no first-frame
        // slot at all), send each as a role-tagged reference_image and skip
        // the first/last-frame parts. Single-image I2V keeps its first-frame
        // path so the output character doesn't drift.
        const arkRefImages = (input.reference_images as string[] | undefined) || [];
        const arkIsOmniOnly = !input.image_url && !input.first_frame_url && !input.last_frame_url;
        const arkUseOmni = arkRefImages.length > 0 && (arkIsOmniOnly || arkRefImages.length > 1);

        if (arkUseOmni) {
          for (const url of arkRefImages) {
            content.push({ type: "image_url", image_url: { url }, role: "reference_image" });
          }
        } else if (modelInfo.type === "s2e") {
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
          await finalizeGeneration(generation.id, { status: "failed", error: errMsg });
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
        await finalizeGeneration(generation.id, { status: "failed", error: msg });
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
        const replicateModel = modelId.replace(/\/(i2v|s2e|omni)$/, "");
        const isSfx = modelInfo.type === "sfx";
        const isImage = ["t2i", "i2i"].includes(modelInfo.type);
        // V2V / A2A share the same "forward declared file inputs 1:1" path.
        const isV2V = modelInfo.type === "v2v" || modelInfo.type === "a2a";

        const repInput: Record<string, unknown> = {
          prompt: prompt?.trim() || (isSfx ? "Generate audio" : isImage ? "Generate an image" : "Generate a video"),
        };
        // MiniMax Music, ACE-Step, and Demucs reject unknown fields like `seed`.
        const acceptsSeed =
          !replicateModel.startsWith("minimax/music") &&
          replicateModel !== "lucataco/ace-step" &&
          replicateModel !== "ryan5453/demucs";
        if (acceptsSeed) {
          repInput.seed = Math.floor(Math.random() * 2_147_483_647);
        }

        if (isImage) {
          // FLUX Schnell, etc. — aspect_ratio only (duration/resolution irrelevant)
          repInput.aspect_ratio = (input.aspect_ratio as string) || modelInfo.options?.aspect_ratio?.default || "1:1";
        } else if (isSfx) {
          // Only send `duration` to models that actually declare the option
          // — MiniMax Music / ACE-Step auto-determine length and choke if we
          // force one on them.
          if (modelInfo.options?.duration) {
            const durStr = (input.duration as string) || modelInfo.options.duration.default || "8s";
            const dur = parseInt(durStr.replace("s", ""));
            if (dur > 0) repInput.duration = dur;
          }
          if (replicateModel === "zsxkib/mmaudio" && input.video_url) {
            repInput.video = input.video_url;
          }
          // MiniMax Music: if the user wrote a "LYRICS:" block in their
          // prompt, split it out and send it verbatim via the `lyrics` field
          // (with optimizer OFF). Otherwise let the optimizer write the
          // lyrics from the natural-language description.
          if (replicateModel.startsWith("minimax/music")) {
            const promptText = (repInput.prompt as string) || "";
            const m = promptText.match(/^\s*lyrics:/im);
            if (m && m.index !== undefined) {
              const before = promptText.slice(0, m.index).trim();
              const lyricsBlock = promptText.slice(m.index).replace(/^\s*lyrics:\s*/i, "").trim();
              if (lyricsBlock) {
                repInput.prompt = before || "song";
                repInput.lyrics = lyricsBlock;
                repInput.lyrics_optimizer = false;
              } else {
                repInput.lyrics_optimizer = true;
              }
            } else {
              repInput.lyrics_optimizer = true;
            }
          }
        } else if (isV2V) {
          // Wan Animate, lip-sync models, and friends. Each model declares
          // its exact Replicate schema names in models.ts, so forward the
          // image / video / audio inputs 1:1 without renaming. Prompt is
          // optional — strip it if empty so we don't bias the model.
          if (!prompt?.trim()) delete repInput.prompt;
          // Resolution only applies to models that actually declare it
          // (Wan Animate does, lip-sync models don't).
          if (modelInfo.options?.resolution) {
            repInput.resolution = (input.resolution as string) || modelInfo.options.resolution.default || "480";
          }
          for (const inp of modelInfo.inputs) {
            if (
              (inp.type === "image" || inp.type === "video" || inp.type === "audio") &&
              input[inp.name] !== undefined
            ) {
              repInput[inp.name] = input[inp.name];
            }
          }
          // Demucs (vocal extractor): force stem=vocals so we get a single
          // clean vocals file instead of all 4 stems, and request WAV for
          // best downstream lipsync quality. Strip prompt — Demucs rejects it.
          if (replicateModel === "ryan5453/demucs") {
            repInput.stem = "vocals";
            repInput.output_format = "wav";
            delete repInput.prompt;
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

          // Kling 3.0 (kwaivgi/kling-v3.0) uses different field names than
          // Seedance / Veo. Translate before send so the canvas-side code
          // and existing per-model option declarations stay uniform:
          //   image           → start_image
          //   last_frame_image→ tail_image_url   (S2E variant; Kling 3.0 supports it on master tier)
          //   generate_audio  → (not supported, drop it)
          // If Kling renames these slots in a future tier, update here.
          if (replicateModel.startsWith("kwaivgi/kling-")) {
            if (repInput.image !== undefined) {
              repInput.start_image = repInput.image;
              delete repInput.image;
            }
            if (repInput.last_frame_image !== undefined) {
              repInput.tail_image_url = repInput.last_frame_image;
              delete repInput.last_frame_image;
            }
            delete repInput.generate_audio;
          }

          // Seedance 2.0 multi-reference (Omni) routing.
          //
          // Replicate's Seedance API treats `reference_images` as mutually
          // exclusive with the first/last-frame `image` fields. We only want
          // to flip into omni mode when the user actually wants it, i.e.:
          //   - the model is omni-only (no first-frame slot declared), OR
          //   - the user attached MORE than one reference image
          //
          // Otherwise a single-image I2V run silently switches to omni mode
          // and the character of the output changes — refs are interpreted
          // as role-tagged assets instead of a literal first frame.
          const refImages = input.reference_images as string[] | undefined;
          if (refImages && refImages.length > 0) {
            const isOmniOnly = !input.image_url && !input.first_frame_url && !input.last_frame_url;
            const isMultiRef = refImages.length > 1;
            if (isOmniOnly || isMultiRef) {
              repInput.reference_images = refImages;
              delete repInput.image;
              delete repInput.last_frame_image;
            }
          }
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
          // Replicate returns either a string "detail" or a structured error
          // object. Pull the most specific message available, then translate
          // a few common ones into plain-English toasts so users actually
          // know what to change instead of seeing a JSON blob.
          let errMsg = "Replicate submission failed";
          if (typeof predData.detail === "string") errMsg = predData.detail;
          else if (predData.detail && typeof predData.detail === "object") {
            // Validation errors are usually { detail: [{ loc, msg, type }, ...] }
            // Pull the first msg + loc so the user can tell which field is bad.
            const detailArr = predData.detail as unknown;
            if (Array.isArray(detailArr) && detailArr.length > 0) {
              const first = detailArr[0] as { loc?: string[]; msg?: string };
              const where = Array.isArray(first.loc) ? first.loc.filter((p) => p !== "body" && p !== "input").join(".") : "";
              errMsg = where ? `${first.msg || "Invalid input"} (${where})` : (first.msg || JSON.stringify(detailArr).slice(0, 240));
            } else {
              errMsg = JSON.stringify(predData.detail).slice(0, 400);
            }
          } else if (typeof predData.error === "string") errMsg = predData.error;

          // Common-case translations
          if (/no such image|model.*does not exist|404/i.test(errMsg)) {
            errMsg = `Replicate doesn't recognize the model "${replicateModel}". The provider may have renamed or removed it — please pick another model.`;
          } else if (/insufficient credit|payment required|402/i.test(errMsg)) {
            errMsg = "Replicate account is out of credit. Top up at replicate.com/account/billing.";
          } else if (/rate ?limit|429/i.test(errMsg)) {
            errMsg = "Replicate is rate-limiting us right now. Wait ~30 seconds and try again.";
          }

          console.error("[Replicate] Submission rejected", predRes.status, "model:", replicateModel, "input:", JSON.stringify(repInput).slice(0, 500), "response:", JSON.stringify(predData).slice(0, 800));
          await finalizeGeneration(generation.id, { status: "failed", error: errMsg });
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
        await finalizeGeneration(generation.id, { status: "failed", error: msg });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Comfy Cloud: async ComfyUI workflow. Upload inputs, patch the workflow
    // graph at known node IDs, submit, then poll in the status route.
    if (modelInfo.provider === "comfy") {
      if (!process.env.COMFY_CLOUD_API_KEY) {
        await finalizeGeneration(generation.id, { status: "failed", error: "Comfy Cloud API key not configured" });
        return NextResponse.json({ error: "Comfy Cloud API key not configured." }, { status: 500 });
      }
      try {
        // Pick the workflow template + node IDs for this model. Only Wan Animate
        // Character Replacement is wired today; add a switch here for additional
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
          await finalizeGeneration(generation.id, { status: "failed", error: "Unknown Comfy workflow" });
          return NextResponse.json({ error: `No Comfy workflow registered for model "${modelId}".` }, { status: 400 });
        }

        const characterImageUrl = input.character_image as string | undefined;
        const poseVideoUrl = input.video as string | undefined;
        if (!characterImageUrl || !poseVideoUrl) {
          await finalizeGeneration(generation.id, { status: "failed", error: "Missing character image or pose video" });
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
        await finalizeGeneration(generation.id, { status: "failed", error: msg });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // No matching provider
    await finalizeGeneration(generation.id, { status: "failed", error: "Provider not supported" });
    return NextResponse.json({ error: `Provider "${modelInfo.provider}" is not supported.` }, { status: 400 });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}
