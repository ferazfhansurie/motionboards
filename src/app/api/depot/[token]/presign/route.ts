import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import { r2Client, r2Config } from "@/lib/r2";
import { siteByToken } from "@/lib/depot";

// POST /api/depot/<token>/presign { filename, contentType, size } -> { uploadUrl, publicUrl }
// The phone PUTs the video straight to R2, so Vercel's body limit doesn't apply.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/depot/[token]/presign">) {
  const site = await siteByToken((await ctx.params).token);
  if (!site) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const cfg = r2Config();
  if (!cfg.ok) return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  const b = await req.json().catch(() => ({}));
  const contentType = String(b.contentType || "video/mp4");
  if (!contentType.startsWith("video/")) return NextResponse.json({ error: "Please send a video file" }, { status: 400 });
  if (Number(b.size) > 1024 * 1024 * 1024) return NextResponse.json({ error: "Video is over 1 GB, please send a shorter one" }, { status: 400 });
  const ext = (String(b.filename || "").match(/\.[a-z0-9]{2,4}$/i)?.[0] || ".mp4").toLowerCase();
  const key = `depot-videos/${site.code}/${Date.now()}_${randomBytes(3).toString("hex")}${ext}`;
  const uploadUrl = await getSignedUrl(r2Client(), new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType }), { expiresIn: 3600 });
  return NextResponse.json({ uploadUrl, publicUrl: `${cfg.publicBase}/${key}` });
}
