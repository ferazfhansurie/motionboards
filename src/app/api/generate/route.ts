import { NextRequest, NextResponse } from "next/server";
import { getSettings, createGeneration, updateGeneration, getUserFromToken, deductCredits } from "@/lib/db";
import { fal } from "@fal-ai/client";
import { models } from "@/lib/models";

export const maxDuration = 30; // Only needs to be fast — submits to queue and returns

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
    if (!settings.falApiKey) return NextResponse.json({ error: "fal.ai API key not configured." }, { status: 500 });

    fal.config({ credentials: settings.falApiKey });

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

    if (modelId === "easel-ai/advanced-face-swap") {
      input.workflow_type = "user_hair";
      input.gender_0 = "non-binary";
    }

    // Voice Clone TTS: 2-step — clone first, then TTS
    let actualModelId = modelId;
    if (modelId === "fal-ai/qwen-3-tts/text-to-speech/0.6b" && input.audio_url) {
      const cloneResult = await fal.subscribe("fal-ai/qwen-3-tts/clone-voice/0.6b", {
        input: { audio_url: input.audio_url },
        logs: true,
      });
      const cloneData = cloneResult.data as Record<string, unknown>;
      const embedding = cloneData.speaker_embedding as Record<string, unknown> | undefined;
      if (embedding?.url) {
        input.speaker_voice_embedding_file_url = embedding.url;
      }
      delete input.audio_url;
    }

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
        console.log(`[generate] Missing input "${inp.name}". Current input keys:`, Object.keys(input), `inputAudio:`, inputAudio ? "set" : "null", `inputImage:`, inputImage ? "set" : "null");
        return NextResponse.json({ error: `Missing required input: ${inp.description}. Please set it as a reference on the canvas.` }, { status: 400 });
      }
    }

    // Submit to fal.ai queue — returns immediately with request_id
    console.log(`[generate] Submitting to ${actualModelId}`, JSON.stringify(input).slice(0, 500));
    const { request_id } = await fal.queue.submit(actualModelId, { input });

    // Return immediately — client will poll for status
    return NextResponse.json({
      generationId: generation.id,
      requestId: request_id,
      modelId: actualModelId,
      status: "processing",
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}
