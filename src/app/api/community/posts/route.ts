import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromToken,
  listCommunityPosts,
  createCommunityPost,
  getFile,
  putFile,
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
} from "@/lib/db";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    const user = token ? await getUserFromToken(token) : null;
    const isAdmin = user?.role === "admin";
    const { searchParams } = req.nextUrl;
    const rawCategory = searchParams.get("category") || "All";
    const category = (COMMUNITY_CATEGORIES as readonly string[]).includes(rawCategory)
      ? (rawCategory as CommunityCategory)
      : "All";
    const limit = Math.min(parseInt(searchParams.get("limit") || "60"), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const posts = await listCommunityPosts(user?.id ?? null, isAdmin, {
      category: category as CommunityCategory | "All",
      limit,
      offset,
    });
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
    const {
      title,
      body: postBody,
      category,
      mediaUrl,
      mediaType,
    } = body as {
      title?: string;
      body?: string;
      category?: string;
      mediaUrl?: string;
      mediaType?: string;
    };

    const safeTitle = (title || "").toString().trim().slice(0, 200);
    if (!safeTitle) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const safeBody = (postBody || "").toString().slice(0, 10_000);
    const safeCategory: CommunityCategory = (COMMUNITY_CATEGORIES as readonly string[]).includes(category || "")
      ? (category as CommunityCategory)
      : "General";

    // Optional attachment: resolve mediaUrl → a file id. Skip when no url given.
    let fileId: string | null = null;
    let safeMediaType: "image" | "video" | null = null;
    if (mediaUrl && typeof mediaUrl === "string") {
      if (mediaType !== "image" && mediaType !== "video") {
        return NextResponse.json(
          { error: "mediaType must be 'image' or 'video' when attaching media" },
          { status: 400 }
        );
      }
      safeMediaType = mediaType;
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
    }

    const post = await createCommunityPost({
      userId: user.id,
      authorName: user.name || "Creator",
      title: safeTitle,
      body: safeBody,
      category: safeCategory,
      fileId,
      mediaType: safeMediaType,
    });
    return NextResponse.json({ post });
  } catch (err) {
    console.error("Community POST error:", err);
    const msg = err instanceof Error ? err.message : "Failed to create post";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
