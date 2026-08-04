import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { setConsent, workspaceForUser } from "@/lib/tickloop";

export async function POST(req: NextRequest) {
  const user = await requireUser(req); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { phone, status, source = "merchant_recorded" } = await req.json();
  if (!phone || !["opted_in", "opted_out"].includes(status)) return NextResponse.json({ error: "A phone and valid consent status are required." }, { status: 400 });
  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`); await setConsent(workspace.id as string, phone, status, source);
  return NextResponse.json({ ok: true });
}
