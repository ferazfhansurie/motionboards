// 5 IG-story variations, fixed background, BIG Astro sign as the hero element,
// more event-photo cutouts to tell the story. Malay caption (once, no date).
//   node scripts/gen-astro-hero.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public", "fathopes", "astro-hq");
const BASE_FILE = "WhatsApp Image 2026-06-09 at 12.58.23 PM.jpeg"; // the one the user likes

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
async function dataUri(p) {
  const buf = await fs.readFile(p);
  const ext = path.extname(p).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const BASE_RULES = `A casual real INSTAGRAM STORY photo (9:16 vertical), NOT a poster.
The FIRST attached photo (people at the FatHopes booth) is the full-frame background;
warm/brighten it slightly. KEEP EVERY REAL FACE EXACTLY — never redraw, beautify,
swap or invent a face. The event is FatHopes' used-cooking-oil recycling drive at
Astro HQ.

BIG ASTRO SIGN = THE HERO: the SECOND attached image is the 'astro' logo sign. Cut
it out and make it LARGE and DOMINANT — the main focal element of the story (clearly
the biggest element), as a bold sticker with a slight tilt and soft shadow. Keep the
astro logo exact.

MANY STORY CUTOUTS: the REMAINING attached photos are other moments from the same
event. Cut out SEVERAL of them (3 to 4) as small photo stickers with slight tilts,
soft shadows and thin white or hand-torn edges, scattered around the frame to tell
the story (people recycling oil, registering, staff helping). Keep their real faces
EXACT. They stay smaller than the big astro sign.

CAPTION (Malay, render ONCE only, legible, NO spelling errors, no date/time):
"Program Kitar Semula", "Minyak Masak Terpakai", "Astro HQ, Bukit Jalil".

Render the caption ONCE — never duplicate it. NO dates, NO times anywhere. No other
logos, no watermark, no poster frames. Native phone-story look.

STYLE FOR THIS VARIATION: `;

const STYLES = [
  "Big astro sign top-centre as the hero; caption in a small translucent bar at the bottom; 3-4 photo cutouts scattered in the lower corners.",
  "Big astro sign centred and slightly tilted over the photo; the event cutouts collaged in a loose ring around it; bold caption at the very bottom with a thin green underline.",
  "Big astro sign upper-right overlapping the frame; the photo cutouts run as a little filmstrip down the left side; caption bottom-left.",
  "Big astro sign as a large anchor in the lower third next to the caption; 3-4 cutouts tucked across the top like a scrapbook header.",
  "Big astro sign centred high with a marker scribble underline; cutouts in a row along the bottom edge; short caption just under the sign.",
];

async function generate(base, key, inputImages, prompt) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image-preview",
        prompt, inputImages,
        generationOptions: { aspect_ratio: "9:16", resolution: "2K" },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    if ((res.status === 429 || /rate-limit/i.test(JSON.stringify(json))) && attempt <= 10) {
      process.stdout.write(`(429 #${attempt}, 45s) `); await sleep(45000); continue;
    }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 240)}`);
  }
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("No API key (MB_API_KEY in .env.local).");

  const files = (await fs.readdir(SRC)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  const signFile = files.find((f) => /sign|logo/i.test(f));
  const others = files.filter((f) => f !== signFile && f !== BASE_FILE);

  const baseRef = await dataUri(path.join(SRC, BASE_FILE));
  const sign = await dataUri(path.join(SRC, signFile));
  const outDir = path.join(ROOT, "public", "fathopes", "_gen", "story-hero");
  await fs.mkdir(outDir, { recursive: true });

  const only = process.argv.slice(2).map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= STYLES.length);
  for (let i = 0; i < STYLES.length; i++) {
    if (only.length && !only.includes(i + 1)) continue;
    const n = String(i + 1).padStart(2, "0");
    // 4 different cutouts per variation (rotate the offset for variety).
    const cuts = [0, 1, 2, 3].map((k) => others[(i * 2 + k) % others.length]);
    const uniqCuts = [...new Set(cuts)];
    process.stdout.write(`[${n}/5] +${uniqCuts.length} cutouts ... `);
    const refs = [baseRef, sign, ...(await Promise.all(uniqCuts.map((f) => dataUri(path.join(SRC, f)))))];
    const prompt = BASE_RULES + STYLES[i];
    try {
      const r = await generate(base, key, refs, prompt);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 140)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(outDir, `hero-${n}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved hero-${n}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/fathopes/_gen/story-hero/");
}

main().catch((e) => { console.error(e); process.exit(1); });
