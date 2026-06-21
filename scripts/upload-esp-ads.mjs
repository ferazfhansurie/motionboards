// Upload the 9 ESP ad-ready JPGs to MotionBoards /api/upload -> public URLs
// (so Meta can fetch them as ad creatives). Prints JSON {file: url}.
//   node scripts/upload-esp-ads.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = "public/ESP/_gen/posters/ad-ready";

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
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("No API key");
  const files = (await fs.readdir(path.join(ROOT, DIR))).filter((f) => f.endsWith(".jpg")).sort();
  const out = {};
  for (const f of files) {
    const buf = await fs.readFile(path.join(ROOT, DIR, f));
    const res = await fetch(`${base}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-filename": f },
      body: buf,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.url) { console.error(`FAIL ${f}: ${res.status} ${JSON.stringify(j).slice(0,120)}`); continue; }
    out[f.replace(".jpg", "")] = j.url;
  }
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
