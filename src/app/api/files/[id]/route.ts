import { NextRequest, NextResponse } from "next/server";
import { getFile } from "@/lib/db";

// GET /api/files/:id — stream a file stored as bytea in Neon.
// Files are public-by-unguessable-id (matches the prior fal.ai storage model):
// no auth check, but IDs are random enough to be unlistable.
//
// Bandwidth budget: Vercel counts every byte that leaves the function as
// "Fast Origin Transfer" even when the browser could have served from cache.
// We do four things to keep that number low and the user-perceived latency low:
//   1. Long-lived immutable Cache-Control (browser cache reuse across sessions).
//   2. s-maxage so Vercel's edge caches the response and serves repeat hits
//      without re-running the function or re-transferring from Neon.
//   3. ETag + If-None-Match → 304 Not Modified (no body, 0-byte response).
//   4. HTTP Range support → video elements stream + seek without restarting
//      the whole transfer. Without this, a 30MB clip blocks playback until
//      the entire file lands; with it, the browser plays from the first
//      megabyte while the rest range-fetches in the background.
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

    const total = file.sizeBytes;
    const rangeHeader = req.headers.get("range");

    // No Range header → return the full body. We still advertise
    // `Accept-Ranges: bytes` so the browser knows ranges are available
    // for follow-up seeks.
    if (!rangeHeader) {
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
          "Content-Length": total.toString(),
          "Accept-Ranges": "bytes",
          ETag: etag,
          "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400",
        },
      });
    }

    // Parse `Range: bytes=START-END`. We only support the single-range form;
    // multi-range is rare in practice (mostly old PDF readers) and Chrome /
    // Safari / Firefox all use single-range for media element streaming.
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    const startStr = match[1];
    const endStr = match[2];
    let start: number;
    let end: number;
    if (startStr === "" && endStr !== "") {
      // `bytes=-N` → last N bytes
      const suffix = parseInt(endStr, 10);
      start = Math.max(0, total - suffix);
      end = total - 1;
    } else if (startStr !== "" && endStr === "") {
      // `bytes=N-` → from N to the end
      start = parseInt(startStr, 10);
      end = total - 1;
    } else if (startStr !== "" && endStr !== "") {
      start = parseInt(startStr, 10);
      end = parseInt(endStr, 10);
    } else {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    if (
      Number.isNaN(start) || Number.isNaN(end) ||
      start < 0 || end < 0 || start > end || start >= total
    ) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }
    end = Math.min(end, total - 1);

    const sliceLen = end - start + 1;
    const slice = new Uint8Array(file.data.buffer, file.data.byteOffset + start, sliceLen);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(slice);
        controller.close();
      },
    });

    return new NextResponse(body, {
      status: 206,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": sliceLen.toString(),
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        ETag: etag,
        // Don't have the edge cache 206 partials — they fragment the cache
        // per range. The full-200 response above is the cached canonical;
        // partial requests pay one function hit each but don't pollute.
        "Cache-Control": "public, max-age=31536000, immutable",
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
        "Accept-Ranges": "bytes",
        ETag: etag,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
