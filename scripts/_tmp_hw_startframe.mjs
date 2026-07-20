// Compose ONE photoreal start frame per category: the presenter (girl ref) placed
// into the real empty studio (2 studio refs), presenting to camera. This single
// frame is what Omni I2V animates. (Omni I2V = 1 image, so the "3 references"
// combine here.)
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const REFDIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-refs");
const OUT = path.join(REFDIR, "startframes");

async function loadEnv() {
  for (const f of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}
async function dataUri(file) {
  const buf = await sharp(file).resize({ width: 1000, height: 1600, fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}
async function gen(base, key, prompt, refs) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let a = 1; ; a++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt, inputImages: refs, generationOptions: { aspect_ratio: "9:16", resolution: "2K" } }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) return j;
    if ((res.status === 429 || /rate.?limit/i.test(JSON.stringify(j))) && a <= 8) { process.stdout.write(`(429 #${a}) `); await sleep(40000); continue; }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  }
}

const BASE = `Image 1 = a real Malaysian preteen boy presenter, glasses, keep his
face, hair, body and outfit EXACTLY as in Image 1 - same person, same age (do not
make him older or younger). Image 2 and Image 3 = the real HyperWrapz car-detailing
studio (vinyl-roll walls, red-accent tiled floor, linear ceiling lights, flags).

Composite Image 1's boy naturally INTO the real studio from Images 2-3, standing
on the red-accent floor path, full-body in frame, photoreal, matched lighting and
perspective, realistic contact shadow, scaled correctly as a kid (shorter than the
surrounding racks/features). He is a friendly kid host presenting to camera.
Keep it a candid, real, non-AI photograph look (natural skin, real shop). Vertical
9:16. No text, no logos, no watermark.`;

const FRAMES = [
  { slug: "sf-01-wrap-kid", pose: "He stands mid-shot facing the camera, warm open smile, one hand gesturing toward the colourful vinyl wrap rolls on the wall beside him, as if introducing the colour-change wrap service." },
];

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  await fs.mkdir(OUT, { recursive: true });
  const refs = await Promise.all([
    dataUri(path.join(REFDIR, "kid-01.png")),
    dataUri(path.join(REFDIR, "studio-01-wide.png")),
    dataUri(path.join(REFDIR, "studio-02-side.png")),
  ]);
  for (const f of FRAMES) {
    process.stdout.write(`[${f.slug}] ... `);
    const r = await gen(base, key, `${BASE}\n\n${f.pose}`, refs);
    if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0,160)}`); continue; }
    const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    await fs.writeFile(path.join(OUT, `${f.slug}.png`), Buffer.from(await img.arrayBuffer()));
    console.log("saved");
  }
  console.log("DONE", OUT);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
