import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromToken,
  heartbeatActiveTab,
  forceClaimActiveTab,
  releaseActiveTab,
} from "@/lib/db";

// Single-tab session lock — see lib/db.ts heartbeatActiveTab() for the
// full rationale. Each tab generates a unique tabId at module load and
// pings this endpoint every 5s; non-owner tabs see ownerTabId !== their
// own and surface the multi-tab modal.

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      tabId?: string;
      action?: "heartbeat" | "claim" | "release";
    };
    const tabId = typeof body.tabId === "string" ? body.tabId.slice(0, 64) : "";
    if (!tabId) return NextResponse.json({ error: "Missing tabId" }, { status: 400 });

    const action = body.action || "heartbeat";
    if (action === "claim") {
      const info = await forceClaimActiveTab(user.id, tabId);
      return NextResponse.json(info);
    }
    if (action === "release") {
      await releaseActiveTab(user.id, tabId);
      return NextResponse.json({ ownerTabId: null, ownerSeenAt: 0, isYou: false });
    }
    const info = await heartbeatActiveTab(user.id, tabId);
    return NextResponse.json(info);
  } catch (error) {
    console.error("active-tab error:", error);
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}
