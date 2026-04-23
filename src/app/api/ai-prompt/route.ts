import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserFromToken, getUserAIInstruction } from "@/lib/db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// OpenAI calls with attached images can take 20–40s; give the route headroom.
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

// The client already sends OpenAI-shaped parts (text + image_url), so we just
// pass them through to chat.completions after a shallow type cast.
type ClientPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMessage = {
  role: "user" | "assistant";
  content: string | ClientPart[];
};

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    // Keep last 10 messages for context.
    const history = (messages.slice(-10) as ChatMessage[]);

    // Per-account instruction gets appended — user's preference overrides defaults.
    const userInstruction = await getUserAIInstruction(user.id);
    const systemPrompt = userInstruction
      ? `${BASE_SYSTEM_PROMPT}\n\n## USER PREFERENCES (follow these)\n${userInstruction}`
      : BASE_SYSTEM_PROMPT;

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      stream: true,
      temperature: 0.8,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({
          role: m.role,
          content: m.content,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        })) as any,
      ],
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
          controller.close();
        } catch (streamErr) {
          const msg = streamErr instanceof Error ? streamErr.message : "stream failed";
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
    const msg = error instanceof Error ? error.message : "AI prompt generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
