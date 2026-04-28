// Self-contained generation helper for the AI Agent flow.
//
// Mirrors the core of prompt-bar's handleGenerate but runs from anywhere —
// the agent calls this when it decides to invoke its `start_generation` tool.
// Skips the canvas-tagged input flow (refs, start/end frames, auto-connect)
// since the AI passes URLs directly. Manual prompt-bar flow keeps its own
// path; this exists alongside.
//
// Returns a promise that resolves when the generation completes (output URL)
// or fails (error string). Either way, the canvas card it places stays on
// the canvas — the user always has a record.

import { useAppStore, type BoardItem } from "@/lib/store";
import { models } from "@/lib/models";

export interface AgentGenerationArgs {
  modelId: string;
  prompt: string;
  options?: Record<string, unknown>;
  inputImageUrl?: string;
  inputVideoUrl?: string;
}

export interface AgentGenerationResult {
  itemId: string;
  outputUrl?: string;
  error?: string;
  modelName?: string;
}

// Where to drop the card on the canvas. Center of the current viewport so
// it shows up exactly where the user is looking.
function getCenterPosition(w: number, h: number): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  const { panX, panY, zoom } = useAppStore.getState();
  const cx = (-panX + window.innerWidth / 2 - w / 2) / zoom;
  const cy = (-panY + window.innerHeight / 2 - h / 2) / zoom;
  return { x: cx, y: cy };
}

