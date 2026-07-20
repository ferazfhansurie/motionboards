import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ROOT = "/Users/faeez/motionboards";
const DIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "posters");
const files = ["01-wrap.png", "02-ppf.png", "03-tint.png", "04-coating.png"];

function loadEnv() {
  for (const filename of ["env.local", ".env.local"]) {
    try {
      const raw = readFileSync(path.join(ROOT, filename), "utf8");
      for (const line of raw.split("\n")) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
}

loadEnv();
const accountId = process.env.R2_ACCOUNT_ID.replace(/^https?:\/\//, "").replace(/\.r2\.cloudflarestorage\.com.*$/, "").replace(/\/.*$/, "");
const bucket = process.env.R2_BUCKET;
const publicBase = process.env.R2_PUBLIC_URL.replace(/\/$/, "");
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  forcePathStyle: true,
});

const out = {};
for (const file of files) {
  const key = `hyperwrapz-ads/2026-07-19/${file}`;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: await fs.readFile(path.join(DIR, file)),
    ContentType: "image/png",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  out[file.replace(".png", "")] = `${publicBase}/${key}`;
}
console.log(JSON.stringify(out, null, 2));
