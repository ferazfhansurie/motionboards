// Canvas-free generation runner for the FatHopes floating agent.
//
// Same /api/generate + /api/generate/status flow as runAgentGeneration, but it
// never touches the canvas store — it reports progress through a callback and
// resolves with the output URL (or an error string). The gallery agent uses
// this so generations don't drop cards onto the board.

import { models } from "@/lib/models";

export interface RunGenArgs {
  modelId: string;
  prompt: string;
  options?: Record<string, unknown>;
  inputImageUrl?: string;
  inputVideoUrl?: string;
}

export interface RunGenResult {
  outputUrl?: string;
  error?: string;
  outputType: "image" | "video" | "audio";
  modelName: string;
}

export function outputTypeFor(modelType: string): "image" | "video" | "audio" {
  if (["audio", "a2a", "sfx"].includes(modelType)) return "audio";
  if (["t2i", "i2i", "upscale"].includes(modelType)) return "image";
  return "video";
}

export async function runGeneration(
  args: RunGenArgs,
  onProgress?: (text: string) => void,
): Promise<RunGenResult> {
  const { modelId, prompt, options, inputImageUrl, inputVideoUrl } = args;
  const model = models.find((m) => m.id === modelId);
  if (!model) return { error: `Model "${modelId}" not found.`, outputType: "image", modelName: modelId };
  if (model.disabled) return { error: model.disabledReason || `${model.name} is unavailable.`, outputType: "image", modelName: model.name };

  const outputType = outputTypeFor(model.type);

  try {
    onProgress?.("Starting…");
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        prompt,
        inputImage: inputImageUrl || null,
        inputVideo: inputVideoUrl || null,
        generationOptions: options || {},
      }),
    });

    let data: Record<string, unknown> = {};
    try { data = await res.json(); } catch { data = { error: `HTTP ${res.status}` }; }
    if (!res.ok) return { error: (data.error as string) || `HTTP ${res.status}`, outputType, modelName: model.name };

    // Sync providers return immediately.
    if (data.status === "completed" && data.outputUrl) {
      return { outputUrl: data.outputUrl as string, outputType, modelName: model.name };
    }

    // Async providers — poll status.
    const requestId = data.requestId as string;
    const generationId = data.generationId as string;
    const flags = {
      gemini: !!data.geminiVideo, openai: !!data.openaiVideo, replicate: !!data.replicateVideo,
      byteplus: !!data.byteplusVideo, comfy: !!data.comfyVideo,
    };
    const hasProvider = Object.values(flags).some(Boolean);
    if (!requestId || !hasProvider) {
      return { error: "Generation queued but no request id came back.", outputType, modelName: model.name };
    }

    const startedAt = Date.now();
    const maxWaitMs = 10 * 60 * 1000;
    while (Date.now() - startedAt < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 3000));
      let url = `/api/generate/status?requestId=${encodeURIComponent(requestId)}&modelId=${encodeURIComponent(modelId)}&generationId=${encodeURIComponent(generationId)}`;
      if (flags.gemini) url += "&geminiVideo=true";
      if (flags.openai) url += "&openaiVideo=true";
      if (flags.replicate) url += "&replicateVideo=true";
      if (flags.byteplus) url += "&byteplusVideo=true";
      if (flags.comfy) url += "&comfyVideo=true";

      let s: Record<string, unknown>;
      try { s = await (await fetch(url)).json(); } catch { continue; }
      if (s.log) onProgress?.(s.log as string);
      if (s.status === "completed" && s.outputUrl) return { outputUrl: s.outputUrl as string, outputType, modelName: model.name };
      if (s.status === "failed") return { error: (s.error as string) || "Generation failed", outputType, modelName: model.name };
    }
    return { error: "Generation timed out after 10 minutes.", outputType, modelName: model.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed", outputType, modelName: model.name };
  }
}
