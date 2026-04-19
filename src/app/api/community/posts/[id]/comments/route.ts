import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromToken,
  listCommunityComments,
  createCommunityComment,
} from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    const user = token ? await getUserFromToken(token) : null;
    const isAdmin = user?.role === "admin";
    const { id } = await params;
    const comments = await listCommunityComments(id, user?.id ?? null, !!isAdmin);
    return NextResponse.json({ comments });
  } catch (err) {
    console.error("Comments GET error:", err);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

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
    const { body, parentId } = (await req.json()) as { body?: string; parentId?: string };
    if (!body || !body.trim()) {
      return NextResponse.json({ error: "Comment body required" }, { status: 400 });
    }
    const comment = await createCommunityComment({
      postId: id,
      userId: user.id,
      authorName: user.name || "Creator",
      body,
      parentId: parentId || null,
    });
    if (!comment) return NextResponse.json({ error: "Could not post comment" }, { status: 404 });
    return NextResponse.json({ comment });
  } catch (err) {
    console.error("Comments POST error:", err);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
