import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { upsertConnection, workspaceForUser } from "@/lib/tickloop";

// Called by the browser only after Meta Embedded Signup returns a one-time code.
export async function POST(req: NextRequest) {
  const user = await requireUser(req); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { code, wabaId, phoneNumberId } = await req.json();
  if (!code || !wabaId || !phoneNumberId) return NextResponse.json({ error: "Incomplete WhatsApp onboarding result." }, { status: 400 });
  const appId = process.env.META_APP_ID; const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return NextResponse.json({ error: "WhatsApp is not configured by TickLoop yet." }, { status: 503 });
  const tokenUrl = `https://graph.facebook.com/v23.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`;
  const tokenResponse = await fetch(tokenUrl); if (!tokenResponse.ok) return NextResponse.json({ error: "Meta token exchange failed." }, { status: 502 });
  const token = await tokenResponse.json(); const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  await upsertConnection(workspace.id as string, "whatsapp", String(phoneNumberId), token, { wabaId, phoneNumberId, connectedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
