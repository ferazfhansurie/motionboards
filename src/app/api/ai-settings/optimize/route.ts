import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromToken, listChats, getUserAIInstruction, type ChatMessageContent } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Convert multimodal content to plain text — we don't need images for the
// optimization pass, just the textual back-and-forth to infer preferences.
function flattenContent(content: ChatMessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join(" ");
}

// POST /api/ai-settings/optimize — analyze this user's past chats and generate
// an improved per-user AI instruction. Returns the suggestion; does NOT save
// it automatically — the user reviews and saves manually.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const [chats, currentInstruction] = await Promise.all([
      listChats(user.id),
      getUserAIInstruction(user.id),
    ]);

    if (chats.length === 0) {
      return NextResponse.json({ error: "No chat history yet. Start some conversations first." }, { status: 400 });
    }

    // Collect up to 50 recent turns across the most recent chats
    const transcript: string[] = [];
    let turns = 0;
    for (const chat of chats) {
      for (const msg of chat.messages) {
        if (turns >= 50) break;
        const text = flattenContent(msg.content).trim();
        if (!text) continue;
        transcript.push(`${msg.role === "user" ? "USER" : "AI"}: ${text}`);
        turns++;
      }
      if (turns >= 50) break;
    }

    const analysisPrompt = `You are analyzing a user's past conversations with an AI prompt-crafting assistant to infer how they prefer their prompts. Study what the user asked for, what they kept vs rejected, and any explicit style feedback they gave ("make it shorter", "no CGI", etc.).

Produce a SHORT custom system-instruction (max 8 lines, no markdown headings or dividers) that the AI should follow when crafting prompts for THIS user going forward. Focus on:
- Output length preference (compact? detailed?)
- Style preference (realistic? stylized? specific camera/lens?)
- Format preference (bullet points? plain paragraph? one sentence?)
- Anything to avoid (long headers, bold markdown, filler text, etc.)

Current instruction (may be empty): ${currentInstruction || "(none)"}

Past conversation excerpt (newest first):
${transcript.join("\n")}

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

    return NextResponse.json({ instruction: suggestion });
  } catch (error) {
    console.error("Optimize AI settings error:", error);
    const msg = error instanceof Error ? error.message : "Failed to optimize";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
