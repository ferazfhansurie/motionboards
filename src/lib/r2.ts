import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Shared Cloudflare R2 (S3-compatible) client + helpers. Mirrors the config in
// src/app/api/upload-presign so behaviour is identical everywhere.

export function r2Config() {
  const rawAccountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const accountId = rawAccountId
    .replace(/^https?:\/\//, "")
    .replace(/\.r2\.cloudflarestorage\.com.*$/, "")
    .replace(/\/.*$/, "");
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBase = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
  const ok = Boolean(accountId && accessKeyId && secretAccessKey && bucket && publicBase);
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBase, ok };
}

export function r2Client() {
  const { accountId, accessKeyId, secretAccessKey } = r2Config();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    forcePathStyle: true,
  });
}

// "/fathopes/foo/bar.jpg" -> "fathopes/foo/bar.jpg"
export function keyFromPath(p: string): string {
  return p.replace(/^\/+/, "");
}

export async function deleteR2Objects(paths: string[]): Promise<void> {
  const { bucket } = r2Config();
  const s3 = r2Client();
  await Promise.all(
    paths.filter(Boolean).map((p) =>
      s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: keyFromPath(p) })).catch(() => {}),
    ),
  );
}
