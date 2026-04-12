import { NextRequest, NextResponse } from "next/server";
import { getSettings, createGeneration, updateGeneration, getUserFromToken, deductCredits, putFile } from "@/lib/db";
import { models } from "@/lib/models";

export const maxDuration = 60; // Segmind calls are synchronous, need more time

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

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated. Please login." }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });

    const body = await req.json();
    const { prompt, model: modelId, inputImage, inputImages, startFrame, endFrame, inputAudio, generationOptions } = body;

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

    for (const inp of videoInputs) { if (inputImage) input[inp.name] = inputImage; }
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
    if (modelInfo.provider === "openai") {
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

    // Gemini: direct Google API call
    if (modelInfo.provider === "gemini") {
      if (!settings.geminiApiKey) {
        return NextResponse.json({ error: "Google Gemini API key not configured." }, { status: 500 });
      }
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });

        const isVideo = ["t2v", "i2v", "s2e"].includes(modelInfo.type);

        if (isVideo) {
          // --- Gemini Video Generation (async long-running operation) ---
          const videoConfig: Record<string, unknown> = {};
          if (input.aspect_ratio && input.aspect_ratio !== "auto") videoConfig.aspectRatio = input.aspect_ratio;
          if (input.resolution) videoConfig.resolution = input.resolution;
          if (input.duration) {
            const dur = (input.duration as string).replace("s", "");
            videoConfig.durationSeconds = parseInt(dur);
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

          // Strip /i2v, /s2e suffixes — Gemini uses same model for all modes
          const geminiModelId = modelId.replace(/\/(i2v|s2e)$/, "");

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

        const response = await ai.models.generateContent({
          model: modelId,
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
          await updateGeneration(generation.id, { status: "failed", error: "No image generated", duration: 0 });
          return NextResponse.json({ error: "Gemini returned no image" }, { status: 400 });
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
        const msg = gemErr instanceof Error ? gemErr.message : "Gemini API error";
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

    // Replicate: async prediction — POST to create, poll in status route
    if (modelInfo.provider === "replicate") {
      if (!settings.replicateApiKey) {
        return NextResponse.json({ error: "Replicate API key not configured." }, { status: 500 });
      }
      try {
        // Strip /i2v or /s2e suffixes to get the Replicate model slug
        const replicateModel = modelId.replace(/\/(i2v|s2e)$/, "");

        // Build Replicate input
        const repInput: Record<string, unknown> = {
          prompt: prompt?.trim() || "Generate a video",
        };

        // Options passthrough
        if (input.aspect_ratio) repInput.aspect_ratio = input.aspect_ratio;
        if (input.resolution) repInput.resolution = input.resolution;
        if (input.generate_audio !== undefined) repInput.generate_audio = !!input.generate_audio;
        if (input.duration) {
          const dur = parseInt((input.duration as string).replace("s", ""));
          if (dur > 0) repInput.duration = dur;
        }

        // I2V: map image_url → first_frame_url (Seedance API field name)
        const imageUrl = input.image_url as string | undefined;
        if (imageUrl) repInput.first_frame_url = imageUrl;

        // S2E: pass both frames
        if (input.first_frame_url) repInput.first_frame_url = input.first_frame_url;
        if (input.last_frame_url) repInput.last_frame_url = input.last_frame_url;

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
          const errMsg = (predData.detail as string) || "Replicate submission failed";
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

    // No matching provider
    await updateGeneration(generation.id, { status: "failed", error: "Provider not supported", duration: 0 });
    return NextResponse.json({ error: `Provider "${modelInfo.provider}" is not supported.` }, { status: 400 });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}
