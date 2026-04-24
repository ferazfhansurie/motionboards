import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/db";

// POST /api/blob/handle-upload
// Authorizes a client-side direct-to-Blob upload. Client calls
// `upload(filename, file, { handleUploadUrl: '/api/blob/handle-upload' })`
// from @vercel/blob/client; this route signs the token so the browser can
// send the file straight to Blob without passing through a Vercel function
// (which has a ~4.5 MB body cap on all plans).
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Fail fast with a message the user can actually fix if the Blob store
  // hasn't been linked yet. Without this env var `handleUpload` throws an
  // opaque "Failed to retrieve the client token" downstream.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Vercel Blob not configured. In your Vercel dashboard → Storage → Create Blob → Connect to this project. That injects BLOB_READ_WRITE_TOKEN automatically. Redeploy after connecting.",
      },
      { status: 500 }
    );
  }

  const body = (await req.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        // Gate by the same session cookie used everywhere else.
        const token = req.cookies.get("session")?.value;
        if (!token) throw new Error("Not authenticated");
        const user = await getUserFromToken(token);
        if (!user) throw new Error("Not authenticated");
        return {
          allowedContentTypes: ["image/*", "video/*", "audio/*"],
          // 500 MB ceiling — plenty of headroom for HD videos. The per-model
          // maxMB guard on the client still rejects before submission if a
          // specific model's slot can't handle the size.
          maximumSizeInBytes: 500 * 1024 * 1024,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // No-op. The public blob URL is returned to the caller in the
        // handleUpload response and stored on the canvas item from there.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Upload authorization failed";
    console.error("[blob handle-upload] ", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
