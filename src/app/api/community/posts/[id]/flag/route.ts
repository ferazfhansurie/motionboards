import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, flagCommunityPost } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = (typeof body?.reason === "string" ? body.reason : "").slice(0, 500);

    const ok = await flagCommunityPost(id, user.id, reason);
    if (!ok) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Flag error:", err);
    return NextResponse.json({ error: "Flag failed" }, { status: 500 });
  }
}
