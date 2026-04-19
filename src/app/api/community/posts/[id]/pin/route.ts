import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, setCommunityPostPinned } from "@/lib/db";

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
    const pinned = body?.pinned === false ? false : true;
    const ok = await setCommunityPostPinned(id, pinned);
    if (!ok) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json({ ok: true, pinned });
  } catch (err) {
    console.error("Pin error:", err);
    return NextResponse.json({ error: "Pin failed" }, { status: 500 });
  }
}
