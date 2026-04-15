import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromToken, getUserAIInstruction } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Claude calls with attached images can take 20-40s; give the route headroom.
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
- 1–3 sentences for images, 2–4 for video.
- Default to hyper-realistic (real camera/lens refs, natural light, film grain) unless the user asks for stylized/animated.
- If they say "shorter", "simpler", "more compact" — cut hard.

Figure out which mode the user wants from context. Err toward conversational unless they're obviously requesting a prompt.`;

// Convert the OpenAI-shaped messages the client sends into Anthropic's format.
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

    // Keep last 10 messages for context
    const converted = (messages.slice(-10) as Array<{ role: "user" | "assistant"; content: string | ClientPart[] }>).map(convertMessage);

    // Per-account instruction gets appended — user's preference overrides defaults
    const userInstruction = await getUserAIInstruction(user.id);
    const systemPrompt = userInstruction
      ? `${BASE_SYSTEM_PROMPT}\n\n## USER PREFERENCES (follow these)\n${userInstruction}`
      : BASE_SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      temperature: 0.8,
      system: systemPrompt,
      messages: converted as Parameters<typeof anthropic.messages.create>[0]["messages"],
    });

    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n") || "Could not generate a response. Try again.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("AI prompt error:", error);
    const msg = error instanceof Error ? error.message : "AI prompt generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
