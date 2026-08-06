import { NextRequest, NextResponse } from "next/server";
import { consumeOAuthState, upsertConnection } from "@/lib/tickloop";
import { exchangeAuthCode, getAuthorizedShops } from "@/lib/tiktok-shop";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") || req.nextUrl.searchParams.get("auth_code"); const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(new URL("/shop-automation?error=missing_tiktok_callback", req.url));
  const workspaceId = await consumeOAuthState(state, "tiktok_shop"); if (!workspaceId) return NextResponse.redirect(new URL("/shop-automation?error=invalid_tiktok_state", req.url));
  if (!process.env.TIKTOK_SHOP_APP_KEY || !process.env.TIKTOK_SHOP_APP_SECRET) return NextResponse.redirect(new URL("/shop-automation?error=tiktok_not_configured", req.url));

  try {
    const tokens = await exchangeAuthCode(code);
    // Resolve the shop cipher now — every order call needs it, and doing it here
    // means the connection row is immediately usable.
    const shop = (await getAuthorizedShops(tokens.access_token))[0];
    await upsertConnection(workspaceId, "tiktok_shop", shop?.id || tokens.open_id || "authorized-shop", tokens, {
      connectedAt: new Date().toISOString(),
      sellerName: tokens.seller_name,
      shopId: shop?.id,
      shopName: shop?.name,
      shopCipher: shop?.cipher,
      region: shop?.region || tokens.seller_base_region,
    });
  } catch (error) {
    console.error("[tickloop] tiktok callback failed", error);
    return NextResponse.redirect(new URL("/shop-automation?error=tiktok_token_exchange", req.url));
  }

  return NextResponse.redirect(new URL("/shop-automation?connected=tiktok", req.url));
}
