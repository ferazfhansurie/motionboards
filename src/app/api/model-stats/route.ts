import { NextRequest, NextResponse } from "next/server";
import { getModelDurationStats, getUserFromToken } from "@/lib/db";

// Per-model average processing time, aggregated across all users' completed
// generations. Consumed by the client to replace the static `speed: "~4m"`
// hint on each model with a live empirical estimate.
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const stats = await getModelDurationStats();
    return NextResponse.json({ stats });
  } catch (err) {
    console.error("Model stats error:", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
