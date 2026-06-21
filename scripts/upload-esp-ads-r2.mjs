// Upload the 9 ESP ad-ready JPGs to Cloudflare R2 (public) so Meta's ad
// image crawler can fetch them. Prints JSON {file: publicUrl}.
//   node scripts/upload-esp-ads-r2.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "public", "ESP", "_gen", "posters", "ad-ready");
const PREFIX = "esp-ads";

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

async function main() {
  await loadEnv();
  const accountId = (process.env.R2_ACCOUNT_ID || "").trim()
    .replace(/^https?:\/\//, "").replace(/\.r2\.cloudflarestorage\.com.*$/, "").replace(/\/.*$/, "");
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBase = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    throw new Error("Missing R2 config in .env.local");
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestHandler: { connectionTimeout: 8000, requestTimeout: 120000 },
    maxAttempts: 4,
  });

  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith(".jpg")).sort();
  const out = {};
  for (const f of files) {
    const body = await fs.readFile(path.join(DIR, f));
    const key = `${PREFIX}/${f}`;
    await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: body,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    }));
    out[f.replace(".jpg", "")] = `${publicBase}/${key}`;
  }
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
