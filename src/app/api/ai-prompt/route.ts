import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromToken, getUserAIInstruction, getUserAIModel } from "@/lib/db";
import { models } from "@/lib/models";
import { resolveChatModel } from "@/lib/chat-models";

// Render the live model catalog as a compact reference the chat model can
// quote from. Includes everything the user actually has on their picker —
// id, type, what category, what each input slot expects, what options the
// model accepts. Disabled models get marked so we don't recommend them.
function buildModelCatalog(): string {
  const lines: string[] = [];
  for (const m of models) {
    const inputs = m.inputs
      .map((i) => `${i.name} (${i.type}${i.required ? ", required" : ""}): ${i.description}`)
      .join(" | ");
    const opts = m.options
      ? Object.entries(m.options)
          .map(([k, v]) => {
            if ("values" in v) return `${k}=${v.values.join("/")} default ${v.default}`;
            return `${k} toggle (default ${v.default})`;
          })
          .join(", ")
      : "";
    lines.push(
      `- ${m.name} [id: ${m.id}] — ${m.category}/${m.type} via ${m.provider}, ${m.cost}, ~${m.speed}${m.disabled ? " (DISABLED — not available)" : ""}\n` +
      `  Inputs: ${inputs}\n` +
      (opts ? `  Options: ${opts}\n` : "") +
      `  ${m.description}`
    );
  }
  return lines.join("\n");
}
const MODEL_CATALOG = buildModelCatalog();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Claude streaming over a long system prompt + image payloads can take
// ~30-60s end to end. Give the route headroom on Vercel Pro (300s ceiling).
export const maxDuration = 60;

// ADletic AI is a general-purpose assistant inside MotionBoards. It can hold
// normal conversations, answer questions, brainstorm, explain things — AND it
// specializes in crafting AI-generation prompts (Veo, Sora, Kling, Wan,
// Seedance, FLUX, Nano Banana, etc) when that's what the user wants. It does
// NOT generate on the user's behalf — the user drives generation from the
// canvas prompt bar.
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
- For SINGLE shots: 1–3 sentences for images, 2–4 for video, all in one paragraph.
- For MULTI-shot / storyboards / panel sequences: split each shot/panel onto its own paragraph with a BLANK LINE between them. Hard line breaks between panels — never run a 12-panel storyboard as one wall of text. Example layout:
    Panel 1: [description].

    Panel 2: [description].

    Panel 3: [description].
- Default to hyper-realistic (real camera/lens refs, natural light, film grain) unless the user asks for stylized/animated.
- If they say "shorter", "simpler", "more compact" — cut hard.

Figure out which mode the user wants from context. Err toward conversational unless they're obviously requesting a prompt.

## MODEL CATALOG (live — pulled from the user's picker)

You know exactly which models are wired up on this MotionBoards instance and what each one needs. When a user picks a model, asks "what does X take?", or you're crafting a prompt for a specific model, use this list as your source of truth. Don't invent fields the model doesn't have. Don't recommend a DISABLED model.

If the user asks "what should I tag for [model]?", answer using the input list — name the slot (e.g. "tag a still image as the character_image input") and what each slot expects. If they ask for a prompt, tailor the wording to the model's strengths and accepted options (aspect ratio, duration, resolution).

${MODEL_CATALOG}`;

// Client sends OpenAI-shaped parts (text + image_url) — keep that contract so
// the front-end doesn't have to change. We translate to Anthropic shape on
// the server: image_url → {type: "image", source: {type: "url", url}}.
type ClientPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMessage = {
  role: "user" | "assistant";
  content: string | ClientPart[];
};

function toAnthropicContent(content: string | ClientPart[]): string | Anthropic.ContentBlockParam[] {
  if (typeof content === "string") return content;
  const out: Anthropic.ContentBlockParam[] = [];
  for (const part of content) {
    if (part.type === "text") {
      out.push({ type: "text", text: part.text });
    } else if (part.type === "image_url" && part.image_url?.url) {
      out.push({
        type: "image",
        source: { type: "url", url: part.image_url.url },
      });
    }
  }
  return out;
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

    // Keep last 10 messages for context.
    const history = (messages.slice(-10) as ChatMessage[]);

    // Per-account instruction + model picker — user's preferences override defaults.
    const [userInstruction, userModel] = await Promise.all([
      getUserAIInstruction(user.id),
      getUserAIModel(user.id),
    ]);
    // resolveChatModel falls back to DEFAULT_CHAT_MODEL if user hasn't picked
    // one, or if the stored value isn't in the allow-list (e.g. an old OpenAI
    // model id from before the Claude swap).
    const chatModel = resolveChatModel(userModel);

    // System blocks. The big BASE_SYSTEM_PROMPT (with the model catalog) is
    // identical for every user and every request — we mark its tail with
    // cache_control so Claude caches it. Subsequent requests pay ~10% of the
    // base input cost on that ~5-15K token prefix instead of full price. The
    // per-user instruction goes in a SEPARATE block after the cache breakpoint
    // so per-user variation doesn't invalidate the shared cache.
    const systemBlocks: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: BASE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ];
    if (userInstruction) {
      systemBlocks.push({
        type: "text",
        text: `## USER PREFERENCES (follow these)\n${userInstruction}`,
      });
    }

    const anthMessages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role,
      content: toAnthropicContent(m.content),
    }));

    const stream = anthropic.messages.stream({
      model: chatModel,
      max_tokens: 2048,
      system: systemBlocks,
      messages: anthMessages,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          // Stream just the text deltas to the client. Other event types
          // (content_block_start, message_delta, etc) carry metadata we don't
          // need to forward — the client renders raw text.
          stream.on("text", (delta: string) => {
            controller.enqueue(encoder.encode(delta));
          });
          await stream.finalMessage();
          controller.close();
        } catch (streamErr) {
          let msg = "stream failed";
          if (streamErr instanceof Anthropic.RateLimitError) {
            msg = "Rate limited. Try again in a moment.";
          } else if (streamErr instanceof Anthropic.APIError) {
            msg = streamErr.message || `Claude error ${streamErr.status}`;
          } else if (streamErr instanceof Error) {
            msg = streamErr.message;
          }
          controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("AI prompt error:", error);
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 500 });
    }
    const msg = error instanceof Error ? error.message : "AI prompt generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
