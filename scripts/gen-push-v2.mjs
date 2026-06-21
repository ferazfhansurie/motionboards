// Program PUSH hiring poster v2 (4:5). New bg (2 usahawan + truck), oil-collection
// cutouts, ALL-CAPS Bahasa copy, salary badge. Paper-cutout style.
//   node scripts/gen-push-v2.mjs [count]
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R2 = "https://pub-88ebab5b8de2446f969ca2994121479f.r2.dev/fathopes";

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
  const buf = await fs.readFile(path.join(ROOT, p));
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const BG = "public/fathopes/_gen/collage/pux00790-sm.jpg"; // 2 usahawan + green truck (downscaled)
const OIL = [ `${R2}/astro/pux02823.jpg`, `${R2}/astro/pux02885.jpg` ]; // pumping/sucking oil into the truck

const PROMPT = `Design an ATTENTION-GRABBING 4:5 vertical Facebook hiring AD poster for FatHopes
Energy's "Program PUSH" green-entrepreneur recruitment. Paper-cutout collage style,
mobile-first, strong contrast, FatHopes forest green (~#15703A). Use ONLY the attached
REAL PHOTOS — keep their photographic quality, do not generate or invent any imagery.

BACKGROUND = REAL PHOTO (NOT a plain colour): use the FIRST attached photo as the
FULL-FRAME background — two real PUSH usahawan in BLACK FatHopes tees standing proudly
in front of the green FatHopes tanker truck. Keep the real setting and KEEP ALL REAL
FACES EXACT. Apply a warm punchy grade and a subtle dark-green gradient at top and
bottom so the text stays legible.

OIL-COLLECTION CUTOUTS (paper-cutout technique): cut out the OTHER attached real photos
that show a worker pumping / sucking used cooking oil into the tanker truck (the
collection work), with hand-torn ripped-paper edges and soft drop shadows. Place BOTH as
dynamic cutouts so the poster shows the real work. Orient them upright. KEEP REAL FACES
EXACT.

ALL TEXT IN CAPITAL LETTERS (UPPERCASE). Bahasa Malaysia, simple punchy KEYWORDS, NO
long dashes, NO complex/formal words. BIG, BOLD, legible, NO spelling errors, each line
ONCE, EXACTLY:
- HEADLINE (top, COMPACT): "APPLY PROGRAM PUSH USAHAWAN" — render it as BOLD ITALIC WHITE
  text with a THICK GREEN OUTLINE / STROKE around every letter (white fill, forest-green
  stroke, like a sporty sticker wordmark). Tight line spacing so the title block is short
  and compact.
- Bold BRIGHT-YELLOW rounded salary badge near the headline: "MINIMUM BOLEH DAPAT RM5,000/BULAN"
- Short sub-line: "JANA PENDAPATAN SENDIRI"
- Three keyword chips, each with a small white tick: "LATIHAN PERCUMA", "TIADA PENGALAMAN", "KERJA SENDIRI"
- A small "FATHOPES ENERGY" wordmark with a small "PROGRAM PUSH" line (do NOT add any extra
  large standalone "PUSH" word anywhere)

NO bottom call-to-action bar. NO "MOHON SEKARANG". NO phone number. Small recycle/leaf
motif ok. Spell every word EXACTLY. No gibberish, no duplicated text, no other logos, no
watermark, no lens distortion. Do not invent or alter any human face.`;

async function generate(base, key, inputImages) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image-preview",
        prompt: PROMPT, inputImages,
        generationOptions: { aspect_ratio: "4:5", resolution: "2K" },
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
  const N = parseInt(process.argv[2] || "4", 10);

  const refs = [await dataUri(BG), ...OIL];
  const outDir = path.join(ROOT, "public", "fathopes", "_gen", "push-hiring");
  await fs.mkdir(outDir, { recursive: true });

  for (let i = 1; i <= N; i++) {
    const n = String(i).padStart(2, "0");
    process.stdout.write(`[${n}/${N}] ... `);
    try {
      const r = await generate(base, key, refs);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 140)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(outDir, `push-real-${n}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved push-v2-${n}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/fathopes/_gen/push-hiring/");
}

main().catch((e) => { console.error(e); process.exit(1); });
