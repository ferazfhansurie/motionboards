import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ROOT = "/Users/faeez/motionboards";
const DIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "reference-rebrand");
const files = ["colour-wrapping-hyperwrapz.jpeg", "ppf-coating-hyperwrapz.jpeg", "tinting-hyperwrapz.jpeg"];
for (const filename of ["env.local", ".env.local"]) {
  try {
    for (const line of readFileSync(path.join(ROOT, filename), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}
const accountId = process.env.R2_ACCOUNT_ID.replace(/^https?:\/\//, "").replace(/\.r2\.cloudflarestorage\.com.*$/, "").replace(/\/.*$/, "");
const prefix = "hyperwrapz-ads/2026-07-19-reference-rebrand";
const publicBase = process.env.R2_PUBLIC_URL.replace(/\/$/, "");
const s3 = new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }, forcePathStyle: true });
const out = {};
for (const file of files) {
  const key = `${prefix}/${file}`;
  await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: await fs.readFile(path.join(DIR, file)), ContentType: "image/jpeg", CacheControl: "public, max-age=31536000, immutable" }));
  out[file.split("-hyperwrapz")[0]] = `${publicBase}/${key}`;
}
console.log(JSON.stringify(out, null, 2));
