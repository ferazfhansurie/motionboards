import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromToken, getUserAIInstruction } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Base instruction — short on purpose. Output defaults to a compact prompt
// with no markdown formatting. Users can layer on their own preferences via
// the per-account AI instruction stored in mb_users.ai_instruction.
const BASE_SYSTEM_PROMPT = `You are ADletic AI — Prompt Helper. You help users craft short, copy-paste ready prompts for AI video and image generation models (Veo, Sora, Kling, Wan, Seedance, FLUX, Nano Banana).

When images are attached, reference what you see — subjects, composition, lighting, camera angle, setting — and work those specifics into the prompt.

DEFAULT OUTPUT STYLE:
- Return ONE compact prompt only. No titles, no headings, no dividers (---), no "Ready to use" footer.
- No markdown bold (**...**). Plain prose.
- 1–3 sentences for images, 2–4 sentences for video.
- Hyper-realistic by default: real camera/lens references, natural lighting, film grain, no CGI look — unless the user explicitly asks for stylized / animated.
- If the user says "make it shorter/simpler/more compact", cut aggressively.

Respond with the prompt and nothing else.`;

// Convert the OpenAI-shaped messages the client sends into Anthropic's format.
// Client sends:
//   { role: "user" | "assistant", content: string }
//   { role: "user", content: [ { type: "text", text }, { type: "image_url", image_url: { url } } ] }
//
// Anthropic expects:
//   { role: "user" | "assistant", content: string }
//   { role: "user", content: [ { type: "text", text }, { type: "image", source: {...} } ] }
//
// For image_url parts that are data: URLs (our client sends base64 data URLs),
// we convert to Anthropic's base64 image source shape. For http(s) URLs we use
// the url source variant.
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
  const parts: AnthropicMessage["content"] extends Array<infer U> ? U[] : never = [] as never;
  const out: AnthropicMessage["content"] = [];
  for (const p of m.content) {
    if (p.type === "text") {
      out.push({ type: "text", text: p.text });
    } else if (p.type === "image_url") {
      const url = p.image_url.url;
      // Data URL: data:<media_type>;base64,<data>
      const match = url.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        out.push({
          type: "image",
          source: { type: "base64", media_type: match[1], data: match[2] },
        });
      } else {
        out.push({ type: "image", source: { type: "url", url } });
      }
    }
  }
  // Silence unused variable warning (kept for type-narrowing hygiene)
  void parts;
  return { role: m.role, content: out };
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

    // Keep last 10 messages for context (same as before)
    const converted = (messages.slice(-10) as Array<{ role: "user" | "assistant"; content: string | ClientPart[] }>).map(convertMessage);

    // Per-account instruction gets appended — user's preference overrides defaults
    const userInstruction = await getUserAIInstruction(user.id);
    const systemPrompt = userInstruction
      ? `${BASE_SYSTEM_PROMPT}\n\n## USER PREFERENCES (follow these)\n${userInstruction}`
      : BASE_SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      // Claude Sonnet 4.5 — balanced multimodal model (3× Haiku price, noticeably smarter)
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      temperature: 0.8,
      system: systemPrompt,
      messages: converted as Parameters<typeof anthropic.messages.create>[0]["messages"],
    });

    // Concatenate text blocks from the response
    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n") || "Could not generate a prompt. Try again.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("AI prompt error:", error);
    const msg = error instanceof Error ? error.message : "AI prompt generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
