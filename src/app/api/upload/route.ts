import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getUserFromToken } from "@/lib/db";

export const maxDuration = 300;

// POST /api/upload — streams the raw request body straight into Vercel Blob
// and returns the resulting public URL.
//
// Why not FormData: calling req.formData() / req.blob() / req.arrayBuffer()
// buffers the body into memory BEFORE the handler runs, and that buffered
// read is the thing Vercel caps at ~4.5 MB. Reading req.body as a
// ReadableStream under Fluid Compute does not trigger that cap — the bytes
// flow straight through the function to Blob without ever being collected
// in one place.
//
// Client contract: send the raw File/Blob as the body. Pass the filename
// in `x-filename` and the mime type in `content-type`. No multipart,
// no boundaries, no SDK.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Blob storage not configured — BLOB_READ_WRITE_TOKEN missing on this deployment." },
        { status: 500 }
      );
    }

    const rawName = req.headers.get("x-filename") || "upload.bin";
    const contentType = req.headers.get("content-type") || "application/octet-stream";
    const safeName = rawName.replace(/[^\w.\-]+/g, "_").slice(-120) || "upload.bin";
    const pathname = `uploads/${user.id}/${Date.now()}_${safeName}`;

    if (!req.body) {
      return NextResponse.json({ error: "No request body" }, { status: 400 });
    }

    const result = await put(pathname, req.body, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Upload error:", error);
    const msg = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
