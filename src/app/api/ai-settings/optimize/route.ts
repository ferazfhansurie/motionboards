import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromToken, getUserAIInstruction } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/ai-settings/optimize
// Body: { prompts: string[] }  — prompts from generation items currently on the canvas
//
// Analyzes those prompts (the ones the user actually acted on, not the chat
// back-and-forth) and drafts an improved per-user AI instruction that will
// steer future prompt generations toward the user's demonstrated taste.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const prompts = (Array.isArray(body.prompts) ? body.prompts : [])
      .map((p: unknown) => (typeof p === "string" ? p.trim() : ""))
      .filter((p: string) => p.length > 0);

    if (prompts.length === 0) {
      return NextResponse.json(
        { error: "No generation prompts found on your canvas. Generate something first, then try optimizing." },
        { status: 400 }
      );
    }

    const currentInstruction = await getUserAIInstruction(user.id);

    // Trim total payload — keep newest N prompts, cap each at ~400 chars
    const capped = prompts.slice(-30).map((p: string) => p.slice(0, 400));

    const analysisPrompt = `You are analyzing the prompts a user has ACTUALLY USED for their AI generations on MotionBoards. These are the prompts they committed to — what they ran through Veo, Sora, Seedance, Nano Banana, etc.

Study them carefully and infer the user's taste:
- Average length (short one-liners? long multi-sentence?)
- Style preference (cinematic? anime? photorealistic? stylized?)
- Specific technical vocabulary they repeat (lens refs, camera bodies, lighting terms, aspect ratios)
- Tone (terse/technical? flowery/descriptive?)
- Any recurring themes (character descriptions, locations, shot types)
- Format: do they use bullet points, dividers, bold text — or plain prose?

Produce a SHORT custom system-instruction (max 8 lines, no markdown headings or dividers) that tells the AI Prompt Helper how to craft prompts for THIS user going forward so they match what the user is already making.

Current instruction (may be empty): ${currentInstruction || "(none)"}

Prompts the user has generated with (${capped.length} total, newest last):
${capped.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}

Respond with ONLY the new instruction text — no preamble, no explanation, no markdown formatting. Start with a line like "Keep prompts…" or "Always produce…"`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      temperature: 0.4,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const suggestion = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!suggestion) {
      return NextResponse.json({ error: "Could not generate a suggestion" }, { status: 500 });
    }

    return NextResponse.json({ instruction: suggestion, analyzed: capped.length });
  } catch (error) {
    console.error("Optimize AI settings error:", error);
    const msg = error instanceof Error ? error.message : "Failed to optimize";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
