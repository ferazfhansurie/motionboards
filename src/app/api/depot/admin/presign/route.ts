import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import { r2Client, r2Config } from "@/lib/r2";
import { currentAdmin } from "@/lib/depot";

// POST /api/depot/admin/presign { filename, contentType, size } -> { uploadUrl, publicUrl }
// An admin attaching a video to a reply in someone's chat, or (purpose "template") uploading a poster template.
export async function POST(req: NextRequest) {
  if (!(await currentAdmin(req))) return NextResponse.json({ error: "Please log in again" }, { status: 401 });
  const cfg = r2Config();
  if (!cfg.ok) return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  const b = await req.json().catch(() => ({}));
  const template = b.purpose === "template";
  const contentType = String(b.contentType || (template ? "application/octet-stream" : "video/mp4"));
  if (template) {
    if (Number(b.size) > 200 * 1024 * 1024) return NextResponse.json({ error: "File is over 200 MB" }, { status: 400 });
    const ext = (String(b.filename || "").match(/\.[a-z0-9]{2,5}$/i)?.[0] || "").toLowerCase();
    const key = `depot-videos/templates/${Date.now()}_${randomBytes(3).toString("hex")}${ext}`;
    const uploadUrl = await getSignedUrl(r2Client(), new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType }), { expiresIn: 3600 });
    return NextResponse.json({ uploadUrl, publicUrl: `${cfg.publicBase}/${key}` });
  }
  if (!contentType.startsWith("video/")) return NextResponse.json({ error: "Please send a video file" }, { status: 400 });
  if (Number(b.size) > 1024 * 1024 * 1024) return NextResponse.json({ error: "Video is over 1 GB" }, { status: 400 });
  const ext = (String(b.filename || "").match(/\.[a-z0-9]{2,4}$/i)?.[0] || ".mp4").toLowerCase();
  const key = `depot-videos/ADMIN/${Date.now()}_${randomBytes(3).toString("hex")}${ext}`;
  const uploadUrl = await getSignedUrl(r2Client(), new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType }), { expiresIn: 3600 });
  return NextResponse.json({ uploadUrl, publicUrl: `${cfg.publicBase}/${key}` });
}
