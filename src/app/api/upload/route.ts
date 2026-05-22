import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { putFile } from "@/lib/db";

export const maxDuration = 300;

// POST /api/upload — stores the request body in Neon (mb_files) and returns
// the public files-route URL.
//
// History: this previously streamed into Vercel Blob with access: "public",
// but the underlying store was provisioned as PRIVATE which made every upload
// fail with "Cannot use public access on a private store". Rather than
// reconfigure the blob store, switched to the same Neon-backed `putFile`
// pipeline that the status route uses for finished Veo / ComfyUI outputs.
// The /api/files/:id route serves those bytes public-by-unguessable-id, which
// is exactly what generation backends (Vertex AI, byteplus, replicate) need
// to fetch a user-supplied reference image.
//
// Client contract: send the raw File/Blob as the body. Pass the filename
// in `x-filename` and the mime type in `content-type`. No multipart,
// no boundaries, no SDK.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const contentType = req.headers.get("content-type") || "application/octet-stream";

    if (!req.body) {
      return NextResponse.json({ error: "No request body" }, { status: 400 });
    }

    // Buffer the stream — putFile takes a Buffer. For large videos this
    // does pull the whole body into memory; if that ever becomes a problem,
    // bump maxDuration / switch back to a streaming store. For reference
    // images (typically <10MB) this is fine.
    const buffer = Buffer.from(await req.arrayBuffer());

    const { id } = await putFile(buffer, contentType, user.id);
    const url = `${req.nextUrl.origin}/api/files/${id}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    const msg = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
