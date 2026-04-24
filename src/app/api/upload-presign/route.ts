import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getUserFromToken } from "@/lib/db";

// POST /api/upload-presign
// Body: { filename: string, contentType: string }
// Returns: { uploadUrl, publicUrl, key }
//
// The browser PUTs the file bytes directly to `uploadUrl` (a presigned R2
// URL). Vercel never sees the bytes, so the 4.5 MB function-body cap is
// irrelevant — files up to R2's per-object limit (~5 TB) just work.
//
// `publicUrl` is the durable URL we hand to Replicate / store on the
// canvas item / use everywhere else after the upload completes.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    const publicBase = process.env.R2_PUBLIC_URL;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
      return NextResponse.json(
        {
          error:
            "R2 is not configured on this deployment. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_URL env vars.",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawName: string = body.filename || "upload.bin";
    const contentType: string = body.contentType || "application/octet-stream";
    const safeName = rawName.replace(/[^\w.\-]+/g, "_").slice(-120) || "upload.bin";
    const key = `uploads/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    // 1-hour signature window. The browser uploads in seconds, so this is
    // overkill, but it covers retries on slow networks without re-signing.
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl = `${publicBase.replace(/\/$/, "")}/${key}`;

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (error) {
    console.error("Presign error:", error);
    const msg = error instanceof Error ? error.message : "Failed to sign upload";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
