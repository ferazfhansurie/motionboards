import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, getUserAIInstruction, setUserAIInstruction } from "@/lib/db";

// GET /api/ai-settings — return the signed-in user's custom AI instruction
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const instruction = await getUserAIInstruction(user.id);
    return NextResponse.json({ instruction });
  } catch (error) {
    console.error("Get AI settings error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

// PUT /api/ai-settings — save the signed-in user's custom AI instruction
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const instruction = typeof body.instruction === "string" ? body.instruction : "";
    // Cap length so a runaway instruction doesn't bloat every AI call
    const trimmed = instruction.slice(0, 4000);
    await setUserAIInstruction(user.id, trimmed);
    return NextResponse.json({ instruction: trimmed });
  } catch (error) {
    console.error("Save AI settings error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
