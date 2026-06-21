// One-off: generate the Syopz Mall buyback poster THROUGH the MotionBoards API
// (which holds the live Gemini / Nano Banana 2 key), feeding real FatHopes media
// (already on R2) as reference images.
//
//   MB_BASE=https://<your-motionboards-domain> \
//   MB_KEY=mb_xxx \
//   node scripts/gen-syopz-poster.mjs
//
// MB_KEY is a MotionBoards API key (Settings → API keys). MB_BASE is the app URL.
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

const REFS = [
  `${R2}/strand-mall/img-3936.jpg`,             // REAL customer oil being weighed -> background
  `${R2}/strand-mall/img-3953.jpg`,             // green FatHopes tanker truck -> pin
  `${R2}/super-hero/superheroes-group.png`,     // illustrated mascot trio
];

// Real Taylor's photo for the venue element. Set TAYLORS_IMG to a local file
// path; it's sent inline as a data URI (the remote API can't read local paths).
async function taylorsRef() {
  const p = process.env.TAYLORS_IMG;
  if (!p) return null;
  const buf = await fs.readFile(p);
  const ext = path.extname(p).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const PROMPT = `Build a polished 4:5 vertical event-poster TEMPLATE for a Malaysian
used-cooking-oil buyback roadshow. Flat front-on graphic-poster look. IMPORTANT:
leave all banners EMPTY — do NOT render any words, letters, numbers or captions
anywhere. Blank-text plate; text is added later in post.

BACKGROUND = THE REAL PHOTO: use the attached photograph of a customer's used
cooking oil — large bottles/jerry cans of used cooking oil sitting on a weighing
scale at the buyback booth — as the actual full-bleed background. Orient it
upright and compose it cleanly. KEEP IT REAL and photographic; do NOT add any
people or invent any faces. Only EDIT it for feeling: warm, bright, hopeful,
cinematic colour grade with a soft glow and gentle depth — we are selling the
FEELING of everyday people doing their part, not a fake location.

TAYLOR'S CUE = ONE small element only: in the TOP-RIGHT corner add a single
small, clean rounded badge/chip containing the ATTACHED REAL PHOTOGRAPH of the
Taylor's Lakeside building (use the real building photo reference exactly — do
not redraw or stylise it; just place it inside a tidy rounded frame with a thin
white border). It must read clearly as a small graphic venue marker — NOT as the
people's real surroundings. Nothing else hints the location.

BRAND COLOUR: FatHopes forest green ~#15703A. Soft drop shadows.

DESIGN OVERLAY:
- Top: an EMPTY forest-green rounded title banner, blank space for a headline.
- Left-mid: a forest-green teardrop MAP-PIN; inside its circular window place the
  GREEN FatHopes tanker truck (use the green Fuso truck reference) as a clean front
  three-quarter view filling the circle. Small empty green tag above it.
- Lower-left foreground: the THREE illustrated FatHopes superhero mascots (use the
  cartoon reference) as a cheerful waving cut-out group, ~one-third poster height,
  comic-illustration style.
- Bottom: a large EMPTY forest-green rounded banner; reserve a plain white square
  at its right for a QR code.

No words, letters, numbers, gibberish text, extra logos, or watermark. The only
real human faces are the ones already in the background photo; mascots are cartoon.`;

async function generate(base, key, inputImages) {
  const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-3.1-flash-image-preview",
      prompt: PROMPT,
      inputImages,
      generationOptions: { aspect_ratio: "4:5", resolution: "2K" },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json; // { generationId, status, outputUrl }
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("No API key. Run scripts/create-mb-key.mjs first (sets MB_API_KEY in .env.local).");

  const taylors = await taylorsRef();
  const inputImages = taylors ? [...REFS, taylors] : REFS;
  if (!taylors) console.log("(no TAYLORS_IMG set — generating without the venue badge)");

  const outDir = path.join(ROOT, "public", "fathopes", "_gen");
  await fs.mkdir(outDir, { recursive: true });

  const N = 3;
  for (let i = 1; i <= N; i++) {
    process.stdout.write(`Generating variant ${i}/${N}... `);
    try {
      const r = await generate(base, key, inputImages);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 200)}`); continue; }
      const imgRes = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const out = path.join(outDir, `syopz-poster-v5-${i}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved ${path.relative(ROOT, out)} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
