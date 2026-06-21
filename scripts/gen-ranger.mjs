// FatHopes RANGER recruitment poster (4:5). Real everyday people in front of the
// FatHopes banner; website messaging; green-stroke heading; app CTA.
//   node scripts/gen-ranger.mjs [count]
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REC = "public/fathopes/recyclers";

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

// Everyday people in normal clothes in front of the FatHopes banner (small files -> data URI ok).
const REFS_LOCAL = [
  `${REC}/SaveClip.App_487553717_1076733177806158_8274531523985885228_n.jpg`, // woman, peace signs + banner
  `${REC}/SaveClip.App_487458837_1076733344472808_7011945655324604761_n.jpg`, // man, white polo + SDG banner
  `${REC}/SaveClip.App_487556205_1076733361139473_2992914642562998578_n.jpg`, // man, blue + banner
];

const PROMPT = `Design a clean, modern, ATTRACTIVE 4:5 vertical FatHopes Energy recruitment poster
for the RANGER program. FatHopes forest green (~#15703A) and white, fresh and optimistic,
mobile-first, strong contrast.

PEOPLE = REAL PHOTOS: use the attached real photos of everyday Malaysians in normal clothes
standing in front of FatHopes banners (holding bottles of used cooking oil). Feature them as
the real hero imagery - one larger hero plus a couple of smaller photo cutouts. KEEP ALL REAL
FACES EXACT - never redraw, beautify, swap or invent a face. They are everyday community Rangers.

TEXT (Bahasa Malaysia) - BIG, BOLD, perfectly legible, NO spelling errors, simple keywords,
no long dashes, each line ONCE, EXACTLY:
- Headline (top): "JADI RANGER FATHOPES" (bold WHITE letters with a thick forest-green
  outline / stroke, compact line spacing)
- Tagline under it: "Tukar Sisa Jadi Pendapatan"
- Three keyword chips, each with a small white tick:
    "Kumpul minyak masak terpakai"
    "Jana pendapatan tambahan"
    "Kumpul ganjaran FatPoints"
- A small line: "Untuk komuniti, pelajar & sambilan"
- Bold green CTA bar near the bottom: "Muat turun FatHopes Loyalty App"
- A small "FatHopes Energy" wordmark

Clean bold sans-serif, high contrast, a small recycle / leaf motif. Spell every word EXACTLY.
No gibberish, no duplicated text, no other logos besides FatHopes, no watermark. Do not invent
or alter any human face.`;

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

  const refs = await Promise.all(REFS_LOCAL.map(dataUri));
  const outDir = path.join(ROOT, "public", "fathopes", "_gen", "ranger");
  await fs.mkdir(outDir, { recursive: true });

  for (let i = 1; i <= N; i++) {
    const n = String(i).padStart(2, "0");
    process.stdout.write(`[${n}/${N}] ... `);
    try {
      const r = await generate(base, key, refs);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 140)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(outDir, `ranger-${n}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved ranger-${n}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/fathopes/_gen/ranger/");
}

main().catch((e) => { console.error(e); process.exit(1); });
