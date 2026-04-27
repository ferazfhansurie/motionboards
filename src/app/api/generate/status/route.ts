import { NextRequest, NextResponse } from "next/server";
import { getSettings, finalizeGeneration, getUserFromToken, putFile, chargeForGeneration } from "@/lib/db";
import { models } from "@/lib/models";
import { downloadOutput, getHistoryOutputs, getJobStatus, pickOutputFile } from "@/lib/comfy";

// Translate Veo error strings into something actionable. Google's default
// messages are verbose and rarely tell the user *why* — "Veo could not
// generate N videos based on the prompt provided. You will not be charged…
// Support codes: 42237218. Try again." almost always means the safety filter
// soft-declined without disclosing the reason. Collapse those into a plain
// "safety filter" toast and drop the marketing boilerplate.
function humanizeVeoError(raw: string): string {
  const r = (raw || "").trim();
  if (!r) return "Veo returned no video. Try again.";

  // Explicit safety / policy signals get the direct message.
  if (/SAFE|PROHIBIT|POLICY|RAI|CHILD|HARM|HATE|HARASS|SEXUAL|VIOLEN|COPYRIG|RECITAT/i.test(r)) {
    return "Blocked by content policy. Rephrase the prompt or swap the reference frames.";
  }
  // Vertex's "N videos were filtered out because they violated..." phrasing.
  // This is Veo's safety filter tripping silently — usually on financial
  // claims, named people / brands, or location-specific content. Point the
  // user at rephrasing rather than at Google support.
  if (/filtered out|violated .*usage guidelines/i.test(r)) {
    return "Veo's safety filter blocked this video. Common triggers: financial claims (\"below market price\"), named people, brand/location names, or anything reading as advice. Rephrase as pure scene description or try Sora 2 / Seedance.";
  }
  // Google's generic "could not generate" soft-decline. In practice this is
  // either a filter trip with no reason given, or a transient Veo internal
  // error — treat both as a rephrase-or-retry toast and don't echo their
  // verbose support-code trailer.
  if (/could not generate|did not generate|no video(s)? (were|was) generated/i.test(r)) {
    return "Veo couldn't generate this one. It's usually a content-policy soft decline or a transient Veo error — rephrase the prompt, swap the reference frames, or try again.";
  }
  if (/RESOURCE_EXHAUSTED|429|quota|rate ?limit/i.test(r)) {
    return "Veo is rate-limited right now. Wait a minute and try again.";
  }
  if (/PERMISSION_DENIED|credential|API key/i.test(r)) {
    return "Veo credentials are missing or invalid. Contact the admin.";
  }
  if (/timeout|timed out/i.test(r)) {
    return "Veo timed out. Try a shorter duration or lower resolution.";
  }

  // Fallback — trim the useless trailing bits Google appends.
  let cleaned = r
    .replace(/\s*Support codes?:[^.]*\.?/gi, "")
    .replace(/\s*You will not be charged for this request\.?/gi, "")
    .replace(/\s*If you think this was an error[^.]*\.?/gi, "")
    .replace(/\s*Try rephrasing the prompt\.?/gi, "")
    .replace(/\s*Try again\.?\s*$/gi, "")
    .trim();
  if (!cleaned) cleaned = "Veo returned no video.";
  return cleaned;
}

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
    const byteplusVideo = req.nextUrl.searchParams.get("byteplusVideo");
    const comfyVideo = req.nextUrl.searchParams.get("comfyVideo");

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
            const raw = opError?.message || "Video generation failed — no response from Google.";
            const errMsg = humanizeVeoError(raw);
            console.error("[Veo] Operation error:", JSON.stringify(opError || "no response"));
            await finalizeGeneration(generationId, { status: "failed", error: errMsg });
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

            const charge = await chargeForGeneration({ userId: user.id, generationId, modelId });
            const costDisplay = `RM${(charge.totalCredits / 100).toFixed(2)}`;
            await finalizeGeneration(generationId, { status: "completed", outputUrl });
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

          const errDetail = rawReason
            ? humanizeVeoError(String(rawReason))
            : "Veo returned no video. Transient errors on Veo are common — try Generate again. If it keeps failing, tweak the prompt or swap the start/end frames.";
          console.error("[Veo] No video output:", JSON.stringify(operation.response).slice(0, 1500));
          await finalizeGeneration(generationId, { status: "failed", error: errDetail });
          return NextResponse.json({ status: "failed", error: errDetail });
        }

        return NextResponse.json({ status: "processing", log: "Generating video..." });
      } catch (gemErr) {
        const msg = gemErr instanceof Error ? gemErr.message : "Gemini status check failed";
        await finalizeGeneration(generationId, { status: "failed", error: msg });
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
            await finalizeGeneration(generationId, { status: "failed", error: "Failed to download video from OpenAI" });
            return NextResponse.json({ status: "failed", error: "Failed to download video from OpenAI" });
          }

          const charge = await chargeForGeneration({ userId: user.id, generationId, modelId });
          const costDisplay = `RM${(charge.totalCredits / 100).toFixed(2)}`;
          await finalizeGeneration(generationId, { status: "completed", outputUrl });
          return NextResponse.json({ status: "completed", outputUrl, actualCost: costDisplay });
        }

        if (video.status === "failed") {
          const errMsg = video.error?.message || "Sora generation failed";
          await finalizeGeneration(generationId, { status: "failed", error: errMsg });
          return NextResponse.json({ status: "failed", error: errMsg });
        }

        // Still queued or in_progress
        return NextResponse.json({
          status: "processing",
          log: `Generating video... ${video.progress ?? 0}%`,
        });
      } catch (oaiErr) {
        const msg = oaiErr instanceof Error ? oaiErr.message : "OpenAI status check failed";
        await finalizeGeneration(generationId, { status: "failed", error: msg });
        return NextResponse.json({ status: "failed", error: msg });
      }
    }

    // --- ByteDance Ark (Seedance 2.0) task polling ---
    if (byteplusVideo === "true") {
      if (!settings.arkApiKey) {
        return NextResponse.json({ error: "ByteDance Ark API key not configured" }, { status: 500 });
      }
      try {
        const taskRes = await fetch(
          `https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/${encodeURIComponent(requestId)}`,
          { headers: { Authorization: `Bearer ${settings.arkApiKey}` } }
        );
        const task = (await taskRes.json()) as Record<string, unknown>;

        const status = (task.status as string) || "";
        if (status === "succeeded") {
          const contentObj = task.content as Record<string, unknown> | undefined;
          const videoUrl = contentObj?.video_url as string | undefined;
          if (!videoUrl) {
            await finalizeGeneration(generationId, { status: "failed", error: "No video URL returned" });
            return NextResponse.json({ status: "failed", error: "No video URL returned" });
          }

          // Re-host in Neon so the URL survives Ark's storage TTL and shares
          // our 14-day sweep with every other generation.
          let outputUrl = videoUrl;
          try {
            const vidRes = await fetch(videoUrl);
            if (vidRes.ok) {
              const buffer = Buffer.from(await vidRes.arrayBuffer());
              const mimeType = vidRes.headers.get("content-type") || "video/mp4";
              const { id } = await putFile(buffer, mimeType, user.id);
              outputUrl = `${req.nextUrl.origin}/api/files/${id}`;
            }
          } catch (dlErr) {
            console.error("Failed to re-host Ark video:", dlErr);
          }

          const charge = await chargeForGeneration({ userId: user.id, generationId, modelId });
          const costDisplay = `RM${(charge.totalCredits / 100).toFixed(2)}`;
          await finalizeGeneration(generationId, { status: "completed", outputUrl });
          return NextResponse.json({ status: "completed", outputUrl, actualCost: costDisplay });
        }

        if (status === "failed" || status === "expired") {
          // Ark returns error detail either as a string or an object with
          // { code, message }. Translate common filter and quota errors.
          const rawErr = task.error as Record<string, unknown> | string | undefined;
          const raw = typeof rawErr === "string"
            ? rawErr
            : (rawErr?.message as string) || (rawErr?.code as string) || `Seedance ${status}`;
          let friendly = raw;
          if (/sensitive|safety|content|policy|violat|NSFW|prohibit/i.test(raw)) {
            friendly = "Blocked by the model's safety filter. The prompt or one of your reference images tripped it — try rephrasing or swapping a different reference.";
          } else if (/quota|limit|rate|429/i.test(raw)) {
            friendly = "Seedance is rate-limited right now. Try again in a minute.";
          } else if (/timeout|timed out|expire/i.test(raw)) {
            friendly = "The generation took too long and expired. Try a shorter duration or lower resolution.";
          }
          console.error("[ByteplusArk] Task failed", JSON.stringify(task).slice(0, 800));
          await finalizeGeneration(generationId, { status: "failed", error: friendly });
          return NextResponse.json({ status: "failed", error: friendly });
        }

        // queued / running — keep polling
        return NextResponse.json({ status: "processing", log: `Seedance: ${status || "queued"}...` });
      } catch (arkErr) {
        const msg = arkErr instanceof Error ? arkErr.message : "ByteDance Ark status check failed";
        await finalizeGeneration(generationId, { status: "failed", error: msg });
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
          // Output shape varies by model:
          //   string                     → most v2v / image / video models
          //   array of strings           → some image models (we take [0])
          //   { url }                    → standard cog wrapper
          //   { vocals }                 → Demucs with stem=vocals
          //   { vocals, drums, bass, other } → Demucs with stem=none (we take vocals)
          //   { audio }                  → some audio models
          let outputUrl: string | null = null;
          if (typeof pred.output === "string") outputUrl = pred.output;
          else if (Array.isArray(pred.output) && pred.output.length > 0) outputUrl = pred.output[0] as string;
          else if (pred.output && typeof pred.output === "object") {
            const obj = pred.output as Record<string, unknown>;
            outputUrl = (obj.url || obj.vocals || obj.audio || obj.output) as string;
          }

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

            const charge = await chargeForGeneration({ userId: user.id, generationId, modelId });
            const costDisplay = `RM${(charge.totalCredits / 100).toFixed(2)}`;
            await finalizeGeneration(generationId, { status: "completed", outputUrl });
            return NextResponse.json({ status: "completed", outputUrl, actualCost: costDisplay });
          }

          await finalizeGeneration(generationId, { status: "failed", error: "No output received" });
          return NextResponse.json({ status: "failed", error: "No output received from Replicate" });
        }

        if (pred.status === "failed" || pred.status === "canceled") {
          const raw = (pred.error as string) || "Generation failed on Replicate";
          // Log the full prediction so we can see what Replicate actually complained about
          console.error("[Replicate] Prediction failed", JSON.stringify({
            status: pred.status,
            error: pred.error,
            input: pred.input,
            logs: (pred.logs as string)?.slice(-500),
          }));

          const isSeedance = modelId.startsWith("bytedance/seedance");

          // Translate common Replicate errors into plain-English toasts so the
          // user knows whether to tweak the prompt, swap inputs, or retry.
          let friendly = raw;
          if (/flagged as sensitive|E005|NSFW|safety|content policy|sensitive content/i.test(raw)) {
            friendly = isSeedance
              ? "Replicate's content scanner flagged one of your inputs before Seedance even ran. It's a known false-positive trigger on dark scenes, fashion / swimwear, athletic poses, and some portraits. Try swapping a different reference frame — or run the same S2E on Veo 3.1 Fast, which uses a different moderation pipeline."
              : "Blocked by the model's safety filter. The prompt or one of your reference images tripped it — try rephrasing or swapping a different reference.";
          } else if (/RESOURCE_EXHAUSTED|rate ?limit|429|quota/i.test(raw)) {
            friendly = "Model is rate-limited right now. Try again in a minute.";
          } else if (/timeout|timed out/i.test(raw)) {
            friendly = "The generation timed out. Try a shorter duration or lower resolution.";
          } else if (/input .*invalid|validation|unexpected keyword|unknown field/i.test(raw)) {
            // Surface the raw message — it names the specific field — so users
            // and we can actually tell what the model rejected instead of
            // guessing at aspect/resolution/duration.
            friendly = `The model rejected the input: ${raw.slice(0, 240)}`;
          }

          await finalizeGeneration(generationId, { status: "failed", error: friendly });
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
        await finalizeGeneration(generationId, { status: "failed", error: msg });
        return NextResponse.json({ status: "failed", error: msg });
      }
    }

    // --- Comfy Cloud polling (ComfyUI workflow on cloud.comfy.org) ---
    if (comfyVideo === "true") {
      if (!process.env.COMFY_CLOUD_API_KEY) {
        return NextResponse.json({ error: "Comfy Cloud API key not configured" }, { status: 500 });
      }
      try {
        const status = await getJobStatus(requestId);
        if (status === "completed") {
          const outputs = await getHistoryOutputs(requestId);
          const file = pickOutputFile(outputs);
          if (!file) {
            await finalizeGeneration(generationId, { status: "failed", error: "Comfy returned no output file" });
            return NextResponse.json({ status: "failed", error: "Comfy returned no output file" });
          }
          const { buffer, mimeType } = await downloadOutput(file);
          const { id: fileId } = await putFile(buffer, mimeType, user.id);
          const outputUrl = `${req.nextUrl.origin}/api/files/${fileId}`;

          await chargeForGeneration({ userId: user.id, generationId, modelId });
          await finalizeGeneration(generationId, { status: "completed", outputUrl });
          return NextResponse.json({ status: "completed", outputUrl });
        }
        if (status === "failed" || status === "cancelled") {
          const msg = status === "cancelled" ? "Generation was cancelled." : "Comfy workflow failed.";
          await finalizeGeneration(generationId, { status: "failed", error: msg });
          return NextResponse.json({ status: "failed", error: msg });
        }
        return NextResponse.json({
          status: "processing",
          log: status === "pending" ? "Queued on Comfy Cloud..." : "Running ComfyUI workflow...",
        });
      } catch (comfyErr) {
        const msg = comfyErr instanceof Error ? comfyErr.message : "Comfy status check failed";
        await finalizeGeneration(generationId, { status: "failed", error: msg });
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
