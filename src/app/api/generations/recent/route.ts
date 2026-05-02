import { NextRequest, NextResponse } from "next/server";
import { getAllGenerations, getUserFromToken } from "@/lib/db";

// Returns the current user's recent generations. Used by the canvas to
// recover synchronous generations whose HTTP response was lost (e.g., a
// Nano Banana 2 4K run that completes server-side but whose response
// is dropped by an upstream proxy timeout). The client matches by model
// and a recent timestamp window, then attaches the recovered outputUrl
// to the orphaned canvas item.
//
// This is intentionally NOT admin-only — every user can read their own.
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const model = req.nextUrl.searchParams.get("model");
    const sinceParam = req.nextUrl.searchParams.get("since");
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10", 10) || 10, 50);

    const all = await getAllGenerations(user.id, limit);
    let filtered = all;
    if (model) filtered = filtered.filter((g) => g.model === model);
    if (sinceParam) {
      const sinceMs = Date.parse(sinceParam);
      if (!Number.isNaN(sinceMs)) {
        filtered = filtered.filter((g) => Date.parse(g.createdAt) >= sinceMs);
      }
    }
    return NextResponse.json({ generations: filtered });
  } catch (error) {
    console.error("Failed to fetch recent generations:", error);
    return NextResponse.json({ error: "Failed to fetch recent generations" }, { status: 500 });
  }
}
