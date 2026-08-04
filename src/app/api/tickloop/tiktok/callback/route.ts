import { NextRequest, NextResponse } from "next/server";
import { consumeOAuthState, upsertConnection } from "@/lib/tickloop";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") || req.nextUrl.searchParams.get("auth_code"); const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(new URL("/shop-automation?error=missing_tiktok_callback", req.url));
  const workspaceId = await consumeOAuthState(state, "tiktok_shop"); if (!workspaceId) return NextResponse.redirect(new URL("/shop-automation?error=invalid_tiktok_state", req.url));
  const tokenUrl = process.env.TIKTOK_SHOP_TOKEN_URL; const appKey = process.env.TIKTOK_SHOP_APP_KEY; const appSecret = process.env.TIKTOK_SHOP_APP_SECRET;
  if (!tokenUrl || !appKey || !appSecret) return NextResponse.redirect(new URL("/shop-automation?error=tiktok_not_configured", req.url));
  const tokenResponse = await fetch(tokenUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ app_key: appKey, app_secret: appSecret, grant_type: "authorized_code", auth_code: code }) });
  if (!tokenResponse.ok) return NextResponse.redirect(new URL("/shop-automation?error=tiktok_token_exchange", req.url));
  const token = await tokenResponse.json(); const externalId = String(token.open_id || token.shop_id || token.seller_id || "authorized-shop");
  await upsertConnection(workspaceId, "tiktok_shop", externalId, token, { connectedAt: new Date().toISOString() });
  return NextResponse.redirect(new URL("/shop-automation?connected=tiktok", req.url));
}
