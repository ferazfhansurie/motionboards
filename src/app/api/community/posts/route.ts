import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromToken,
  listCommunityPosts,
  createCommunityPost,
  getFile,
  putFile,
} from "@/lib/db";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    const user = token ? await getUserFromToken(token) : null;
    const isAdmin = user?.role === "admin";
    const { searchParams } = req.nextUrl;
    const limit = Math.min(parseInt(searchParams.get("limit") || "60"), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const posts = await listCommunityPosts(user?.id ?? null, isAdmin, limit, offset);
    return NextResponse.json({ posts });
  } catch (err) {
    console.error("Community GET error:", err);
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const body = await req.json();
    const { mediaUrl, mediaType, caption } = body as {
      mediaUrl?: string;
      mediaType?: string;
      caption?: string;
    };
    if (!mediaUrl || typeof mediaUrl !== "string") {
      return NextResponse.json({ error: "mediaUrl is required" }, { status: 400 });
    }
    if (mediaType !== "image" && mediaType !== "video") {
      return NextResponse.json({ error: "mediaType must be 'image' or 'video'" }, { status: 400 });
    }

    // Resolve mediaUrl → a stable file id we can reuse. If the URL already points
    // at /api/files/:id, just reuse that row; otherwise fetch the bytes and put
    // them into mb_files so the post survives even if the original source rotates.
    let fileId: string | null = null;
    const url = new URL(mediaUrl, req.nextUrl.origin);
    const filesMatch = url.pathname.match(/\/api\/files\/([^/]+)$/);
    if (filesMatch) {
      const existing = await getFile(filesMatch[1]);
      if (existing) fileId = existing.id;
    }
    if (!fileId) {
      const res = await fetch(url.toString());
      if (!res.ok) {
        return NextResponse.json({ error: "Could not fetch media" }, { status: 400 });
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const mime =
        res.headers.get("content-type") ||
        (mediaType === "video" ? "video/mp4" : "image/png");
      const put = await putFile(buf, mime, user.id);
      fileId = put.id;
    }

    const safeCaption = (caption || "").toString().slice(0, 500);
    const post = await createCommunityPost(
      user.id,
      user.name || "Creator",
      fileId,
      mediaType,
      safeCaption
    );
    return NextResponse.json({ post });
  } catch (err) {
    console.error("Community POST error:", err);
    const msg = err instanceof Error ? err.message : "Failed to create post";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
