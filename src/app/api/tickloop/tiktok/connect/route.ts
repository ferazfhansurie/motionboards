import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { newState, saveOAuthState, workspaceForUser } from "@/lib/tickloop";

export async function GET(req: NextRequest) {
  const user = await requireUser(req); if (!user) return NextResponse.json({ error: "Sign in before connecting a shop." }, { status: 401 });
  const appKey = process.env.TIKTOK_SHOP_APP_KEY; const serviceId = process.env.TIKTOK_SHOP_SERVICE_ID;
  if (!appKey || !serviceId) return NextResponse.json({ error: "TikTok Shop is not configured by TickLoop yet." }, { status: 503 });
  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`); const state = newState(); await saveOAuthState(state, workspace.id as string, "tiktok_shop");
  const base = process.env.TIKTOK_SHOP_AUTH_BASE || "https://services.us.tiktokshop.com";
  const url = new URL("/open/authorize", base); url.searchParams.set("service_id", serviceId); url.searchParams.set("state", state); url.searchParams.set("app_key", appKey);
  return NextResponse.redirect(url);
}
