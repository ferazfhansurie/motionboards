import { NextRequest, NextResponse } from "next/server";
import { getFile } from "@/lib/db";

// GET /api/files/:id — stream a file stored as bytea in Neon.
// Files are public-by-unguessable-id (matches the prior fal.ai storage model):
// no auth check, but IDs are random enough to be unlistable.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const file = await getFile(id);
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Stream the Buffer through a ReadableStream — Next 16's NextResponse
    // BodyInit type doesn't accept Buffer/Uint8Array directly.
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
        // Files are immutable — once written they never change. Aggressive caching.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("File fetch error:", error);
    return NextResponse.json({ error: "File fetch failed" }, { status: 500 });
  }
}
