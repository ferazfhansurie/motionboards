import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromToken, getUserAIInstruction, getUserAIModel, getUserMcpConnectors } from "@/lib/db";
import { models } from "@/lib/models";
import { resolveChatModel } from "@/lib/chat-models";
import { toAnthropicTools } from "@/lib/agent-tools";

// Render the live model catalog as a compact reference Claude can quote
// from. Includes everything the user has on their picker — id, type,
// category, what each input slot expects, options. Disabled models are
// flagged so we don't recommend them.
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

// Lazy-init the SDK so a missing ANTHROPIC_API_KEY doesn't blow up at module
// load time. The route itself returns a 500 with a clear message if the key
// is absent — but at least the rest of the app isn't taken down with it.
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}
const ANTHROPIC_TOOLS = toAnthropicTools();

// Claude streaming over a long system prompt + image payloads can take
// 30-60s end to end. Headroom on Vercel Pro (300s ceiling).
export const maxDuration = 60;

const BASE_SYSTEM_PROMPT = `You are ADletic AI, a creative agent built into the MotionBoards canvas. The user talks to you in plain language and you actually run generations on their behalf using your start_generation tool.

You have access to every AI image / video / audio model wired into MotionBoards. Pick the right one for the user's intent, ask for any missing inputs in plain text, and call start_generation when you have everything needed.

## How to think about this

1. **Listen for intent.** "make a poster of …" → image. "animate that into a 5-second clip" → video. "build me a 12-panel storyboard" → image (use a multi-panel-capable model). "now turn this into …" usually means the user wants a follow-up generation building on a previous output.

2. **Pick the model.** Match the user's intent to a row in the catalog below. Prefer cheaper/faster models for iteration ("draft", "rough", "quick"); reach for premium ones for hero shots. If the user names a model ("use Veo", "with Nano Banana"), respect that — only override if the model can't do what they're asking.

3. **Check what the model needs.** Look at the model's inputs in the catalog. If it requires an image (i2i / i2v / s2e), check whether you've been given one. If not, ASK in plain text — "I need a starting image to animate. Drop one on the canvas or paste a URL." Don't call the tool until you have it.

4. **Call start_generation.** Once you have a clear prompt and any required inputs, call the tool. The user sees a **review card** in chat with your proposed model + prompt and Generate / Edit / Cancel buttons. The actual generation only starts after they approve — so don't ask "should I generate?" first; just propose. You'll get the result (output_url or error) as a tool_result. Cancellation also comes back as a tool_result — handle it gracefully.

5. **Suggest next steps.** After a successful generation, briefly point out what they could do next ("Want to animate this with Veo?" "Want a 4K version?" "Ready to chain into a video?"). Keep it short.

## Timeline tools

You can also sequence videos already on the canvas into an edited clip using timeline tools: timeline_add_clip, timeline_trim_clip, timeline_reorder_clip, timeline_split_clip, timeline_remove_clip. Use these when the user wants to build an edited sequence, not just generate individual clips — e.g. "cut these three together," "trim the start of this," "put the intro before the product shot." A CURRENT TIMELINE block (if present) below shows what's already sequenced — read it before adding or reordering so you don't duplicate or misplace clips. Unlike start_generation these run immediately, no review card — they're free and reversible.

Two more tools let you actually look at and listen to footage before editing it, since you can't watch video directly: timeline_probe_clip grabs a single frame as an image URL, timeline_transcribe_clip returns a timestamped transcript. Use them before trimming/cutting a clip you haven't examined yet, or when the user references something in the footage you can't know from the prompt alone (e.g. "cut right before she starts talking").

## Conversation style

- Be direct and brief. No "Happy to help!" filler. No long preambles before tool calls — a one-line intent ("Going with Nano Banana 2 for this — review the prompt below.") is plenty before calling the tool.
- The review card replaces "asking permission" — propose with your best prompt and let the user tweak. Don't second-guess yourself out loud.
- If the request is ambiguous (e.g. "make me an ad"), ask ONE clarifying question, not five. "Image or video? What's the product?"
- For prompts: use real, specific descriptions (camera/lens for photoreal, art direction for stylized). Plain prose, no markdown formatting INSIDE the prompt itself.
- For multi-panel storyboards: explicit panel breaks with blank lines between them in the prompt.
- After tool_result, summarize in 1-2 lines max. Don't restate the obvious.
- If a tool_result reports the user cancelled, don't argue or recap — ask what to change ("Different angle? Different model?") in one short line.

## When NOT to use the tool

- The user is just chatting / asking questions / brainstorming with no clear "make it now" intent.
- The user is asking you HOW something works (educate them, don't generate).
- A required input is missing — ask first.
- The model they want is marked DISABLED in the catalog.

## MODEL CATALOG (live)

${MODEL_CATALOG}`;

