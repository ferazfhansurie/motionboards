import { NextRequest, NextResponse } from "next/server";
import { getSettings, createGeneration, updateGeneration, getUserFromToken, deductCredits } from "@/lib/db";
import { fal } from "@fal-ai/client";
import Replicate from "replicate";
import { models } from "@/lib/models";

export const maxDuration = 300;

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
    const { prompt, model: modelId, mode, inputImage, inputImages, startFrame, endFrame, inputAudio, generationOptions } = body;

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

    // All validation passed — start SSE stream for generation
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Client disconnected
          }
        };

        let generation: { id: string } | null = null;

        try {
          generation = await createGeneration({
            prompt: prompt || "",
            model: modelId,
            provider: modelInfo.provider,
            mode: mode || modelInfo.type,
            status: "processing",
            inputImage: inputImage ? "uploaded" : null,
            userId: user.id,
            creditCost,
          });

          send({ type: "started" });

          // Double-check credits right before calling AI provider (race condition guard)
          const freshUser = await getUserFromToken(token);
          if (!freshUser || freshUser.credits < creditCost) {
            await updateGeneration(generation.id, { status: "failed", error: "Insufficient credits", duration: 0 });
            send({ type: "error", error: "Insufficient credits. Please top up." });
            controller.close();
            return;
          }

          let outputUrl: string | null = null;

          if (modelInfo.provider === "fal") {
            if (!settings.falApiKey) {
              throw new Error("fal.ai API key not configured.");
            }

            fal.config({ credentials: settings.falApiKey });

            const input: Record<string, unknown> = {};

            // Apply generation options (aspect_ratio, duration, resolution, generate_audio, etc.)
            if (generationOptions && typeof generationOptions === "object") {
              for (const [key, value] of Object.entries(generationOptions)) {
                if (value !== undefined && value !== null && value !== "") {
                  input[key] = value;
                }
              }
            }

            // Model-driven input mapping — each input's `name` becomes the API parameter key
            const imageInputs = modelInfo.inputs.filter((i) => i.type === "image");
            const videoInputs = modelInfo.inputs.filter((i) => i.type === "video");
            const audioInputs = modelInfo.inputs.filter((i) => i.type === "audio");
            const textInputs = modelInfo.inputs.filter((i) => i.type === "text");
            const allImages = Array.isArray(inputImages) ? inputImages as string[] : [];

            // Text inputs — use the model's parameter name (e.g. "prompt" or "text")
            for (const inp of textInputs) {
              if (prompt && prompt.trim()) {
                input[inp.name] = prompt.trim();
              }
            }

            // Image inputs — map in order from inputRefs, with S2E start/end frame handling
            if (modelInfo.type === "s2e") {
              // S2E: map start/end frames by name convention
              for (const inp of imageInputs) {
                const n = inp.name.toLowerCase();
                if (n.includes("first") || n.includes("start")) {
                  if (startFrame) input[inp.name] = startFrame;
                } else if (n.includes("last") || n.includes("end")) {
                  if (endFrame) input[inp.name] = endFrame;
                } else if (inputImage) {
                  input[inp.name] = inputImage;
                }
              }
            } else {
              // Non-S2E: map images in order from inputRefs
              for (let idx = 0; idx < imageInputs.length; idx++) {
                const inp = imageInputs[idx];
                const n = inp.name.toLowerCase();
                // Handle array params (e.g. "image_urls" expects an array)
                if (inp.name.endsWith("_urls") || inp.name.endsWith("_images")) {
                  const urls = allImages.length > 0 ? allImages : (inputImage ? [inputImage] : []);
                  if (urls.length > 0) input[inp.name] = urls;
                } else if (n.includes("end") || n.includes("last")) {
                  // Optional end frame (e.g. end_image_url)
                  if (endFrame) input[inp.name] = endFrame;
                } else {
                  const src = allImages[idx] || (idx === 0 ? inputImage : null);
                  if (src) input[inp.name] = src;
                }
              }
            }

            // Video inputs — map from inputRefs (video items come through inputImage for first ref)
            for (const inp of videoInputs) {
              if (inputImage) input[inp.name] = inputImage;
            }

            // Audio inputs — map from audioInput
            for (const inp of audioInputs) {
              if (inputAudio) input[inp.name] = inputAudio;
            }

            // Face swap special handling
            if (modelId === "easel-ai/advanced-face-swap") {
              input.workflow_type = "user_hair";
              input.gender_0 = "non-binary";
            }

            const result = await fal.subscribe(modelId, {
              input,
              logs: true,
              onQueueUpdate: (update) => {
                const u = update as unknown as Record<string, unknown>;
                if (update.status === "IN_QUEUE") {
                  send({ type: "queued", position: u.queue_position ?? null });
                } else if (update.status === "IN_PROGRESS") {
                  const logs = u.logs as Array<{ message: string }> | undefined;
                  if (logs && logs.length > 0) {
                    const lastLog = logs[logs.length - 1];
                    send({ type: "log", message: lastLog.message });
                  } else {
                    send({ type: "processing" });
                  }
                }
              },
            });
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
              outputUrl = (data.target as Record<string, unknown>).url as string;
            } else if (data.model_mesh && typeof data.model_mesh === "object") {
              outputUrl = (data.model_mesh as Record<string, unknown>).url as string;
            } else if (data.speaker_embedding && typeof data.speaker_embedding === "object") {
              outputUrl = (data.speaker_embedding as Record<string, unknown>).url as string;
            } else if (data.output && typeof data.output === "string") {
              outputUrl = data.output;
            } else if (data.url && typeof data.url === "string") {
              outputUrl = data.url;
            }
          } else if (modelInfo.provider === "replicate") {
            if (!settings.replicateApiKey) {
              throw new Error("Replicate API token not configured.");
            }

            send({ type: "processing" });

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
            send({ type: "complete", data: updated });
          } else {
            // No output — don't charge
            const updated = await updateGeneration(generation.id, {
              status: "failed",
              error: "No output received from AI provider",
              duration,
            });
            send({ type: "complete", data: updated });
          }
        } catch (genError) {
          // Generation failed — don't charge
          const duration = (Date.now() - startTime) / 1000;
          const errorMsg = genError instanceof Error ? genError.message : "Generation failed";
          if (generation) {
            await updateGeneration(generation.id, {
              status: "failed",
              error: errorMsg,
              duration,
            });
          }
          send({ type: "error", error: errorMsg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong" },
      { status: 500 }
    );
  }
}
