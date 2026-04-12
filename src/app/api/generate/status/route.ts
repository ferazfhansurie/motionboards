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

    if (!requestId || !modelId || !generationId) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const settings = getSettings();

    // --- Gemini Video polling ---
    if (geminiVideo === "true") {
      if (!settings.geminiApiKey) return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
      try {
        const { GoogleGenAI, GenerateVideosOperation } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });

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

    // No other async providers are supported. fal.ai polling has been removed.
    return NextResponse.json({ error: "No async polling supported for this provider" }, { status: 400 });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Status check failed" }, { status: 500 });
  }
}
