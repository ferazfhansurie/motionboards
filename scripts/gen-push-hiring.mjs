// Program PUSH hiring poster (4:5), AIDCA-structured copy, FatHopes green.
// Hero = real recycler/entrepreneur holding used cooking oil + green truck.
//   node scripts/gen-push-hiring.mjs [count]
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// PUSH usahawan = people in the BLACK FatHopes tee (NOT the oil-holding customers).
// Served from R2 by URL (big files -> avoid data-URI 413). Pool of confirmed
// black-tee usahawan shots; each variation uses a DIFFERENT bg + cutout pair.
const R2 = "https://pub-88ebab5b8de2446f969ca2994121479f.r2.dev/fathopes";
const POOL = [
  `${R2}/wisma-cimb-bangsar-2025/pux03014.jpg`,  // usahawan, outdoor, clear face
  `${R2}/plus-community-day/pux02274.jpg`,        // usahawan at FatHopes booth + banner
  `${R2}/wisma-cimb-bangsar-2025/pux03015.jpg`,  // usahawan + customer (orient upright)
];
// Distinct (background, cutout) pairings per variation.
const PAIRS = [
  [0, 1],
  [1, 0],
  [2, 1],
  [1, 2],
];

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
  const buf = await fs.readFile(path.isAbsolute(p) ? p : path.join(ROOT, p));
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const PROMPT = `Design an ATTENTION-GRABBING 4:5 vertical Facebook hiring AD poster for FatHopes
Energy's "Program PUSH" (Usahawan Hijau / green entrepreneur recruitment). Bahasa
Malaysia. Mobile-first, strong contrast, ONE clear focal hierarchy.

BACKGROUND = REAL PHOTO (do NOT use a plain colour background): use the FIRST attached
photo as the FULL-FRAME background — a real FatHopes PUSH usahawan wearing the BLACK
FatHopes tee, in her real setting. Orient the photo UPRIGHT. Keep her real
surroundings and KEEP ALL REAL FACES EXACT. Apply a warm, bright, punchy colour grade
and add a subtle dark-green gradient at the top and bottom so the text stays legible.

HERO CUTOUT (paper-cutout technique): take the SECOND attached photo — another real
PUSH usahawan in the BLACK FatHopes tee at the recycling booth — cut the usahawan out
with a hand-torn ripped-paper magazine edge and a soft drop shadow, and place her as a
prominent hero cutout (e.g. lower area). KEEP HER REAL FACE EXACT. Render the text
panels with the same torn-paper edge.

These BLACK-TEE people are the PUSH usahawan (green entrepreneurs) — the ad invites the
viewer to BECOME one of them (not the customers who hand in oil).

TEXT (Bahasa Malaysia) — simple, punchy KEYWORDS only. NO long dashes, NO formal or
complex words. BIG, BOLD, legible, NO spelling errors, each line ONCE, EXACTLY:
- Huge headline (top): "JADI USAHAWAN HIJAU"
- Short sub-line: "Jana pendapatan sendiri"
- Three short keyword chips, each with a small white tick icon (no dashes):
    "Latihan PERCUMA"
    "Tiada pengalaman"
    "Kerja sendiri"
- Bold green CTA bar at the very bottom: "MOHON SEKARANG" with the number "1700-818-135" on its own line under it
- Small "FatHopes Energy" wordmark with "Program PUSH"

FatHopes forest green (~#15703A) accents and a small recycle/leaf motif. Clean bold
sans-serif, high contrast.

Spell every Malay word EXACTLY as written. No gibberish, no duplicated text, no other
logos, no watermark, no lens distortion. Do not invent or alter any human face.`;

const SALARY_LINE = `

ADD A SALARY HIGHLIGHT: include ONE bold bright-yellow rounded badge sticker near the
headline that reads EXACTLY "Gaji sehingga RM6,000/bulan" (slight tilt, high contrast).
Spell it exactly, render it once. No long dashes.`;

async function generate(base, key, inputImages, prompt) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image-preview",
        prompt, inputImages,
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
  const N = PAIRS.length;

  const outDir = path.join(ROOT, "public", "fathopes", "_gen", "push-hiring");
  await fs.mkdir(outDir, { recursive: true });

  for (let i = 1; i <= N; i++) {
    const n = String(i).padStart(2, "0");
    const [bg, cut] = PAIRS[i - 1];
    const refs = [POOL[bg], POOL[cut]];
    const withSalary = i === 1; // one of them gets the salary badge
    const prompt = PROMPT + (withSalary ? SALARY_LINE : "");
    process.stdout.write(`[${n}/${N}] bg=${bg} cut=${cut}${withSalary ? " +salary" : ""} ... `);
    try {
      const r = await generate(base, key, refs, prompt);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 140)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(outDir, `push-${n}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved push-${n}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/fathopes/_gen/push-hiring/");
}

main().catch((e) => { console.error(e); process.exit(1); });
