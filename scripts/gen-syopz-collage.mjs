// ONE prompt, generated many times: a photoshop-cutout COLLAGE poster.
// Base = the peace-sign lady; other real recyclers cut out & collaged around her;
// side-view FatHopes truck; bold "NEXT LOCATION / SYOPZ MALL" text.
//   node scripts/gen-syopz-collage.mjs [count]
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

// Order matters. base lady FIRST, then 2 real recyclers, side truck, mascots, Taylor's.
const BASE_LADY = `${REC}/SaveClip.App_487553717_1076733177806158_8274531523985885228_n.jpg`;
const OTHER_PEOPLE = [
  `${REC}/SaveClip.App_487458837_1076733344472808_7011945655324604761_n.jpg`, // man, white polo
  `${REC}/SaveClip.App_487876578_1076733184472824_502451555562078686_n.jpg`,  // man, black, big Saji bottle
];
const SIDE_TRUCK = `${R2}/strand-mall/img-3955.jpg`;                  // clean side profile of the green tanker
const MASCOTS = "public/fathopes/motionboards-gen_1779525165938_2dpc.png"; // 3 cartoon characters
const TAYLORS = process.env.TAYLORS_IMG || "public/fathopes/TaylorsLakeside-scaled-e1653011961805-2048x1483.jpg";

const PROMPT = `Create a bold, eye-catching 4:5 vertical FatHopes used-cooking-oil buyback
poster in a hand-made PHOTOSHOP CUTOUT COLLAGE style (magazine sticker collage).

BACKGROUND / BASE: use the FIRST attached photo — the smiling woman in a tan outfit
and patterned hijab making peace signs, standing in front of the white FatHopes
banner (FatHopes logo + Sustainable Development Goals) with her bottles of used
cooking oil — as the FULL-BLEED BACKGROUND of the whole poster. Do NOT cut her out:
keep her TOGETHER WITH her real surroundings, and make sure the FatHopes branded
banner behind her stays clearly visible. Only apply a warm, bright, hopeful colour
grade. KEEP HER REAL FACE EXACTLY — never alter it. She is the background, not a
floating cutout.

REAL RECYCLER CUTOUTS (on top of that background): cut out ONLY the other attached
real customers (a man in a white polo, a man in black holding a big oil bottle)
with a ROUGH hand-torn ripped-paper magazine edge — ragged white paper rips and
frayed fibres — plus a soft drop shadow. Collage them on top at varied sizes and
slight overlaps. KEEP EVERY REAL FACE EXACTLY as photographed; never invent, swap,
beautify or alter a face.

MASCOT CHARACTERS: include the THREE illustrated FatHopes cartoon characters from
the attached character sheet (a blonde woman with green goggles, a man in a white
lab coat over green, a man in green coveralls and a bucket hat) TOGETHER as ONE
single grouped cluster in a lower corner. Do NOT scatter them individually and do
NOT repeat any character — the three appear once, side by side. Keep their comic style.

USE EACH PERSON ONCE: every real person and every mascot appears exactly ONE time
in the whole poster. Never duplicate, clone or repeat anyone anywhere.

TRUCK: include the green FatHopes tanker truck as a SIDE-VIEW (use the side-profile
truck reference) running along the lower portion of the poster.

TAYLOR'S LAKESIDE: place the attached real photo of the Taylor's Lakeside campus
building as a LARGE, prominent rounded panel / framed photo block — make it clearly
sizeable (a major element of the collage, not a tiny badge) so the venue is obvious.
Use the photo exactly, do not redraw or stylise it.

TEXT — render it ONCE ONLY, BIG, BOLD and perfectly legible with NO spelling
errors, exactly these four lines and nothing else:
  "NEXT LOCATION"  (bold, medium)
  "SYOPZ MALL"  (very large headline)
  "Taylor's Lakeside"  (smaller)
  "8TH JUNE 2026  |  9AM - 4PM"  (small, clear)
Spell every word EXACTLY — especially "SYOPZ MALL" (only one M in MALL). Keep the
text on a clean green area, fully unobstructed — no cutout, mascot or truck
overlapping the letters. Do NOT repeat any text anywhere else — not on the truck,
not duplicated.

STYLE: FatHopes forest green (~#15703A) and white, bold graphic-poster look.
PRONOUNCED hand-torn ripped-paper magazine edges on EVERY cutout — clearly ragged
white torn-paper borders with frayed fibres, consistent on all of them. Vibrant
and celebratory.

Do NOT output any other text or garbled letters. No extra logos, no watermark. Do
NOT generate or alter any REAL human face — real faces come from the attached
photos; only the three mascots are cartoon.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(base, key, inputImages) {
  for (let attempt = 1; ; attempt++) {
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
    if (res.ok) return json;
    // 429 / rate-limit: wait and retry (up to 5 times).
    if ((res.status === 429 || /rate-limit/i.test(JSON.stringify(json))) && attempt <= 12) {
      process.stdout.write(`(429 #${attempt}, waiting 60s) `);
      await sleep(60000);
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("No API key (MB_API_KEY in .env.local).");
  const N = parseInt(process.argv[2] || "2", 10);
  const label = process.argv[3] || "A";

  const inputImages = [
    await dataUri(BASE_LADY),
    ...(await Promise.all(OTHER_PEOPLE.map(dataUri))),
    SIDE_TRUCK,
    await dataUri(MASCOTS),
    await dataUri(TAYLORS),
  ];
  console.log(`${inputImages.length} reference images; round ${label}, generating ${N} times.`);

  const outDir = path.join(ROOT, "public", "fathopes", "_gen", "collage");
  await fs.mkdir(outDir, { recursive: true });

  for (let i = 1; i <= N; i++) {
    const n = `${label}${String(i).padStart(2, "0")}`;
    process.stdout.write(`[${n}/${N}] ... `);
    try {
      const r = await generate(base, key, inputImages);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 160)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(outDir, `collage-${n}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved collage-${n}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/fathopes/_gen/collage/");
}

main().catch((e) => { console.error(e); process.exit(1); });
