// Generate a clean full-body kid-presenter avatar using Faeez's real childhood
// photo (middle kid, glasses) as the face/identity reference.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const REFDIR = path.join(ROOT, "Hyperwrapz & Detailing");
const OUT = path.join(REFDIR, "_gen", "video-refs");

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
  const buf = await sharp(file).resize({ width: 1000, height: 1400, fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}
async function gen(base, key, prompt, refs, aspect) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let a = 1; ; a++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt, inputImages: refs, generationOptions: { aspect_ratio: aspect, resolution: "2K" } }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) return j;
    if ((res.status === 429 || /rate.?limit/i.test(JSON.stringify(j))) && a <= 8) { process.stdout.write(`(429 #${a}) `); await sleep(40000); continue; }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  }
}

const PROMPT = `Reference photo shows 3 boys in taekwondo uniforms - use ONLY the
MIDDLE boy (the one wearing glasses) as the face/identity reference for this new
image. Keep his real facial identity (face shape, eyes, glasses) recognizable but
render him a few years older, as a preteen/early-teen boy around 11-12 years old.

Generate a candid, photoreal FULL-BODY portrait of this boy, standing naturally,
relaxed and friendly, looking at the camera with a warm confident smile. He is a
kid presenter/host for a car-detailing shop video.

Look: natural, real, NOT AI-perfect - realistic skin texture, natural kid
proportions, keep his glasses. Wearing a casual-smart outfit appropriate for a
young Malaysian boy: a plain fitted t-shirt (dark colour) and casual shorts or
jeans, clean sneakers. Confident, friendly, relatable, Malaysian.

Neutral clean mid-grey studio background (he will be composited into a real shop
later). Sharp focus, shallow depth. No text, no logos, no watermark, no
over-smoothing, no plastic skin.`;

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  await fs.mkdir(OUT, { recursive: true });
  const refs = [await dataUri(path.join(REFDIR, "kids.jpg"))];

  process.stdout.write("[kid-01] ... ");
  const r = await gen(base, key, PROMPT, refs, "9:16");
  if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0,200)}`); return; }
  const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  await fs.writeFile(path.join(OUT, "kid-01.png"), Buffer.from(await img.arrayBuffer()));
  console.log("saved");
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
