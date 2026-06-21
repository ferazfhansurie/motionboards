// 10 Instagram-STORY (9:16) variations for the Astro HQ "Program Kitar Semula"
// update. Photo-first, NOT a poster — light/native story edits, Malay captions,
// with the Astro logo-sign cut out as a sticker. Real faces preserved.
//   node scripts/gen-astro-story.mjs
// Reads all photos from public/fathopes/astro-hq/. Name the logo-sign photo
// "astro-sign.jpg" so it's used as the cutout (others become backgrounds).
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public", "fathopes", "astro-hq");

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

const BASE_RULES = `This is a casual real INSTAGRAM STORY photo (9:16 vertical), NOT a
designed poster and NOT a flyer. The real event photograph fills the WHOLE frame
edge to edge. Edits must look native to a phone story — light and hand-made, never
like graphic-design layout. KEEP EVERY REAL FACE EXACTLY as photographed — do not
redraw, beautify, swap or invent any face, and do not add or remove people. You may
warm/brighten the photo slightly. The event is FatHopes' used-cooking-oil recycling
drive ("Program Kitar Semula Minyak Masak Terpakai") at Astro HQ.

The FIRST attached photo is the FULL-FRAME background. The SECOND attached image
is the 'astro' logo sign — cut it out cleanly and place it as a small playful STORY
STICKER (slight tilt, soft shadow) so viewers instantly know it's at Astro HQ. Keep
the astro logo exact.

STORY CUTOUTS: the REMAINING attached photos are other moments from the same event.
Cut 1-2 of them out as small photo stickers (slight tilt, soft drop shadow, a thin
white or hand-torn edge) and tuck them into the frame — overlapping a corner or the
caption — so the story reads visually (people recycling their used cooking oil,
registering at the booth, staff helping). Keep their real faces EXACT. Make these
clearly small inset photo stickers, not a full collage that hides the background.

CAPTION TEXT (Malay, render legibly, NO spelling errors, only these words):`;

const NEG = `\nRender the caption text ONCE only — never duplicate or repeat the caption
anywhere. NO dates and NO times anywhere in the image. No gibberish text, no other
logos, no watermark, no poster-style banners or frames-everywhere. Only the astro
logo (on its sticker) and the caption text.`;

// 10 variations: vary base photo (by index), edit level, and style.
const V = [
  { lvl: "LIGHT",  style: "A small semi-transparent black caption bar across the lower third with white text. Astro sticker small in the top-right." },
  { lvl: "LIGHT",  style: "Minimal white casual handwritten-style caption near the top-left, no bar. Astro sticker small bottom-left." },
  { lvl: "MEDIUM", style: "A soft dark gradient rising from the bottom; bold white caption over it with a thin FatHopes-green underline. Astro sticker mid-right." },
  { lvl: "LIGHT",  style: "Caption as a single clean centred line in the lower third with a subtle shadow. Astro sticker small top-centre." },
  { lvl: "MEDIUM", style: "Instagram-style stickers look: a rounded location-pin chip reading the venue, plus a marker scribble underline under the headline. NO date or time anywhere. Astro sticker tilted top-right." },
  { lvl: "LIGHT",  style: "A thin translucent strip at the very top holding the caption; photo clean below. Astro sticker small bottom-right." },
  { lvl: "MEDIUM", style: "Taped-photo look: the whole shot slightly rotated with little tape corners, handwritten Malay caption underneath on an off-white margin. Astro sticker taped in a corner." },
  { lvl: "LIGHT",  style: "Just a small rounded green corner tag with a tiny recycle/leaf icon (NO date, NO time); the rest of the photo clean and full-bleed. Astro sticker small." },
  { lvl: "MEDIUM", style: "Bottom caption with a bold headline + green accent bar, plus a tiny recycling-arrow doodle. Astro sticker mid-left." },
  { lvl: "LIGHT",  style: "Very minimal: one short bold caption line lower-centre, nothing else but the Astro sticker small in a corner." },
];

// Caption text variants (Malay). Kept short for story legibility.
const CAPTIONS = [
  `"Program Kitar Semula", "Minyak Masak Terpakai", "Astro HQ, Bukit Jalil"`,
  `"Kitar Semula Minyak Masak", "Astro HQ Bukit Jalil, TPM KL"`,
  `"Jom Kitar Semula!", "Minyak Masak Terpakai @ Astro HQ"`,
];

async function generate(base, key, inputImages, prompt) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image-preview",
        prompt,
        inputImages,
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

  let files;
  try { files = (await fs.readdir(SRC)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)); }
  catch { throw new Error(`Drop the photos into ${SRC} first.`); }
  if (!files.length) throw new Error(`No images in ${SRC}.`);

  const signFile = files.find((f) => /sign|astro-sign|logo/i.test(f));
  const backgrounds = files.filter((f) => f !== signFile);
  if (!signFile) console.log("(no astro-sign.jpg found — generating without the sign sticker)");
  console.log(`${backgrounds.length} background photos${signFile ? " + astro sign" : ""}.`);

  const sign = signFile ? await dataUri(path.join(SRC, signFile)) : null;
  const outDir = path.join(ROOT, "public", "fathopes", "_gen", "story");
  await fs.mkdir(outDir, { recursive: true });

  // Optional: pass 1-based indices to regenerate only those (e.g. "5 8 10").
  const only = process.argv.slice(2).map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= V.length);

  for (let i = 0; i < V.length; i++) {
    if (only.length && !only.includes(i + 1)) continue;
    const n = String(i + 1).padStart(2, "0");
    const bgFile = backgrounds[i % backgrounds.length];
    const v = V[i];
    const caption = CAPTIONS[i % CAPTIONS.length];
    // 2 other event photos as story cutouts (different from the base).
    const cut1 = backgrounds[(i + 1) % backgrounds.length];
    const cut2 = backgrounds[(i + 3) % backgrounds.length];
    process.stdout.write(`[${n}/10] ${v.lvl} on ${bgFile} (+${cut1}, ${cut2}) ... `);
    const refs = [await dataUri(path.join(SRC, bgFile))];
    if (sign) refs.push(sign);
    refs.push(await dataUri(path.join(SRC, cut1)));
    if (cut2 !== cut1 && cut2 !== bgFile) refs.push(await dataUri(path.join(SRC, cut2)));
    const prompt = `${BASE_RULES} ${caption}\n\nEDIT LEVEL: ${v.lvl}. STYLE: ${v.style}${NEG}`;
    try {
      const r = await generate(base, key, refs, prompt);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 140)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(outDir, `story-${n}-${v.lvl.toLowerCase()}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved story-${n}-${v.lvl.toLowerCase()}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/fathopes/_gen/story/");
}

main().catch((e) => { console.error(e); process.exit(1); });
