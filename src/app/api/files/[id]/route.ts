import { NextRequest, NextResponse } from "next/server";
import { getFile } from "@/lib/db";

// GET /api/files/:id — stream a file stored as bytea in Neon.
// Files are public-by-unguessable-id (matches the prior fal.ai storage model):
// no auth check, but IDs are random enough to be unlistable.
//
// Bandwidth budget: Vercel counts every byte that leaves the function as
// "Fast Origin Transfer" even when the browser could have served from cache.
// We do three things to keep that number low:
//   1. Long-lived immutable Cache-Control (browser cache reuse across sessions).
//   2. s-maxage so Vercel's edge caches the response and serves repeat hits
//      without re-running the function or re-transferring from Neon.
//   3. ETag + If-None-Match → 304 Not Modified (no body, 0-byte response).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // File ids are content-stable: serving the same id always returns the
    // same bytes. Use the id itself as the ETag — no hash needed.
    const etag = `"${id}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    const file = await getFile(id);
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(file.data.buffer, file.data.byteOffset, file.data.byteLength));
        controller.close();
      },
    });
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": file.sizeBytes.toString(),
        ETag: etag,
        // `immutable` tells browsers never to revalidate. `s-maxage` lets
        // Vercel's edge cache keep the response for a year so repeat hits
        // bypass the function + Neon entirely. `stale-while-revalidate` lets
        // the edge serve stale while revalidating in the background.
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("File fetch error:", error);
    return NextResponse.json({ error: "File fetch failed" }, { status: 500 });
  }
}

// Lightweight HEAD support — returns the same headers without the body.
// Media elements sometimes issue HEAD first (Content-Length, range support
// probing). Answering HEAD without streaming the bytes saves transfer.
export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return new NextResponse(null, { status: 400 });
    const etag = `"${id}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }
    const file = await getFile(id);
    if (!file) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": file.sizeBytes.toString(),
        ETag: etag,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
