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

    // Resolve the time range. Two ways to ask:
    //   ?days=N          → from now back N days. days=all = all-time.
    //   ?start=…&end=…  → explicit ISO/yyyy-mm-dd window (overrides days).
    // end is exclusive — pass tomorrow's date to include all of today.
    const sp = req.nextUrl.searchParams;
    const startParam = sp.get("start");
    const endParam = sp.get("end");
    const daysParam = sp.get("days");

    let since: Date;
    let until: Date;
    if (startParam) {
      since = new Date(startParam);
      until = endParam ? new Date(endParam) : new Date();
      // Guard: invalid date strings → fall back to all time
      if (isNaN(since.getTime())) since = new Date("1970-01-01");
      if (isNaN(until.getTime())) until = new Date();
    } else if (daysParam === "all" || daysParam === null) {
      since = new Date("1970-01-01");
      until = new Date();
    } else {
      const n = parseInt(daysParam, 10);
      const days = Number.isFinite(n) && n > 0 ? n : 30;
      since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      until = new Date();
    }

    const [metrics, events, topPaths] = await Promise.all([
      getRegistrationFunnel(since, until),
      getEventCounts(since, until),
      getTopPaths(since, until, 15),
    ]);
    return NextResponse.json({ ...metrics, events, topPaths });
  } catch (err) {
    console.error("Funnel metrics error:", err);
    return NextResponse.json({ error: "Failed to load funnel metrics" }, { status: 500 });
  }
}
