import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, deleteCommunityComment } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const { commentId } = await params;
    const ok = await deleteCommunityComment(commentId, user.id, user.role === "admin");
    if (!ok) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Comment DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
