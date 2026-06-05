import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getUserFromToken, fathopesSlug } from "@/lib/db";
import { r2Config, r2Client } from "@/lib/r2";
import { randomBytes } from "crypto";

// POST /api/fathopes/presign  (auth required)
// Body: { filename, contentType, category }
// Returns presigned PUT URLs + the public key-paths for the original and its
// thumbnail. The browser uploads bytes straight to R2, then calls POST
// /api/fathopes to register the item.
export async function POST(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const user = token ? await getUserFromToken(token) : null;
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const cfg = r2Config();
  if (!cfg.ok) return NextResponse.json({ error: "R2 not configured" }, { status: 500 });

  const b = await req.json().catch(() => ({}));
  const rawName: string = b.filename || "upload.bin";
  const contentType: string = b.contentType || "application/octet-stream";
  const category: string = b.category || "Uncategorised";
  const catSlug = fathopesSlug(category);

  const safeBase = rawName.replace(/\.[^.]+$/, "").replace(/[^\w.\-]+/g, "-").slice(-80) || "file";
  const ext = (rawName.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
  const uid = `${Date.now()}_${randomBytes(3).toString("hex")}`;

  const originalKey = `fathopes/${catSlug}/${uid}_${safeBase}${ext}`;
  const thumbKey = `fathopes/_thumbs/${catSlug}/${uid}_${safeBase}.webp`;

  const s3 = r2Client();
  const originalUploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: cfg.bucket, Key: originalKey, ContentType: contentType }),
    { expiresIn: 3600 },
  );
  const thumbUploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: cfg.bucket, Key: thumbKey, ContentType: "image/webp" }),
    { expiresIn: 3600 },
  );

  return NextResponse.json({
    originalUploadUrl,
    thumbUploadUrl,
    originalPath: `/${originalKey}`,
    thumbPath: `/${thumbKey}`,
  });
}
