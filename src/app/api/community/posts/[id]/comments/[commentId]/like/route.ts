import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, toggleCommunityCommentLike } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const { commentId } = await params;
    const result = await toggleCommunityCommentLike(commentId, user.id);
    if (!result) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Comment like error:", err);
    return NextResponse.json({ error: "Like failed" }, { status: 500 });
  }
}