// Client sends OpenAI-shaped parts (text + image_url) — we keep that
// contract for backward compatibility. Translate to Anthropic shape on
// the way through.
type ClientPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string | unknown[]; // string, or an array of content blocks (e.g. image + text)
  is_error?: boolean;
};

type ChatMessage = {
  role: "user" | "assistant";
  // user can send strings, OpenAI-shaped parts (text+image), OR tool results
  // assistant can send strings OR an array of text + tool_use blocks
  content:
    | string
    | ClientPart[]
    | (Anthropic.ContentBlockParam | ToolUseBlock | ToolResultBlock)[];
};

function toAnthropicContent(content: ChatMessage["content"]): string | Anthropic.ContentBlockParam[] {
  if (typeof content === "string") return content;
  const out: Anthropic.ContentBlockParam[] = [];
  for (const part of content) {
    const p = part as Record<string, unknown>;
    const t = p.type as string;
    if (t === "text") {
      out.push({ type: "text", text: p.text as string });
    } else if (t === "image_url" && p.image_url) {
      const url = (p.image_url as { url: string }).url;
      if (url) out.push({ type: "image", source: { type: "url", url } });
    } else if (t === "tool_use") {
      out.push({
        type: "tool_use",
        id: p.id as string,
        name: p.name as string,
        input: (p.input as Record<string, unknown>) ?? {},
      });
    } else if (t === "tool_result") {
      out.push({
        type: "tool_result",
        tool_use_id: p.tool_use_id as string,
        content: p.content as Anthropic.ToolResultBlockParam["content"],
        is_error: (p.is_error as boolean) || undefined,
      });
    } else if (t === "image" && p.source) {
      out.push(part as Anthropic.ContentBlockParam);
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

    const { messages, mediaContext, timelineContext, extraTools } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    // Page-specific tools (e.g. the FatHopes gallery's find_media / view_media).
    // Declarations only — execution is entirely client-side. Merged on top of
    // the shared registry so the canvas agent is unaffected when none are sent.
    type ExtraTool = { name: string; description?: string; input_schema: Record<string, unknown> };
    const mergedTools = [
      ...ANTHROPIC_TOOLS,
      ...(Array.isArray(extraTools)
        ? (extraTools as ExtraTool[])
            .filter((t) => t && typeof t.name === "string" && t.input_schema)
            .slice(0, 8)
            .map((t) => ({ name: t.name, description: String(t.description || ""), input_schema: t.input_schema }))
        : []),
    ];

    // Trim to last 20 messages — generous, since tool_use/tool_result pairs
    // can chain through several turns and we don't want to lose context.
    const history = (messages.slice(-20) as ChatMessage[]);

    const [userInstruction, userModel, userMcpConnectors] = await Promise.all([
      getUserAIInstruction(user.id),
      getUserAIModel(user.id),
      getUserMcpConnectors(user.id),
    ]);
    const chatModel = resolveChatModel(userModel);

    // Translate the user's enabled MCP connectors into the Anthropic
    // `mcp_servers` payload shape. The SDK doesn't type this field yet on
    // the standard messages.stream() — we attach it via a typed cast and
    // pass `anthropic-beta: mcp-client-2025-04-04` as an extra header so
    // the API accepts it. Disabled connectors are filtered out so a user
    // can park-and-toggle without removing entries.
    type AnthropicMcpServer = {
      type: "url";
      url: string;
      name: string;
      authorization_token?: string;
    };
    const mcpServers: AnthropicMcpServer[] = userMcpConnectors
      .filter((c) => c.enabled && /^https:\/\//i.test(c.url))
      .map((c) => ({
        type: "url" as const,
        url: c.url,
        // Anthropic wants names lower-snake-case-ish (alphanumeric + _-.).
        // Normalise so a user-friendly "Higgsfield · Personal" still works.
        name: c.name.toLowerCase().replace(/[^a-z0-9_.\-]+/g, "_").slice(0, 64) || "mcp",
        ...(c.authorizationToken ? { authorization_token: c.authorizationToken } : {}),
      }));

    // System blocks. The big BASE_SYSTEM_PROMPT (with model catalog) is
    // identical for every user and every request — mark its tail with
    // cache_control so Claude caches it. Per-user instruction goes in a
    // separate block AFTER the cache breakpoint so per-user variation
    // doesn't invalidate the shared cache.
    const systemBlocks: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: BASE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ];
    // Optional caller-supplied context (e.g. the FatHopes gallery sends its
    // full media library so the agent can recall items and use their URLs as
    // generation inputs). Cached separately so multi-turn chats reuse it.
    if (typeof mediaContext === "string" && mediaContext.trim()) {
      systemBlocks.push({
        type: "text",
        text: mediaContext.slice(0, 80000),
        cache_control: { type: "ephemeral" },
      });
    }
    // Current timeline edit state — distinct from mediaContext (which is a
    // library of media). Not cached: it changes on every clip mutation, so
    // caching it would invalidate on nearly every request anyway.
    if (typeof timelineContext === "string" && timelineContext.trim()) {
      systemBlocks.push({
        type: "text",
        text: timelineContext.slice(0, 20000),
      });
    }
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

    // Build the stream args. mcp_servers is only included when the user
    // has at least one enabled connector — keeps requests for users who
    // don't use connectors identical to the previous (cache-friendly)
    // shape.
    const streamArgs: Record<string, unknown> = {
      model: chatModel,
      max_tokens: 4096,
      system: systemBlocks,
      tools: mergedTools,
      messages: anthMessages,
    };
    const streamOptions: Record<string, unknown> = {};
    if (mcpServers.length > 0) {
      streamArgs.mcp_servers = mcpServers;
      streamOptions.headers = { "anthropic-beta": "mcp-client-2025-04-04" };
    }
    const stream = getAnthropic().messages.stream(
      streamArgs as Parameters<Anthropic["messages"]["stream"]>[0],
      streamOptions,
    );

    const encoder = new TextEncoder();

    // Stream NDJSON: one event per line, each line a JSON object. Event
    // types the client cares about:
    //   {type:"text", text:"…"}                 — text delta
    //   {type:"tool_use", id, name, input}      — finalized tool call
    //   {type:"end", stop_reason:"tool_use"|"end_turn"|…}
    //   {type:"error", message}
    //
    // The stream API gives us per-event callbacks; we accumulate tool_use
    // input deltas server-side (they arrive as partial JSON) and only emit
    // the finalized tool_use once the block ends.
    const body = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        };
        try {
          stream.on("text", (delta: string) => {
            send({ type: "text", text: delta });
          });
          stream.on("contentBlock", (block) => {
            if (block.type === "tool_use") {
              send({
                type: "tool_use",
                id: block.id,
                name: block.name,
                input: block.input,
              });
            }
          });
          const finalMsg = await stream.finalMessage();
          send({ type: "end", stop_reason: finalMsg.stop_reason });
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
          send({ type: "error", message: msg });
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
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
