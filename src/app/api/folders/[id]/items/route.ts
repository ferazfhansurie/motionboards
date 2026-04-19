import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromToken,
  listFolderItems,
  addFolderItem,
  getFile,
  putFile,
} from "@/lib/db";

export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const { id } = await params;
    const items = await listFolderItems(id, user.id);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Folder items GET error:", err);
    return NextResponse.json({ error: "Failed to load items" }, { status: 500 });
  }
}

// POST accepts one of: { mediaUrl, mediaType, fileName } OR a multipart upload
// with field "file". Multipart is used by the folder panel's native upload; the
// JSON form is used by the "Save to Folder" context menu on the canvas.
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

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = file.type || "application/octet-stream";
      const mediaType: "image" | "video" | "audio" = mime.startsWith("video/")
        ? "video"
        : mime.startsWith("audio/")
          ? "audio"
          : "image";
      const put = await putFile(buf, mime, user.id);
      const item = await addFolderItem(id, user.id, put.id, mediaType, file.name || "Upload");
      if (!item) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      return NextResponse.json({ item });
    }

    const body = await req.json();
    const { mediaUrl, mediaType, fileName } = body as {
      mediaUrl?: string;
      mediaType?: "image" | "video" | "audio";
      fileName?: string;
    };
    if (!mediaUrl) return NextResponse.json({ error: "mediaUrl required" }, { status: 400 });
    if (!mediaType || !["image", "video", "audio"].includes(mediaType)) {
      return NextResponse.json({ error: "Invalid mediaType" }, { status: 400 });
    }

    // Reuse file id when mediaUrl already points to /api/files/:id; otherwise
    // fetch + put so the folder entry survives the source rotating.
    let fileId: string | null = null;
    const url = new URL(mediaUrl, req.nextUrl.origin);
    const match = url.pathname.match(/\/api\/files\/([^/]+)$/);
    if (match) {
      const existing = await getFile(match[1]);
      if (existing) fileId = existing.id;
    }
    if (!fileId) {
      const res = await fetch(url.toString());
      if (!res.ok) return NextResponse.json({ error: "Could not fetch media" }, { status: 400 });
      const buf = Buffer.from(await res.arrayBuffer());
      const mime =
        res.headers.get("content-type") ||
        (mediaType === "video" ? "video/mp4" : mediaType === "audio" ? "audio/mpeg" : "image/png");
      const put = await putFile(buf, mime, user.id);
      fileId = put.id;
    }

    const item = await addFolderItem(id, user.id, fileId, mediaType, fileName || "Untitled");
    if (!item) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    console.error("Folder items POST error:", err);
    const msg = err instanceof Error ? err.message : "Add failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
