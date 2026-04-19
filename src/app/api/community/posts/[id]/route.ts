import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, deleteCommunityPost, getCommunityPost } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { id } = await params;
    const post = await getCommunityPost(id);
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (post.userId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Not your post" }, { status: 403 });
    }

    const ok = await deleteCommunityPost(id, post.userId);
    if (!ok) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Community DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
