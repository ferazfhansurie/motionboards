import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, isAdmin, getRegistrationFunnel, getEventCounts, getTopPaths } from "@/lib/db";

// Returns the full registration funnel + in-house event metrics
// (impressions, conversions) for the requested time range.
// Admin-only. Range is the ?days query param: 1 / 7 / 30 / "all".
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!isAdmin(user)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const daysParam = req.nextUrl.searchParams.get("days");
    let rangeDays: number | null;
    if (daysParam === null || daysParam === "all") {
      rangeDays = null;
    } else {
      const n = parseInt(daysParam, 10);
      rangeDays = Number.isFinite(n) && n > 0 ? n : 30;
    }

    const [metrics, events, topPaths] = await Promise.all([
      getRegistrationFunnel(rangeDays),
      getEventCounts(rangeDays),
      getTopPaths(rangeDays, 15),
    ]);
    return NextResponse.json({ ...metrics, events, topPaths });
  } catch (err) {
    console.error("Funnel metrics error:", err);
    return NextResponse.json({ error: "Failed to load funnel metrics" }, { status: 500 });
  }
}
