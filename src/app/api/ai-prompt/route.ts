import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromToken, getUserAIInstruction } from "@/lib/db";
import { models } from "@/lib/models";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ADletic AI is a general-purpose assistant inside MotionBoards. It can hold
// normal conversations, answer questions, brainstorm, explain things — AND it
// specializes in crafting AI-generation prompts (Veo, Sora, Kling, Wan,
// Seedance, FLUX, Nano Banana, etc) when that's what the user wants.
const BASE_SYSTEM_PROMPT = `You are ADletic AI, a helpful assistant built into the MotionBoards creative canvas. You're having a normal conversation with the user — they can ask you anything: questions, brainstorming, explanations, debugging, writing help, casual chat.

You also happen to be a great prompt engineer for AI image and video generation models (Veo, Sora, Kling, Wan, Seedance, FLUX, Nano Banana, etc). When the user asks for a prompt, or is clearly describing a scene they want to generate, switch into prompt-crafting mode.

General conversation rules:
- Be direct and helpful. Match the user's tone — casual when they're casual, precise when they want detail.
- Don't pad responses. No unnecessary preambles, disclaimers, or "happy to help!" filler.
- Use markdown where it clarifies (code blocks, lists, bold for emphasis) but don't force structure on short answers.
- If they attach images, describe what you see and work with it.

Prompt-crafting mode (when the user is clearly asking for a generation prompt):
- Return ONE compact prompt only. No titles, no headings, no "---" dividers, no "Ready to use" footer.
- No markdown formatting in the prompt itself — plain prose, copy-paste ready.
- 1–3 sentences for images, 2–4 for video.
- Default to hyper-realistic (real camera/lens refs, natural light, film grain) unless the user asks for stylized/animated.
- If they say "shorter", "simpler", "more compact" — cut hard.

## GENERATION TOOLS
You have tools to actually generate images and videos on the user's canvas:
- \`generate_image\` — creates an AI image and places it on the canvas
- \`generate_video\` — starts an AI video generation; the processing card appears on the canvas immediately and finishes in 2–5 minutes

STRICT RULES FOR TOOL USE:
1. ONLY use these tools when the user explicitly asks to generate, create, or make something (e.g. "generate a video of X", "make me an image of Y", "create this"). Do NOT use them for examples, demos, illustrations, or unsolicited suggestions.
2. If the user is just asking for a prompt, brainstorming, or discussing ideas — do NOT call the tool. Give them a text prompt instead.
3. When in doubt, ASK the user: "Want me to actually generate this, or just give you the prompt?"
4. When you do call a tool, briefly confirm what you're generating in your reply so the user knows. Example: "Generating a 720p cinematic shot of a cat…"

## MODEL CATALOG (use the right tool parameters for each)

### Image models (tool: generate_image)
- \`gemini-3.1-flash-image-preview\` (Nano Banana 2) — the only image model. Supports aspect_ratio: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16, 4:1, 1:4, 8:1, 1:8. Supports resolution: 0.5K, 1K, 2K, 4K (default 1K). Default aspect_ratio is "auto".

### Video models (tool: generate_video — must pass model id)

Veo 3.1 (direct Google Gemini API — audio is ALWAYS ON, cannot be disabled):
- \`veo-3.1-fast-generate-preview\` — T2V (text only). aspect_ratio: 16:9 or 9:16. duration: 4s, 6s, 8s. resolution: 720p, 1080p, 4k. Note: 1080p and 4k REQUIRE duration=8s.
- \`veo-3.1-fast-generate-preview/i2v\` — I2V (needs image_url). Same options as above BUT duration MUST be 8s (reference image forces 8s).
- \`veo-3.1-fast-generate-preview/s2e\` — Start→End frame (needs first_frame_url AND last_frame_url). duration MUST be 8s.
- \`veo-3.1-lite-generate-preview\` — T2V cheapest Veo. NO 4K support. aspect_ratio: 16:9 or 9:16. duration: 4s, 6s, 8s. resolution: 720p or 1080p only.
- \`veo-3.1-lite-generate-preview/i2v\` — I2V (needs image_url). duration MUST be 8s.

Seedance 2.0 (ByteDance via Replicate — audio is TOGGLEABLE):
- \`bytedance/seedance-2.0\` — T2V. aspect_ratio: 16:9, 9:16, 4:3, 3:4, 1:1, 21:9. duration: 4s, 5s, 6s, 8s, 10s. resolution: 480p or 720p (NO 1080p/4k). Can toggle generate_audio.
- \`bytedance/seedance-2.0/i2v\` — I2V (needs image_url as first frame). Same options as above.
- \`bytedance/seedance-2.0/s2e\` — Start→End frame (needs first_frame_url + last_frame_url). Same options.

Sora 2 Pro (OpenAI — audio ALWAYS ON):
- \`sora-2-pro\` — T2V. aspect_ratio: 16:9 or 9:16. duration: 4s, 8s, 12s.
- \`sora-2-pro/i2v\` — I2V (needs image_url).

### PICKING A MODEL
- If the user mentions specific models, honor it.
- If they want start AND end frame interpolation → use a \`/s2e\` variant (Veo 3.1 Fast or Seedance 2.0).
- If they give one image → use the \`/i2v\` variant of whichever video model fits best.
- If they just want text-to-video with audio → default to \`veo-3.1-fast-generate-preview\` (best balance of quality/price).
- If they want cheapest → \`veo-3.1-lite-generate-preview\`.
- If they want a silent video or need multimodal features → \`bytedance/seedance-2.0\` with generate_audio=false.
- Only use Sora 2 Pro if the user asks for Sora specifically.

### REQUIREMENTS VALIDATION
Before calling the tool, make sure the parameters you're about to pass are valid for the chosen model. If the user wants something that breaks a constraint (e.g. 4K at 4s on Veo Fast), EITHER adjust to a valid combination OR ask the user which constraint to relax. Never call the tool with an invalid combo.

### IMAGE INPUTS
The tools accept image_url / first_frame_url / last_frame_url as http(s) URLs. If the user has images on their canvas they want to use, ask them which ones — or if they pasted images into the chat, those are already uploaded and you can use their URLs as inputs.

Figure out which mode the user wants from context. Err toward conversational unless they're obviously requesting a prompt or generation.`;

type ClientPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type AnthropicMessage = {
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | {
            type: "image";
            source:
              | { type: "base64"; media_type: string; data: string }
              | { type: "url"; url: string };
          }
      >;
};

function convertMessage(m: { role: "user" | "assistant"; content: string | ClientPart[] }): AnthropicMessage {
  if (typeof m.content === "string") return { role: m.role, content: m.content };
  const out: AnthropicMessage["content"] = [];
  for (const p of m.content) {
    if (p.type === "text") {
      out.push({ type: "text", text: p.text });
    } else if (p.type === "image_url") {
      const url = p.image_url.url;
      const match = url.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        out.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
      } else {
        out.push({ type: "image", source: { type: "url", url } });
      }
    }
  }
  return { role: m.role, content: out };
}

// Tool definitions — Claude picks a model from the allowed list based on what
// the user asked for. We keep the list small and descriptive so the model
// doesn't have to guess between 10 near-identical options.
const imageModelIds = ["gemini-3.1-flash-image-preview"] as const;
const videoModelIds = [
  "veo-3.1-fast-generate-preview",
  "veo-3.1-fast-generate-preview/i2v",
  "veo-3.1-lite-generate-preview",
  "bytedance/seedance-2.0",
  "bytedance/seedance-2.0/i2v",
  "sora-2-pro",
  "sora-2-pro/i2v",
] as const;

const videoModelIdsWithS2E = [...videoModelIds, "veo-3.1-fast-generate-preview/s2e", "bytedance/seedance-2.0/s2e"] as const;

