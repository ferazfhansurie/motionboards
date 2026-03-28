import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateGeneration, getUserFromToken, deductCredits } from "@/lib/db";
import { fal } from "@fal-ai/client";
import { models } from "@/lib/models";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = req.nextUrl.searchParams.get("requestId");
    const modelId = req.nextUrl.searchParams.get("modelId");
    const generationId = req.nextUrl.searchParams.get("generationId");
    const ttsInput = req.nextUrl.searchParams.get("ttsInput");
    const ttsModelId = req.nextUrl.searchParams.get("ttsModelId");

    if (!requestId || !modelId || !generationId) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const settings = getSettings();
    if (!settings.falApiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    fal.config({ credentials: settings.falApiKey });

    const status = await fal.queue.status(modelId, { requestId, logs: true });

    if (status.status === "COMPLETED") {
      try {
        const result = await fal.queue.result(modelId, { requestId });
        const data = result.data as Record<string, unknown>;

        // Voice Clone step completed — submit TTS job with the embedding
        if (modelId.includes("clone-voice") && ttsInput && ttsModelId) {
          const embedding = data.speaker_embedding as Record<string, unknown> | undefined;
          if (!embedding?.url) {
            await updateGeneration(generationId, { status: "failed", error: "Voice cloning failed", duration: 0 });
            return NextResponse.json({ status: "failed", error: "Voice cloning failed. Try a clearer audio sample." });
          }
          // Submit TTS job with the embedding
          const parsedInput = JSON.parse(ttsInput) as Record<string, unknown>;
          parsedInput.speaker_voice_embedding_file_url = embedding.url;
          const { request_id: ttsReqId } = await fal.queue.submit(ttsModelId, { input: parsedInput });
          return NextResponse.json({
            status: "processing",
            log: "Voice cloned. Generating speech...",
            nextRequestId: ttsReqId,
            nextModelId: ttsModelId,
          });
        }

        // Normal completion — extract output URL
        let outputUrl: string | null = null;
        if (data.video && typeof data.video === "object") outputUrl = (data.video as Record<string, unknown>).url as string;
        else if (data.video_url && typeof data.video_url === "string") outputUrl = data.video_url;
        else if (data.images && Array.isArray(data.images) && data.images.length > 0) outputUrl = ((data.images[0] as Record<string, unknown>).url as string) || null;
        else if (data.image && typeof data.image === "object") outputUrl = (data.image as Record<string, unknown>).url as string;
        else if (data.audio && typeof data.audio === "object") outputUrl = (data.audio as Record<string, unknown>).url as string;
        else if (data.audio_url && typeof data.audio_url === "string") outputUrl = data.audio_url;
        else if (data.target && typeof data.target === "object") outputUrl = (data.target as Record<string, unknown>).url as string;
        else if (data.speaker_embedding && typeof data.speaker_embedding === "object") outputUrl = (data.speaker_embedding as Record<string, unknown>).url as string;
        else if (data.output && typeof data.output === "string") outputUrl = data.output;
        else if (data.url && typeof data.url === "string") outputUrl = data.url;

        // Find model for credit cost (use the original model, not intermediate steps)
        const origModelId = req.nextUrl.searchParams.get("origModelId");
        const modelInfo = models.find((m) => m.id === (origModelId || modelId));

        if (outputUrl) {
          await deductCredits(user.id, modelInfo?.creditCost || 0);
          await updateGeneration(generationId, { status: "completed", outputUrl, duration: 0 });
          return NextResponse.json({ status: "completed", outputUrl });
        } else {
          await updateGeneration(generationId, { status: "failed", error: "No output received", duration: 0 });
          return NextResponse.json({ status: "failed", error: "No output received from AI provider" });
        }
      } catch (resultError) {
        const errMsg = resultError instanceof Error ? resultError.message : "Generation failed";
        const body = (resultError as Record<string, unknown>)?.body as Record<string, unknown> | undefined;
        const detail = body?.detail;
        const friendlyMsg = Array.isArray(detail) && detail.length > 0
          ? (detail[0] as Record<string, unknown>).msg as string || errMsg
          : errMsg;
        await updateGeneration(generationId, { status: "failed", error: friendlyMsg, duration: 0 });
        return NextResponse.json({ status: "failed", error: friendlyMsg });
      }
    }

    if ((status.status as string) === "FAILED") {
      await updateGeneration(generationId, { status: "failed", error: "Generation failed on AI provider", duration: 0 });
      return NextResponse.json({ status: "failed", error: "Generation failed on AI provider" });
    }

    // Still in queue or processing
    const s = status as unknown as Record<string, unknown>;
    const logs = s.logs as Array<{ message: string }> | undefined;
    const lastLog = logs && logs.length > 0 ? logs[logs.length - 1].message : null;
    const position = s.queue_position as number | undefined;

    return NextResponse.json({
      status: status.status === "IN_QUEUE" ? "queued" : "processing",
      position: position ?? null,
      log: lastLog,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Status check failed" }, { status: 500 });
  }
}
