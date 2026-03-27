import { NextRequest, NextResponse } from "next/server";
import { getSettings, createGeneration, updateGeneration, getUserFromToken, deductCredits } from "@/lib/db";
import { fal } from "@fal-ai/client";
import Replicate from "replicate";
import { models } from "@/lib/models";
import type { ModelType } from "@/lib/models";

export const maxDuration = 300;

const IMAGE_INPUT_TYPES: ModelType[] = ["i2v", "i2i", "s2e", "upscale", "lipsync"];
const VIDEO_INPUT_TYPES: ModelType[] = ["v2v", "lipsync"];
const AUDIO_INPUT_TYPES: ModelType[] = ["lipsync", "a2a"];

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Auth check
    const token = req.cookies.get("session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated. Please login." }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, model: modelId, mode, inputImage, startFrame, endFrame, inputAudio, generationOptions } = body;

    const modelInfo = models.find((m) => m.id === modelId);
    if (!modelInfo) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    // Check credits — NEVER proceed if insufficient
    const creditCost = modelInfo.creditCost;
    if (!user.credits || user.credits <= 0) {
      return NextResponse.json(
        { error: "No credits. Please top up before generating." },
        { status: 402 }
      );
    }
    if (user.credits < creditCost) {
      const rmCost = (creditCost / 100).toFixed(2);
      const rmBalance = (user.credits / 100).toFixed(2);
      return NextResponse.json(
        { error: `Insufficient credits. This model costs RM${rmCost} (${modelInfo.cost}). You have RM${rmBalance}. Top up your credits.` },
        { status: 402 }
      );
    }

    const needsPrompt = modelInfo.inputs.some((inp) => inp.type === "text" && inp.required);
    if (needsPrompt && (!prompt || !prompt.trim())) {
      return NextResponse.json({ error: "Prompt is required for this model" }, { status: 400 });
    }

    const settings = getSettings();

    const generation = await createGeneration({
      prompt: prompt || "",
      model: modelId,
      provider: modelInfo.provider,
      mode: mode || modelInfo.type,
      status: "processing",
      inputImage: inputImage ? "uploaded" : null,
      userId: user.id,
      creditCost,
    });

    let outputUrl: string | null = null;

    try {
      // Double-check credits right before calling AI provider (race condition guard)
      const freshUser = await getUserFromToken(token);
      if (!freshUser || freshUser.credits < creditCost) {
        await updateGeneration(generation.id, { status: "failed", error: "Insufficient credits", duration: 0 });
        return NextResponse.json({ error: "Insufficient credits. Please top up." }, { status: 402 });
      }

      if (modelInfo.provider === "fal") {
        if (!settings.falApiKey) {
          throw new Error("fal.ai API key not configured.");
        }

        fal.config({ credentials: settings.falApiKey });

        const input: Record<string, unknown> = {};
        if (prompt && prompt.trim()) input.prompt = prompt.trim();

        // Apply generation options (aspect_ratio, duration, resolution, generate_audio, etc.)
        if (generationOptions && typeof generationOptions === "object") {
          for (const [key, value] of Object.entries(generationOptions)) {
            if (value !== undefined && value !== null && value !== "") {
              input[key] = value;
            }
          }
        }

        if (IMAGE_INPUT_TYPES.includes(modelInfo.type) && inputImage) {
          input.image_url = inputImage;
        }

        if (modelInfo.type === "s2e") {
          if (startFrame) input.start_frame_url = startFrame;
          if (endFrame) input.end_frame_url = endFrame;
          if (startFrame) input.image_url = startFrame;
        }

        if (VIDEO_INPUT_TYPES.includes(modelInfo.type) && inputImage) {
          input.video_url = inputImage;
        }

        // Audio input for lipsync and audio models
        if (AUDIO_INPUT_TYPES.includes(modelInfo.type) && inputAudio) {
          input.audio_url = inputAudio;
        }

        // For face swap — map second image input
        if (modelId === "easel-ai/advanced-face-swap" && inputImage) {
          input.face_image_0 = inputImage;
          input.workflow_type = "user_hair";
          input.gender_0 = "non-binary";
        }

        const result = await fal.subscribe(modelId, { input, logs: true });
        const data = result.data as Record<string, unknown>;

        if (data.video && typeof data.video === "object") {
          outputUrl = (data.video as Record<string, unknown>).url as string;
        } else if (data.video_url && typeof data.video_url === "string") {
          outputUrl = data.video_url;
        } else if (data.images && Array.isArray(data.images) && data.images.length > 0) {
          outputUrl = ((data.images[0] as Record<string, unknown>).url as string) || null;
        } else if (data.image && typeof data.image === "object") {
          outputUrl = (data.image as Record<string, unknown>).url as string;
        } else if (data.audio && typeof data.audio === "object") {
          outputUrl = (data.audio as Record<string, unknown>).url as string;
        } else if (data.audio_url && typeof data.audio_url === "string") {
          outputUrl = data.audio_url;
        } else if (data.target && typeof data.target === "object") {
          // Sam Audio returns { target: { url }, residual: { url } }
          outputUrl = (data.target as Record<string, unknown>).url as string;
        } else if (data.model_mesh && typeof data.model_mesh === "object") {
          // 3D models (Trellis/TripoSR)
          outputUrl = (data.model_mesh as Record<string, unknown>).url as string;
        } else if (data.output && typeof data.output === "string") {
          outputUrl = data.output;
        } else if (data.url && typeof data.url === "string") {
          outputUrl = data.url;
        }
      } else if (modelInfo.provider === "replicate") {
        if (!settings.replicateApiKey) {
          throw new Error("Replicate API token not configured.");
        }

        const replicate = new Replicate({ auth: settings.replicateApiKey });

        const input: Record<string, unknown> = {};
        if (prompt) input.prompt = prompt;
        if (inputImage) input.image = inputImage;

        const output = await replicate.run(modelId as `${string}/${string}`, { input });

        if (typeof output === "string") {
          outputUrl = output;
        } else if (Array.isArray(output) && output.length > 0) {
          outputUrl = typeof output[0] === "string" ? output[0] : ((output[0] as Record<string, unknown>).url as string);
        } else if (output && typeof output === "object" && "url" in (output as Record<string, unknown>)) {
          outputUrl = (output as Record<string, unknown>).url as string;
        }
      }

      const duration = (Date.now() - startTime) / 1000;

      if (outputUrl) {
        // SUCCESS — deduct credits only now
        await deductCredits(user.id, creditCost);

        const updated = await updateGeneration(generation.id, {
          status: "completed",
          outputUrl,
          duration,
        });
        return NextResponse.json(updated);
      } else {
        // No output — don't charge
        const updated = await updateGeneration(generation.id, {
          status: "failed",
          error: "No output received from AI provider",
          duration,
        });
        return NextResponse.json(updated);
      }
    } catch (genError) {
      // Generation failed — don't charge
      const duration = (Date.now() - startTime) / 1000;
      const errorMsg = genError instanceof Error ? genError.message : "Generation failed";
      const updated = await updateGeneration(generation.id, {
        status: "failed",
        error: errorMsg,
        duration,
      });
      return NextResponse.json(updated);
    }
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong" },
      { status: 500 }
    );
  }
}