const tools: Anthropic.Tool[] = [
  {
    name: "generate_image",
    description:
      "Generate an AI image (Nano Banana 2) and place it on the user's canvas. USE ONLY when the user explicitly asks to generate/create/make an image.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The image generation prompt (plain prose, no markdown)." },
        aspect_ratio: {
          type: "string",
          enum: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"],
          description: "Aspect ratio. Defaults to auto.",
        },
        resolution: {
          type: "string",
          enum: ["0.5K", "1K", "2K", "4K"],
          description: "Output resolution. Defaults to 1K.",
        },
        image_urls: {
          type: "array",
          items: { type: "string" },
          description: "Optional reference image URLs for editing/remixing existing images.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_video",
    description:
      "Start an AI video generation and place a processing card on the user's canvas. USE ONLY when the user explicitly asks to generate/create/make a video. The card appears immediately and finishes in 2–5 minutes. IMPORTANT: make sure the parameters match the chosen model's supported options (see the MODEL CATALOG in the system prompt). If the user's request violates a constraint, either adjust or ask which constraint to relax.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The video generation prompt (plain prose, no markdown)." },
        model: {
          type: "string",
          enum: [...videoModelIdsWithS2E],
          description:
            "Model ID. Pick based on what the user wants. Use the /i2v suffix for image-to-video, /s2e suffix for start-to-end-frame interpolation.",
        },
        aspect_ratio: {
          type: "string",
          enum: ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"],
          description: "Aspect ratio. Veo and Sora only support 16:9 / 9:16. Seedance supports all of these.",
        },
        duration: {
          type: "string",
          enum: ["4s", "5s", "6s", "8s", "10s", "12s"],
          description:
            "Clip length. Constraints: Veo 1080p/4k REQUIRES 8s. Veo /i2v and /s2e REQUIRE 8s. Seedance supports 4-10s. Sora supports 4/8/12s.",
        },
        resolution: {
          type: "string",
          enum: ["480p", "720p", "1080p", "4k"],
          description:
            "Output resolution. Veo: 720p / 1080p / 4k (lite no 4k, 1080p+4k need 8s). Seedance: 480p / 720p only. Sora: use default (don't set this for Sora).",
        },
        generate_audio: {
          type: "boolean",
          description: "ONLY valid for Seedance — default true. Veo and Sora always generate audio (not toggleable).",
        },
        image_url: {
          type: "string",
          description: "For /i2v models: URL of the starting frame image. Required when model ends with /i2v.",
        },
        first_frame_url: {
          type: "string",
          description: "For /s2e models: URL of the FIRST frame image. Required when model ends with /s2e.",
        },
        last_frame_url: {
          type: "string",
          description: "For /s2e models: URL of the LAST frame image. Required when model ends with /s2e.",
        },
      },
      required: ["prompt", "model"],
    },
  },
];

// Generated-item info we return to the client so it can add cards to the canvas.
interface GeneratedItem {
  type: "generation";
  outputType: "image" | "video";
  status: "completed" | "processing";
  prompt: string;
  model: string;
  modelName: string;
  outputUrl?: string;
  // Async video job tracking — client uses existing polling infra
  requestId?: string;
  geminiVideo?: boolean;
  openaiVideo?: boolean;
  replicateVideo?: boolean;
  creditCost?: number;
  width?: number;
  height?: number;
}

