import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, setCommunityPostHidden } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const hidden = body?.hidden === false ? false : true;

    const ok = await setCommunityPostHidden(id, hidden);
    if (!ok) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json({ ok: true, hidden });
  } catch (err) {
    console.error("Hide error:", err);
    return NextResponse.json({ error: "Hide failed" }, { status: 500 });
  }
}
