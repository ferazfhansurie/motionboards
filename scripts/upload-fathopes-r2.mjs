// Upload public/fathopes/** to Cloudflare R2 so the deployed /fathopes page
// can serve the footage (git/Vercel can't carry ~2GB of media).
//
//   node scripts/sync-fathopes-media.mjs     # 1. (re)build public/fathopes + manifest
//   node scripts/upload-fathopes-r2.mjs      # 2. push it all to R2
//
// Reads the same env vars the app already uses (see src/app/api/upload-presign):
//   R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET  R2_PUBLIC_URL
// Put them in .env.local. Objects are stored under the key "fathopes/<cat>/<file>"
// so the public URL is `${R2_PUBLIC_URL}/fathopes/...`, matching the manifest src.
//
// Idempotent: skips objects already present with the same byte size, so re-runs
// after adding a few files only upload the new ones.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DEST = path.join(ROOT, "public", "fathopes");

// Load .env.local (simple parser — no dependency).
async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch { /* no .env.local — rely on real env */ }
}

const CONTENT_TYPE = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4v": "video/x-m4v", ".webm": "video/webm",
};

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function main() {
  await loadEnv();

  const rawAccountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const accountId = rawAccountId
    .replace(/^https?:\/\//, "")
    .replace(/\.r2\.cloudflarestorage\.com.*$/, "")
    .replace(/\/.*$/, "");
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBase = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    console.error("Missing R2 config. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL in .env.local.");
    process.exit(1);
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    // Fail a stuck connection fast instead of hanging the whole run.
    requestHandler: { connectionTimeout: 8000, requestTimeout: 120000 },
    maxAttempts: 4,
  });

  const files = await walk(PUBLIC_DEST);
  console.log(`Uploading ${files.length} files to R2 bucket "${bucket}"...`);

  let uploaded = 0, skipped = 0, failed = 0, done = 0;

  async function handle(full) {
    const rel = path.relative(path.join(ROOT, "public"), full).split(path.sep).join("/"); // e.g. fathopes/super-hero/x.png
    const ext = path.extname(full).toLowerCase();
    const body = await fs.readFile(full);

    // Skip if an identically-sized object already exists.
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: rel }));
      if (head.ContentLength === body.length) { skipped++; return; }
    } catch { /* not present — upload below */ }

    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: rel,
        Body: body,
        ContentType: CONTENT_TYPE[ext] || "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable",
      }));
      uploaded++;
    } catch (e) {
      failed++;
      console.error(`  FAILED ${rel}: ${e.message}`);
    }
  }

  // Upload with a small concurrency pool — much faster than sequential.
  const CONCURRENCY = 6;
  let cursor = 0;
  async function worker() {
    while (cursor < files.length) {
      const idx = cursor++;
      await handle(files[idx]);
      done++;
      if (done % 25 === 0 || done === files.length) {
        console.log(`  ${done}/${files.length} processed (uploaded=${uploaded} skipped=${skipped} failed=${failed})`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nDone. uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
  console.log(`Public base: ${publicBase.replace(/\/$/, "")}/fathopes/...`);
  console.log(`\nNow set NEXT_PUBLIC_FATHOPES_BASE=${publicBase.replace(/\/$/, "")} (local + Vercel) and redeploy.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
