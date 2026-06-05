import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { randomBytes } from "crypto";
import { getUserFromToken, createFathopesMedia, fathopesSlug } from "@/lib/db";
import { r2Config, r2Client } from "@/lib/r2";

export const maxDuration = 60;

// POST /api/fathopes/import  (auth required)
// Body: { url, category, type, name }
// Pulls a remote (AI-generated) media URL into the gallery: stores the original
// in R2, generates a webp thumbnail for images, and inserts the DB row. This
// makes ephemeral generation URLs permanent.
export async function POST(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const user = token ? await getUserFromToken(token) : null;
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const cfg = r2Config();
  if (!cfg.ok) return NextResponse.json({ error: "R2 not configured" }, { status: 500 });

  try {
    const b = await req.json().catch(() => ({}));
    const url: string = b.url;
    if (!url || !/^https?:\/\//.test(url)) return NextResponse.json({ error: "Valid url required" }, { status: 400 });
    const category: string = (b.category || "AI Generations").toString();
    const catSlug = fathopesSlug(category);
    const type: "image" | "video" = b.type === "video" ? "video" : "image";

    const resp = await fetch(url);
    if (!resp.ok) return NextResponse.json({ error: `Fetch failed (${resp.status})` }, { status: 502 });
    const contentType = resp.headers.get("content-type") || (type === "video" ? "video/mp4" : "image/png");
    const buf = Buffer.from(await resp.arrayBuffer());

    const extFromType = contentType.includes("/") ? contentType.split("/")[1].split(";")[0].replace("jpeg", "jpg") : (type === "video" ? "mp4" : "png");
    const uid = `${Date.now()}_${randomBytes(3).toString("hex")}`;
    const base = (b.name ? String(b.name).replace(/\.[^.]+$/, "").replace(/[^\w.\-]+/g, "-").slice(-60) : "generation") || "generation";
    const originalKey = `fathopes/${catSlug}/${uid}_${base}.${extFromType}`;

    const s3 = r2Client();
    await s3.send(new PutObjectCommand({
      Bucket: cfg.bucket, Key: originalKey, Body: buf, ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));

    let thumbPath = `/${originalKey}`;
    let ratio = 16 / 9;
    if (type === "image") {
      try {
        const out = await sharp(buf).rotate().resize({ height: 500, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer({ resolveWithObject: true });
        const thumbKey = `fathopes/_thumbs/${catSlug}/${uid}_${base}.webp`;
        await s3.send(new PutObjectCommand({
          Bucket: cfg.bucket, Key: thumbKey, Body: out.data, ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }));
        thumbPath = `/${thumbKey}`;
        ratio = out.info.width / out.info.height;
      } catch { /* fall back to original as thumb */ }
    }

    const item = await createFathopesMedia({
      src: `/${originalKey}`,
      thumb: thumbPath,
      ratio,
      category,
      type,
      name: b.name ? String(b.name) : `${base}.${extFromType}`,
    });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("fathopes import error:", e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
