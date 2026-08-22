import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sendWaText, workspaceForUser } from "@/lib/tickloop";

export async function POST(req: NextRequest) {
  const user = await requireUser(req); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { phone, body } = await req.json();
  if (!phone || !body?.trim()) return NextResponse.json({ error: "Missing phone or body." }, { status: 400 });
  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  const result = await sendWaText(workspace.id as string, phone, body.trim());
  if (!result.ok) return NextResponse.json({ error: result.reason, detail: "detail" in result ? result.detail : undefined }, { status: 502 });
  return NextResponse.json({ ok: true });
}
