// Generate 20 layout variations of the Syopz Mall buyback poster via Nano Banana 2
// (through the MotionBoards API). Each variation cycles a different REAL recycler
// photo as the background and a distinct layout of the elements.
//   TAYLORS_IMG=<path> node scripts/gen-syopz-20.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R2 = "https://pub-88ebab5b8de2446f969ca2994121479f.r2.dev/fathopes";
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
  const buf = await fs.readFile(path.isAbsolute(p) ? p : path.join(ROOT, p));
  const ext = path.extname(p).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// Real recycler backgrounds (local files -> sent as data URIs)
const BG = {
  polo:   `${REC}/SaveClip.App_487458837_1076733344472808_7011945655324604761_n.jpg`, // man, white polo, recyclables box
  peace:  `${REC}/SaveClip.App_487553717_1076733177806158_8274531523985885228_n.jpg`, // woman, peace sign, bottles
  blue:   `${REC}/SaveClip.App_487556205_1076733361139473_2992914642562998578_n.jpg`, // man, blue, two bottles + truck
  saji:   `${REC}/SaveClip.App_487876578_1076733184472824_502451555562078686_n.jpg`,  // man, black, big Saji bottle + truck
  scale:  `${REC}/SaveClip.App_487957731_1076733277806148_493508791530156442_n.jpg`,  // bottles on weighing scale (object)
  truckppl:`${REC}/SaveClip.App_488224071_1076733451139464_4295961468830160003_n.jpg`,// officials at truck mural
};

const TRUCK = `${R2}/strand-mall/img-3953.jpg`;
const MASCOTS = `${R2}/super-hero/superheroes-group.png`;

const BASE = `Build a polished 4:5 vertical event-poster for a FatHopes used-cooking-oil
buyback roadshow at Syopz Mall. Flat graphic-poster look, FatHopes forest green
~#15703A, soft drop shadows. BLANK-TEXT PLATE: leave every banner EMPTY — no words,
letters or numbers anywhere (text is added later in post).

BACKGROUND: use the attached REAL FatHopes recycler photograph as the full-bleed
background. Keep it photographic and KEEP ALL REAL FACES EXACTLY as shot — do NOT
redraw, beautify, swap, or invent any face, and do not add or remove people. Only
apply a warm, bright, hopeful cinematic colour grade — we are selling the feeling
of everyday people doing their part.

ELEMENTS (use the reference images): a forest-green teardrop MAP-PIN with the GREEN
FatHopes tanker truck inside its circle; the THREE illustrated FatHopes superhero
mascots as cartoon cut-outs; a small clean rounded badge showing the REAL Taylor's
Lakeside building photo as a venue marker (place it exactly, do not stylise); an
empty green title banner; an empty green bottom banner with a blank white QR square.

LAYOUT FOR THIS VARIATION — follow precisely: `;

const NEG = `
No gibberish text, no extra logos, no watermark, no lens distortion. The only real
human faces are the ones already in the background photo; the mascots stay cartoon.`;

