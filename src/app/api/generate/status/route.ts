import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateGeneration, getUserFromToken, deductCredits, putFile } from "@/lib/db";
import { models } from "@/lib/models";

// Status polling for async generations.
// Currently only Gemini Veo (long-running operation) needs polling — every other
// provider in the catalog is synchronous and returns the result from /api/generate.
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const requestId = req.nextUrl.searchParams.get("requestId");
    const modelId = req.nextUrl.searchParams.get("modelId");
    const generationId = req.nextUrl.searchParams.get("generationId");
    const geminiVideo = req.nextUrl.searchParams.get("geminiVideo");
    const openaiVideo = req.nextUrl.searchParams.get("openaiVideo");
    const replicateVideo = req.nextUrl.searchParams.get("replicateVideo");

    if (!requestId || !modelId || !generationId) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const settings = getSettings();

    // --- Gemini Video polling (Vertex AI preferred, falls back to API key) ---
    if (geminiVideo === "true") {
      const gcpProject = process.env.GOOGLE_PROJECT_ID;
      const gcpLocation = process.env.GOOGLE_LOCATION || "us-central1";
      const gcpServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const hasVertexAI = !!(gcpProject && gcpServiceAccount);

      if (!hasVertexAI && !settings.geminiApiKey) return NextResponse.json({ error: "Google API not configured" }, { status: 500 });
      try {
        const { GoogleGenAI, GenerateVideosOperation } = await import("@google/genai");
        const ai = hasVertexAI
          ? new GoogleGenAI({
              vertexai: true,
              project: gcpProject,
              location: gcpLocation,
              googleAuthOptions: { credentials: JSON.parse(gcpServiceAccount!) },
            })
          : new GoogleGenAI({ apiKey: settings.geminiApiKey });

        // Poll using operation name stored in requestId
        const opStub = new GenerateVideosOperation();
        opStub.name = requestId;
        const operation = await ai.operations.getVideosOperation({ operation: opStub });

        if (operation.done) {
          // Extract video from response
          const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;

          if (videoUri) {
            // Gemini's videoUri is a short-lived signed URL. Download the bytes
            // and re-host them in Neon so the canvas keeps working forever.
            let outputUrl = videoUri;
            try {
              const videoRes = await fetch(videoUri);
              if (videoRes.ok) {
                const buffer = Buffer.from(await videoRes.arrayBuffer());
                const mimeType = videoRes.headers.get("content-type") || "video/mp4";
                const { id } = await putFile(buffer, mimeType, user.id);
                outputUrl = `${req.nextUrl.origin}/api/files/${id}`;
              }
            } catch (storeErr) {
              console.error("Failed to re-host Gemini video:", storeErr);
              // Fall back to the raw Gemini URL — it will work for a while at least
            }

            const modelInfo = models.find((m) => m.id === modelId);
            const actualCreditCost = modelInfo?.creditCost || 0;
            const costDisplay = `RM${(actualCreditCost / 100).toFixed(2)}`;
            await deductCredits(user.id, actualCreditCost);
            await updateGeneration(generationId, { status: "completed", outputUrl, duration: 0 });
            return NextResponse.json({ status: "completed", outputUrl, actualCost: costDisplay });
          }

          await updateGeneration(generationId, { status: "failed", error: "No video generated", duration: 0 });
          return NextResponse.json({ status: "failed", error: "No video in Gemini response" });
        }

        return NextResponse.json({ status: "processing", log: "Generating video..." });
      } catch (gemErr) {
        const msg = gemErr instanceof Error ? gemErr.message : "Gemini status check failed";
        await updateGeneration(generationId, { status: "failed", error: msg, duration: 0 });
        return NextResponse.json({ status: "failed", error: msg });
      }
    }

    // --- OpenAI Sora video polling ---
    if (openaiVideo === "true") {
      if (!settings.openaiApiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
      try {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: settings.openaiApiKey });

        const video = await openai.videos.retrieve(requestId);

        if (video.status === "completed") {
          // Download the video bytes and re-host in Neon
          let outputUrl: string;
          try {
            const res = await openai.videos.downloadContent(requestId);
            const buffer = Buffer.from(await res.arrayBuffer());
            const { id } = await putFile(buffer, "video/mp4", user.id);
            outputUrl = `${req.nextUrl.origin}/api/files/${id}`;
          } catch (dlErr) {
            console.error("Failed to download Sora video:", dlErr);
            await updateGeneration(generationId, { status: "failed", error: "Failed to download video from OpenAI", duration: 0 });
            return NextResponse.json({ status: "failed", error: "Failed to download video from OpenAI" });
          }

          const modelInfo = models.find((m) => m.id === modelId);
          const actualCreditCost = modelInfo?.creditCost || 0;
          const costDisplay = `RM${(actualCreditCost / 100).toFixed(2)}`;
          await deductCredits(user.id, actualCreditCost);
          await updateGeneration(generationId, { status: "completed", outputUrl, duration: 0 });
          return NextResponse.json({ status: "completed", outputUrl, actualCost: costDisplay });
        }

        if (video.status === "failed") {
          const errMsg = video.error?.message || "Sora generation failed";
          await updateGeneration(generationId, { status: "failed", error: errMsg, duration: 0 });
          return NextResponse.json({ status: "failed", error: errMsg });
        }

        // Still queued or in_progress
        return NextResponse.json({
          status: "processing",
          log: `Generating video... ${video.progress ?? 0}%`,
        });
      } catch (oaiErr) {
        const msg = oaiErr instanceof Error ? oaiErr.message : "OpenAI status check failed";
        await updateGeneration(generationId, { status: "failed", error: msg, duration: 0 });
        return NextResponse.json({ status: "failed", error: msg });
      }
    }

    // --- Replicate prediction polling ---
    if (replicateVideo === "true") {
      if (!settings.replicateApiKey) return NextResponse.json({ error: "Replicate API key not configured" }, { status: 500 });
      try {
        const predRes = await fetch(`https://api.replicate.com/v1/predictions/${requestId}`, {
          headers: { "Authorization": `Bearer ${settings.replicateApiKey}` },
        });
        const pred = await predRes.json() as Record<string, unknown>;

        if (pred.status === "succeeded") {
          // Output can be a URL string or an object with url field
          let outputUrl: string | null = null;
          if (typeof pred.output === "string") outputUrl = pred.output;
          else if (Array.isArray(pred.output) && pred.output.length > 0) outputUrl = pred.output[0] as string;
          else if (pred.output && typeof pred.output === "object") outputUrl = (pred.output as Record<string, unknown>).url as string;

          if (outputUrl) {
            // Re-host in Neon so the URL persists under our 14-day TTL
            try {
              const vidRes = await fetch(outputUrl);
              if (vidRes.ok) {
                const buffer = Buffer.from(await vidRes.arrayBuffer());
                const mimeType = vidRes.headers.get("content-type") || "video/mp4";
                const { id } = await putFile(buffer, mimeType, user.id);
                outputUrl = `${req.nextUrl.origin}/api/files/${id}`;
              }
            } catch (dlErr) {
              console.error("Failed to re-host Replicate video:", dlErr);
              // Fall back to the raw Replicate URL
            }

            const modelInfo = models.find((m) => m.id === modelId);
            const actualCreditCost = modelInfo?.creditCost || 0;
            const costDisplay = `RM${(actualCreditCost / 100).toFixed(2)}`;
            await deductCredits(user.id, actualCreditCost);
            await updateGeneration(generationId, { status: "completed", outputUrl, duration: 0 });
            return NextResponse.json({ status: "completed", outputUrl, actualCost: costDisplay });
          }

          await updateGeneration(generationId, { status: "failed", error: "No output received", duration: 0 });
          return NextResponse.json({ status: "failed", error: "No output received from Replicate" });
        }

        if (pred.status === "failed" || pred.status === "canceled") {
          const errMsg = (pred.error as string) || "Generation failed on Replicate";
          await updateGeneration(generationId, { status: "failed", error: errMsg, duration: 0 });
          return NextResponse.json({ status: "failed", error: errMsg });
        }

        // Still starting or processing
        const logs = (pred.logs as string) || "";
        const lastLog = logs.split("\n").filter(Boolean).pop() || null;
        return NextResponse.json({
          status: "processing",
          log: lastLog || "Generating video...",
        });
      } catch (repErr) {
        const msg = repErr instanceof Error ? repErr.message : "Replicate status check failed";
        await updateGeneration(generationId, { status: "failed", error: msg, duration: 0 });
        return NextResponse.json({ status: "failed", error: msg });
      }
    }

    // No other async providers are supported.
    return NextResponse.json({ error: "No async polling supported for this provider" }, { status: 400 });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Status check failed" }, { status: 500 });
  }
}