// Execute a tool call by delegating to /api/generate internally. We forward
// the session cookie so credit/auth checks still apply.
async function executeGeneration(
  origin: string,
  sessionToken: string,
  params: {
    model: string;
    prompt: string;
    aspect_ratio?: string;
    duration?: string;
    resolution?: string;
    generate_audio?: boolean;
    image_url?: string;
    first_frame_url?: string;
    last_frame_url?: string;
    image_urls?: string[];
  }
): Promise<{ ok: true; item: GeneratedItem } | { ok: false; error: string }> {
  const modelInfo = models.find((m) => m.id === params.model);
  if (!modelInfo) return { ok: false, error: `Unknown model: ${params.model}` };

  const generationOptions: Record<string, unknown> = {};
  if (params.aspect_ratio) generationOptions.aspect_ratio = params.aspect_ratio;
  if (params.duration) generationOptions.duration = params.duration;
  if (params.resolution) generationOptions.resolution = params.resolution;
  if (typeof params.generate_audio === "boolean") generationOptions.generate_audio = params.generate_audio;

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    model: params.model,
    generationOptions,
  };
  // Map the optional inputs to match what /api/generate expects
  if (params.image_url) body.inputImage = params.image_url;
  if (params.first_frame_url) body.startFrame = params.first_frame_url;
  if (params.last_frame_url) body.endFrame = params.last_frame_url;
  if (Array.isArray(params.image_urls) && params.image_urls.length > 0) {
    body.inputImages = params.image_urls;
  }

  const res = await fetch(`${origin}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session=${sessionToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, error: (data.error as string) || "Generation failed" };
  }

  const isVideo = ["t2v", "i2v", "s2e"].includes(modelInfo.type);
  const outputType: "image" | "video" = isVideo ? "video" : "image";

  // Synchronous result (Gemini image, Segmind, Fish)
  if (data.status === "completed" && typeof data.outputUrl === "string") {
    return {
      ok: true,
      item: {
        type: "generation",
        outputType,
        status: "completed",
        prompt: params.prompt,
        model: params.model,
        modelName: modelInfo.name,
        outputUrl: data.outputUrl,
        creditCost: modelInfo.creditCost,
      },
    };
  }

  // Async result — video job submitted, client needs to poll
  if (data.status === "processing" && typeof data.requestId === "string") {
    return {
      ok: true,
      item: {
        type: "generation",
        outputType,
        status: "processing",
        prompt: params.prompt,
        model: params.model,
        modelName: modelInfo.name,
        requestId: data.requestId as string,
        geminiVideo: data.geminiVideo === true,
        openaiVideo: data.openaiVideo === true,
        replicateVideo: data.replicateVideo === true,
        creditCost: modelInfo.creditCost,
      },
    };
  }

  return { ok: false, error: "Unexpected generation response" };
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const converted = (messages.slice(-10) as Array<{ role: "user" | "assistant"; content: string | ClientPart[] }>).map(convertMessage);

    const userInstruction = await getUserAIInstruction(user.id);
    const systemPrompt = userInstruction
      ? `${BASE_SYSTEM_PROMPT}\n\n## USER PREFERENCES (follow these)\n${userInstruction}`
      : BASE_SYSTEM_PROMPT;

    // We keep a running conversation so tool_use → tool_result can loop
    const conversation: AnthropicMessage[] = [...converted];
    const generatedItems: GeneratedItem[] = [];
    let finalText = "";

    // At most 3 tool-use rounds per turn to prevent runaway loops
    for (let round = 0; round < 3; round++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        temperature: 0.8,
        system: systemPrompt,
        tools,
        messages: conversation as Parameters<typeof anthropic.messages.create>[0]["messages"],
      });

      // If Claude is done (produced text, not requesting tools), capture and stop
      if (response.stop_reason !== "tool_use") {
        finalText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        break;
      }

      // Execute each tool_use Claude requested this round
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }> = [];

      for (const tool of toolUses) {
        const input = tool.input as Record<string, unknown>;
        try {
          if (tool.name === "generate_image") {
            const result = await executeGeneration(req.nextUrl.origin, token, {
              model: imageModelIds[0], // currently only Nano Banana 2
              prompt: String(input.prompt || ""),
              aspect_ratio: input.aspect_ratio as string | undefined,
              resolution: input.resolution as string | undefined,
              image_urls: input.image_urls as string[] | undefined,
            });
            if (result.ok) {
              generatedItems.push(result.item);
              toolResults.push({
                type: "tool_result",
                tool_use_id: tool.id,
                content: `Image generation started on the canvas. Model: ${result.item.modelName}. Prompt: "${result.item.prompt}". The user will see it appear shortly.`,
              });
            } else {
              toolResults.push({
                type: "tool_result",
                tool_use_id: tool.id,
                content: `Generation failed: ${result.error}`,
                is_error: true,
              });
            }
          } else if (tool.name === "generate_video") {
            const result = await executeGeneration(req.nextUrl.origin, token, {
              model: String(input.model || "veo-3.1-fast-generate-preview"),
              prompt: String(input.prompt || ""),
              aspect_ratio: input.aspect_ratio as string | undefined,
              duration: input.duration as string | undefined,
              resolution: input.resolution as string | undefined,
              generate_audio: typeof input.generate_audio === "boolean" ? input.generate_audio : undefined,
              image_url: input.image_url as string | undefined,
              first_frame_url: input.first_frame_url as string | undefined,
              last_frame_url: input.last_frame_url as string | undefined,
            });
            if (result.ok) {
              generatedItems.push(result.item);
              toolResults.push({
                type: "tool_result",
                tool_use_id: tool.id,
                content: `Video generation started. Model: ${result.item.modelName}. Prompt: "${result.item.prompt}". A processing card has been added to the canvas and will finish in 2–5 minutes.`,
              });
            } else {
              toolResults.push({
                type: "tool_result",
                tool_use_id: tool.id,
                content: `Video generation failed: ${result.error}`,
                is_error: true,
              });
            }
          } else {
            toolResults.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: `Unknown tool: ${tool.name}`,
              is_error: true,
            });
          }
        } catch (toolErr) {
          const msg = toolErr instanceof Error ? toolErr.message : "Tool execution failed";
          toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: msg, is_error: true });
        }
      }

      // Append assistant's tool-use turn, then user's tool-result turn, loop again
      conversation.push({ role: "assistant", content: response.content } as unknown as AnthropicMessage);
      conversation.push({ role: "user", content: toolResults as unknown as AnthropicMessage["content"] });
    }

    if (!finalText) {
      finalText = generatedItems.length > 0
        ? "Done — check the canvas."
        : "Could not generate a response. Try again.";
    }

    return NextResponse.json({ reply: finalText, generatedItems });
  } catch (error) {
    console.error("AI prompt error:", error);
    const msg = error instanceof Error ? error.message : "AI prompt generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
