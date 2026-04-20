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
      const gcpLocation = process.env.GOOGLE_LOCATION || "global";
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
          // Check for operation-level error first (response may be undefined)
          const opError = (operation as unknown as Record<string, unknown>).error as Record<string, string> | undefined;
          if (opError || !operation.response) {
            const errMsg = opError?.message || "Video generation failed — no response from Google.";
            console.error("[Veo] Operation error:", JSON.stringify(opError || "no response"));
            await updateGeneration(generationId, { status: "failed", error: errMsg, duration: 0 });
            return NextResponse.json({ status: "failed", error: errMsg });
          }

          // Extract video from response — Vertex AI returns videoBytes (base64),
          // AI Studio returns uri (signed URL). Handle both.
          const genVideo = operation.response.generatedVideos?.[0]?.video;
          const videoUri = genVideo?.uri;
          const videoBytes = (genVideo as Record<string, unknown>)?.videoBytes as string | undefined;

          if (videoUri || videoBytes) {
            let outputUrl: string;
            try {
              if (videoBytes) {
                // Vertex AI: raw base64 video data — store directly in Neon
                const buffer = Buffer.from(videoBytes, "base64");
                const { id } = await putFile(buffer, "video/mp4", user.id);
                outputUrl = `${req.nextUrl.origin}/api/files/${id}`;
              } else {
                // AI Studio: short-lived signed URL — download and re-host in Neon
                outputUrl = videoUri!;
                const videoRes = await fetch(videoUri!);
                if (videoRes.ok) {
                  const buffer = Buffer.from(await videoRes.arrayBuffer());
                  const mimeType = videoRes.headers.get("content-type") || "video/mp4";
                  const { id } = await putFile(buffer, mimeType, user.id);
                  outputUrl = `${req.nextUrl.origin}/api/files/${id}`;
                }
              }
            } catch (storeErr) {
              console.error("Failed to store Gemini video:", storeErr);
              outputUrl = videoUri || "";
            }

            const modelInfo = models.find((m) => m.id === modelId);
            const actualCreditCost = modelInfo?.creditCost || 0;
            const costDisplay = `RM${(actualCreditCost / 100).toFixed(2)}`;
            await deductCredits(user.id, actualCreditCost);
            await updateGeneration(generationId, { status: "completed", outputUrl, duration: 0 });
            return NextResponse.json({ status: "completed", outputUrl, actualCost: costDisplay });
          }

          // No video came back, but there may not be a real filter reason —
          // Veo occasionally completes with an empty generatedVideos array for
          // transient reasons (internal retries, bad reference frames, quota
          // hiccups). Only claim "content policy" when we actually see a
          // safety / prohibited / RAI signal; otherwise give a neutral retry
          // message so users don't chase a policy rewrite for nothing.
          const failedVideo = operation.response.generatedVideos?.[0] as Record<string, unknown> | undefined;
          const rawReason =
            (failedVideo?.filteredReason as string | undefined) ||
            (failedVideo?.finishReason as string | undefined) ||
            ((operation.response as Record<string, unknown>)?.blockReason as string | undefined) ||
            ((operation.response as Record<string, unknown>)?.raiMediaFilteredReasons as string | undefined);

          const looksLikePolicy = !!rawReason && /SAFE|PROHIBIT|POLICY|RAI|CHILD|HARM|HATE|HARASS|SEXUAL|VIOLEN|COPYRIG|RECITAT/i.test(String(rawReason));

          let errDetail: string;
          if (looksLikePolicy) {
            errDetail = `Blocked by content policy (${rawReason}). Try rephrasing the prompt or swapping reference frames.`;
          } else if (rawReason) {
            errDetail = `Video failed: ${rawReason}. Try again.`;
          } else {
            errDetail =
              "Veo returned no video. Transient errors on Veo are common — try Generate again. If it keeps failing, tweak the prompt or swap the start/end frames.";
          }
          console.error("[Veo] No video output:", JSON.stringify(operation.response).slice(0, 1500));
          await updateGeneration(generationId, { status: "failed", error: errDetail, duration: 0 });
          return NextResponse.json({ status: "failed", error: errDetail });
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
          const raw = (pred.error as string) || "Generation failed on Replicate";
          // Log the full prediction so we can see what Replicate actually complained about
          console.error("[Replicate] Prediction failed", JSON.stringify({
            status: pred.status,
            error: pred.error,
            logs: (pred.logs as string)?.slice(-500),
          }));

          // Translate common Replicate errors into plain-English toasts so the
          // user knows whether to tweak the prompt, swap inputs, or retry.
          let friendly = raw;
          if (/flagged as sensitive|E005|NSFW|safety|content policy|sensitive content/i.test(raw)) {
            friendly =
              "Blocked by the model's safety filter. The prompt or one of your reference images tripped it — try rephrasing or swapping a different reference.";
          } else if (/RESOURCE_EXHAUSTED|rate ?limit|429|quota/i.test(raw)) {
            friendly = "Model is rate-limited right now. Try again in a minute.";
          } else if (/timeout|timed out/i.test(raw)) {
            friendly = "The generation timed out. Try a shorter duration or lower resolution.";
          } else if (/input .*invalid|validation|unexpected keyword|unknown field/i.test(raw)) {
            friendly = "The model rejected the input config. Double-check your aspect ratio / resolution / duration.";
          }

          await updateGeneration(generationId, { status: "failed", error: friendly, duration: 0 });
          return NextResponse.json({ status: "failed", error: friendly });
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
