import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromToken,
  getUserAIInstruction,
  setUserAIInstruction,
  getUserAIModel,
  setUserAIModel,
} from "@/lib/db";
import { isValidChatModel, resolveChatModel } from "@/lib/chat-models";

// GET /api/ai-settings — returns the signed-in user's custom AI instruction
// AND their chosen chat model. The settings panel uses both to hydrate.
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const [instruction, storedModel] = await Promise.all([
      getUserAIInstruction(user.id),
      getUserAIModel(user.id),
    ]);
    return NextResponse.json({
      instruction,
      model: resolveChatModel(storedModel),
    });
  } catch (error) {
    console.error("Get AI settings error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

// PUT /api/ai-settings — save the signed-in user's instruction and/or model.
// Both fields are optional — clients can send one or both in the same request.
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ops: Promise<unknown>[] = [];
    let savedInstruction: string | undefined;
    let savedModel: string | undefined;

    if (typeof body.instruction === "string") {
      // Cap length so a runaway instruction doesn't bloat every AI call
      const trimmed = (body.instruction as string).slice(0, 4000);
      savedInstruction = trimmed;
      ops.push(setUserAIInstruction(user.id, trimmed));
    }

    if (typeof body.model === "string") {
      // Reject any model id not in the allow-list — stops users from pinning
      // arbitrary OpenAI ids we haven't tested or their account doesn't cover.
      if (!isValidChatModel(body.model)) {
        return NextResponse.json(
          { error: `Unknown chat model: ${body.model}` },
          { status: 400 }
        );
      }
      savedModel = body.model;
      ops.push(setUserAIModel(user.id, body.model));
    }

    await Promise.all(ops);
    return NextResponse.json({
      instruction: savedInstruction,
      model: savedModel,
    });
  } catch (error) {
    console.error("Save AI settings error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
