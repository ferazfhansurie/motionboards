// Phase 1+2: generate the EMPTY STUDIO reference (no cars, clean, great) from the
// real shop photos, and a photoreal Malaysian-Chinese presenter (non-AI look).
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-refs");
const SHOP = [
  "/Users/faeez/.claude/uploads/3cf8cdfe-7058-4a88-b03b-9d6109389b91/d93415b9-9E4E8007DE484D248924E4BA184D9D54.jpeg",
  "/Users/faeez/.claude/uploads/3cf8cdfe-7058-4a88-b03b-9d6109389b91/869d68f1-73416B561A4F4E3F806199430DD1FCC1.jpeg",
];

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
  const buf = await sharp(file).resize({ width: 1000, height: 1400, fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
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
async function save(base, key, slug, prompt, refs, aspect) {
  process.stdout.write(`[${slug}] ... `);
  const r = await gen(base, key, prompt, refs, aspect);
  if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0,160)}`); return; }
  const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  await fs.writeFile(path.join(OUT, `${slug}.png`), Buffer.from(await img.arrayBuffer()));
  console.log("saved");
}

const STUDIO = `Reference photos = a REAL car-wrap & detailing studio in Klang, Malaysia
(bright linear LED ceiling lights in rows, walls of colourful vinyl wrap rolls on
metal racks, dark grey diamond interlocking garage floor tiles with a bold RED
accent path, dark charcoal walls, a row of small international flags strung near
the ceiling, a glass partition, a small tint-film sample wall). Reproduce THIS
EXACT real studio, same materials and lighting, so it reads as a genuine photo of
this shop.

Produce a clean, tidy, EMPTY studio interior PHOTOGRAPH — absolutely NO cars, NO
people, NO clutter, NO rubbish bags. Just the beautiful empty detailing bay: the
red-accent tiled floor clear and clean, vinyl-roll wall neat, lights on, cinematic
premium lighting, subtle film grain, photoreal (not CG). This is a clean stage
for a presenter to stand in later. No text, no logos, no watermark.`;

const GIRL = `A candid, photoreal PORTRAIT of a real Malaysian-Chinese woman in her mid-20s,
full-body / three-quarter length, standing naturally and relaxed, friendly warm
approachable expression, looking at the camera. She is a car-detailing shop
presenter / host.

Look: natural, real, NOT AI-perfect — realistic skin texture with subtle pores and
slight imperfections, natural slightly-asymmetric features, minimal natural makeup,
shoulder-length black hair slightly imperfect, authentic candid phone-camera /
mirrorless realism, natural indoor lighting. Wearing a casual-smart outfit: a
fitted plain dark tee or polo with dark jeans, clean sneakers. Confident but
girl-next-door, relatable, Malaysian.

Neutral clean mid-grey studio background (she will be composited into a real shop
later). Sharp focus on her, shallow depth. No text, no logos, no watermark, no
over-smoothing, no plastic skin, no exaggerated model glamour.`;

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  await fs.mkdir(OUT, { recursive: true });
  const refs = await Promise.all(SHOP.map(dataUri));
  // two empty-studio angles (9:16 for reels)
  await save(base, key, "studio-01-wide", STUDIO + "\nAngle: straight-down-the-bay wide shot, red accent path leading into the frame, ceiling lights receding in perspective.", refs, "9:16");
  await save(base, key, "studio-02-side", STUDIO + "\nAngle: three-quarter view showing the vinyl-roll wall on one side and the empty red-accent floor in the foreground where a presenter would stand.", refs, "9:16");
  // presenter (two options)
  await save(base, key, "girl-01", GIRL, [], "9:16");
  await save(base, key, "girl-02", GIRL + "\nVariation: slightly different face and a friendly half-smile, hair tied back in a low ponytail.", [], "9:16");
  console.log("DONE", OUT);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
