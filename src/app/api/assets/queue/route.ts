import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, isAdmin, listAllAssetRequests } from "@/lib/db";

// Operator-only fulfillment queue: every real-human request across all users.
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const assets = await listAllAssetRequests();
    return NextResponse.json({ assets });
  } catch (err) {
    console.error("Assets queue GET error:", err);
    return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
  }
}
