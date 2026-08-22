import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ensureAppWebhookFields, fetchPhoneNumberDetails, subscribeWabaWebhooks, upsertConnection, workspaceForUser } from "@/lib/tickloop";

// Called by the browser only after Meta Embedded Signup returns a one-time code.
// Handles both a plain WABA connection and the WhatsApp Business app
// coexistence flow — coexistence is just a property of which number the
// business chose during signup (detected below via is_on_biz_app), not a
// different API shape.
export async function POST(req: NextRequest) {
  const user = await requireUser(req); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { code, wabaId, phoneNumberId } = await req.json();
  if (!code || !wabaId || !phoneNumberId) return NextResponse.json({ error: "Incomplete WhatsApp onboarding result." }, { status: 400 });
  const appId = process.env.META_APP_ID; const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return NextResponse.json({ error: "WhatsApp is not configured by TickLoop yet." }, { status: 503 });
  const tokenUrl = `https://graph.facebook.com/v26.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`;
  const tokenResponse = await fetch(tokenUrl); if (!tokenResponse.ok) return NextResponse.json({ error: "Meta token exchange failed." }, { status: 502 });
  const token = await tokenResponse.json() as { access_token?: string };
  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);

  // Best-effort: register our app as the WABA's webhook receiver, and make
  // sure our app-level subscription includes the coexistence-only fields.
  // Neither failure should block the connection — a business that declines
  // or an app not yet fully configured still gets a working connection,
  // just without the extra mirroring until these are retried.
  const subscribed = token.access_token ? await subscribeWabaWebhooks(wabaId, token.access_token) : { ok: false as const };
  const appFieldsResult = await ensureAppWebhookFields().catch(() => ({ ok: false as const, reason: "error" as const }));
  const phoneDetails = token.access_token ? await fetchPhoneNumberDetails(phoneNumberId, token.access_token) : null;

  const isCoexistence = phoneDetails?.is_on_biz_app === true;
  await upsertConnection(workspace.id as string, "whatsapp", String(phoneNumberId), token, {
    wabaId,
    phoneNumberId,
    connectedAt: new Date().toISOString(),
    isCoexistence,
    platformType: phoneDetails?.platform_type,
    displayPhoneNumber: phoneDetails?.display_phone_number,
    verifiedName: phoneDetails?.verified_name,
    webhookSubscribed: subscribed.ok,
  });
  return NextResponse.json({
    ok: true,
    isCoexistence,
    displayPhoneNumber: phoneDetails?.display_phone_number,
    verifiedName: phoneDetails?.verified_name,
    webhookSubscribed: subscribed.ok,
    appWebhookFieldsSynced: appFieldsResult.ok,
  });
}