// 20 distinct layouts. m=mascots, t=truck-pin, x=taylors badge.
const V = [
  { bg: "polo",   l: "Top full-width headline bar; LARGE truck-pin upper-left overlapping the bar; mascots LARGE along the whole bottom edge; small Taylor's badge top-right; full-width bottom banner; QR bottom-right." },
  { bg: "peace",  l: "Centered rounded headline PILL at top; SMALL truck-pin mid-left; MEDIUM mascots bottom-right; Taylor's badge top-left; slim bottom ribbon banner; QR bottom-left." },
  { bg: "blue",   l: "Left vertical headline panel down the left edge; MEDIUM truck-pin top-center; small mascots lower-left; Taylor's badge bottom-right; rounded bottom banner; QR centered in the bottom banner." },
  { bg: "saji",   l: "Corner-tab headline top-left; LARGE truck-pin center-right; MEDIUM mascots bottom-left waving; medium Taylor's badge top-right; angled ribbon bottom banner; QR bottom-right." },
  { bg: "truckppl", l: "Top headline bar with fully rounded ends; SMALL truck-pin top-right; LARGE mascots spanning the bottom; small Taylor's badge bottom-left; thick bottom banner; QR right." },
  { bg: "scale",  l: "No top banner (leave clean head-space); MEDIUM truck-pin left; small mascots bottom-center; LARGE Taylor's badge top-right; full bottom banner; QR bottom-right." },
  { bg: "polo",   l: "Diagonal green sash across the top for the headline; small truck-pin bottom-left; MEDIUM mascots on the right side; Taylor's badge top-left; rounded bottom banner; QR left." },
  { bg: "blue",   l: "Headline PILL top-center; LARGE truck-pin bottom-left; small mascots top-right; Taylor's badge mid-right; slim bottom banner; QR bottom-right." },
  { bg: "saji",   l: "Two-tier top (thin strip + pill); MEDIUM truck-pin dead center; LARGE mascots bottom-left; Taylor's badge top-right; full bottom banner; QR center-right." },
  { bg: "peace",  l: "Top headline bar; small truck-pin top-left; MEDIUM mascots bottom-right; Taylor's badge bottom-left; rounded bottom banner with the blank QR square integrated at center." },
  { bg: "truckppl", l: "Bold top banner taking ~25% of the height; MEDIUM truck-pin mid-left; small mascots bottom-left; small Taylor's badge top-right; thin bottom ribbon; QR bottom-right." },
  { bg: "saji",   l: "Minimal: small headline pill top-left; LARGE truck-pin center; NO mascots; Taylor's badge top-right; full bottom banner; QR bottom-right.", noMascots: true },
  { bg: "blue",   l: "Headline ribbon top-right; MEDIUM truck-pin bottom-center; LARGE mascots stacked vertically on the left side; Taylor's badge bottom-right; slim bottom banner; QR left." },
  { bg: "polo",   l: "Top full bar; MEDIUM truck-pin upper-right; MEDIUM mascots bottom-center; Taylor's badge top-left; bottom banner with a rounded right end holding the QR." },
  { bg: "peace",  l: "Small headline pill top-center; small truck-pin bottom-right; LARGE mascots bottom-left; Taylor's badge mid-left; full-width bottom banner; QR center." },
  { bg: "saji",   l: "Asymmetric: headline fills the top-left half; MEDIUM truck-pin top-right; small mascots bottom-right; Taylor's badge bottom-left; angled bottom ribbon; QR right." },
  { bg: "truckppl", l: "Rounded top banner; LARGE truck-pin top-left; MEDIUM mascots bottom-right; NO badge — instead place the real Taylor's photo as a thin horizontal strip along the very bottom edge; bottom banner above it; QR right." },
  { bg: "blue",   l: "Top headline bar; small truck-pin center-left; MEDIUM mascots bottom-left; LARGE Taylor's badge top-right; slim bottom banner; QR bottom-right." },
  { bg: "polo",   l: "Headline pill top-right; MEDIUM truck-pin bottom-left; small mascots top-left; Taylor's badge bottom-right; full bottom banner; QR center." },
  { bg: "scale",  l: "Bold top banner; MEDIUM truck-pin center; LARGE mascots across the very bottom; small Taylor's badge top-left; thick bottom banner; QR bottom-right." },
];

async function generate(base, key, inputImages, prompt) {
  const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-3.1-flash-image-preview",
      prompt,
      inputImages,
      generationOptions: { aspect_ratio: "4:5", resolution: "2K" },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("No API key (MB_API_KEY in .env.local).");

  const taylors = process.env.TAYLORS_IMG ? await dataUri(process.env.TAYLORS_IMG) : null;
  if (!taylors) console.log("(no TAYLORS_IMG — generating without the Taylor's badge)");

  // Pre-encode each distinct background once.
  const bgCache = {};
  for (const key2 of new Set(V.map((v) => v.bg))) bgCache[key2] = await dataUri(BG[key2]);

  const outDir = path.join(ROOT, "public", "fathopes", "_gen", "variations");
  await fs.mkdir(outDir, { recursive: true });

  for (let i = 0; i < V.length; i++) {
    const v = V[i];
    const n = String(i + 1).padStart(2, "0");
    process.stdout.write(`[${n}/20] ${v.bg} ... `);
    const refs = [bgCache[v.bg], TRUCK];
    if (!v.noMascots) refs.push(MASCOTS);
    if (taylors) refs.push(taylors);
    const prompt = BASE + v.l + NEG;
    try {
      const r = await generate(base, key, refs, prompt);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 160)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(outDir, `var-${n}-${v.bg}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved var-${n}-${v.bg}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/fathopes/_gen/variations/");
}

main().catch((e) => { console.error(e); process.exit(1); });
