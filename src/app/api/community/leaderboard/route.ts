import { NextRequest, NextResponse } from "next/server";
import { getCommunityLeaderboard } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const entries = await getCommunityLeaderboard(limit);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