export async function runAgentGeneration(args: AgentGenerationArgs): Promise<AgentGenerationResult> {
  const { modelId, prompt, options, inputImageUrl, inputVideoUrl } = args;

  const model = models.find((m) => m.id === modelId);
  if (!model) {
    return { itemId: "", error: `Model "${modelId}" not found in the catalog.` };
  }
  if (model.disabled) {
    return { itemId: "", error: model.disabledReason || `${model.name} is currently unavailable.` };
  }

  // Place the placeholder card immediately
  const outputType: "image" | "video" | "audio" =
    model.type === "audio" || model.type === "a2a" || model.type === "sfx"
      ? "audio"
      : ["t2i", "i2i", "upscale"].includes(model.type)
        ? "image"
        : "video";

  const ar = (options?.aspect_ratio as string) || model.options?.aspect_ratio?.default || "16:9";
  const isPortrait = ar === "9:16" || ar === "3:4" || ar === "2:3";
  const baseW = outputType === "image" ? (isPortrait ? 140 : 200) : (isPortrait ? 140 : 200);
  const baseH = outputType === "audio" ? 60 : (isPortrait ? 240 : 130);
  const pos = getCenterPosition(baseW, baseH);

  const genItemId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const genItem: BoardItem = {
    id: genItemId,
    type: "generation",
    x: pos.x,
    y: pos.y,
    width: baseW,
    height: baseH,
    src: "",
    prompt,
    model: model.id,
    modelName: model.name,
    status: "processing",
    outputType,
    progressText: "Starting...",
    createdAt: new Date().toISOString(),
  };
  useAppStore.getState().addItem(genItem);

  try {
    // Build the same payload prompt-bar's handleGenerate sends. The agent
    // passes URLs directly so we don't need to walk inputRefs / startFrameId.
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
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => "");
      data = { error: text.slice(0, 200) || `HTTP ${res.status}` };
    }

    if (!res.ok) {
      const msg = (data.error as string) || `HTTP ${res.status}`;
      useAppStore.getState().updateItem(genItemId, {
        status: "failed",
        error: msg,
        progressText: undefined,
      });
      return { itemId: genItemId, error: msg, modelName: model.name };
    }

    // Sync providers (Segmind, Gemini image, Fish TTS, OpenAI TTS) return
    // status: "completed" with outputUrl right away.
    if (data.status === "completed" && data.outputUrl) {
      const outputUrl = data.outputUrl as string;
      useAppStore.getState().updateItem(genItemId, {
        status: "completed",
        outputUrl,
        progressText: undefined,
      });
      // Resize card to actual aspect for images
      if (outputType === "image" && typeof window !== "undefined") {
        const img = new window.Image();
        img.onload = () => {
          const maxW = 250;
          const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
          useAppStore.getState().updateItem(genItemId, {
            width: Math.round(img.naturalWidth * scale),
            height: Math.round(img.naturalHeight * scale),
          });
        };
        img.src = outputUrl;
      }
      return { itemId: genItemId, outputUrl, modelName: model.name };
    }

    // Async providers — poll /api/generate/status until done. Persist the
    // poll handles to the genItem so a page refresh resumes from the canvas
    // useEffect.
    const requestId = data.requestId as string;
    const generationId = data.generationId as string;
    const isGeminiVideo = !!data.geminiVideo;
    const isOpenaiVideo = !!data.openaiVideo;
    const isReplicateVideo = !!data.replicateVideo;
    const isByteplusVideo = !!data.byteplusVideo;
    const isComfyVideo = !!data.comfyVideo;
    const pollProvider: BoardItem["pollProvider"] =
      isGeminiVideo ? "gemini" :
      isOpenaiVideo ? "openai" :
      isReplicateVideo ? "replicate" :
      isByteplusVideo ? "byteplus" :
      isComfyVideo ? "comfy" : undefined;

    if (!requestId || !pollProvider) {
      const msg = "Generation queued but the server didn't return a request id. Try again.";
      useAppStore.getState().updateItem(genItemId, { status: "failed", error: msg });
      return { itemId: genItemId, error: msg, modelName: model.name };
    }

    useAppStore.getState().updateItem(genItemId, {
      requestId,
      generationId,
      pollProvider,
      progressText: "Queued...",
    });

    // Poll until terminal. Bail after ~10 minutes max so a hung server doesn't
    // leave the chat blocked forever; the canvas item itself stays so the
    // user can retry if needed.
    const startedAt = Date.now();
    const maxWaitMs = 10 * 60 * 1000;
    while (Date.now() - startedAt < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 3000));

      let url = `/api/generate/status?requestId=${encodeURIComponent(requestId)}&modelId=${encodeURIComponent(modelId)}&generationId=${encodeURIComponent(generationId)}`;
      if (isGeminiVideo) url += "&geminiVideo=true";
      if (isOpenaiVideo) url += "&openaiVideo=true";
      if (isReplicateVideo) url += "&replicateVideo=true";
      if (isByteplusVideo) url += "&byteplusVideo=true";
      if (isComfyVideo) url += "&comfyVideo=true";

      let statusData: Record<string, unknown>;
      try {
        const statusRes = await fetch(url);
        statusData = await statusRes.json();
      } catch (err) {
        // Transient network error — keep polling
        console.warn("[runAgentGeneration] poll error, retrying:", err);
        continue;
      }

      if (statusData.log) {
        useAppStore.getState().updateItem(genItemId, { progressText: statusData.log as string });
      }

      if (statusData.status === "completed" && statusData.outputUrl) {
        const outputUrl = statusData.outputUrl as string;
        useAppStore.getState().updateItem(genItemId, {
          status: "completed",
          outputUrl,
          progressText: undefined,
        });
        return { itemId: genItemId, outputUrl, modelName: model.name };
      }
      if (statusData.status === "failed") {
        const msg = (statusData.error as string) || "Generation failed";
        useAppStore.getState().updateItem(genItemId, {
          status: "failed",
          error: msg,
          progressText: undefined,
        });
        return { itemId: genItemId, error: msg, modelName: model.name };
      }
    }

    // Timed out
    const timeoutMsg = "Generation timed out after 10 minutes. The canvas card will keep polling.";
    useAppStore.getState().updateItem(genItemId, { progressText: "Still working..." });
    return { itemId: genItemId, error: timeoutMsg, modelName: model.name };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    useAppStore.getState().updateItem(genItemId, {
      status: "failed",
      error: msg,
      progressText: undefined,
    });
    return { itemId: genItemId, error: msg, modelName: model.name };
  }
}
