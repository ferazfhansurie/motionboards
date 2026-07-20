// English AI-drawn infographic-style posters (like the client's original real
// reference posters: clean vector/graphic design, benefit tags, pricing cards,
// icons) for 3 categories. Real HyperWrapz logo is the ONLY image reference for
// the generation, and is ALSO composited in seamlessly afterward (pixel-perfect,
// no redraw) via the transparent cutout technique.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const DIR = path.join(ROOT, "Hyperwrapz & Detailing");
const OUT_DIR = path.join(DIR, "_gen", "infographic");
const LOGO_RAW = path.join(DIR, "_gen", "HYPERWRAPZ LOGO.jpeg");
const LOGO_CUTOUT = path.join(DIR, "_gen", "HYPERWRAPZ-LOGO-cutout.png");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
async function toDataUri(p) {
  const buf = await fs.readFile(p);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}
async function safePath(p) {
  try { await fs.access(p); } catch { return p; }
  const ext = path.extname(p);
  const base = p.slice(0, -ext.length);
  for (let n = 2; ; n++) {
    const candidate = `${base}-v${n}${ext}`;
    try { await fs.access(candidate); } catch { return candidate; }
  }
}

const BAND = `Leave the top 10% of the poster a completely empty, plain dark band
(no text, no logo) - a real logo gets composited there afterward, so the layout
below should start as if a masthead logo already sits above it. Use the attached
logo image only as a colour/brand reference (cyan-blue and silver, NOT gold),
this is the only image reference.\n\n`;

const POSTERS = [
  {
    key: "colour-wrap",
    content: `Match this exact real reference poster layout (a car-wrap shop's
"Colour Wrapping Vinyl" price sheet), rebuilt for the HyperWrapz brand
(cyan-blue/silver instead of the reference's own colours):

1. Huge bold headline "COLOUR WRAPPING VINYL" (COLOUR in white, WRAPPING in
   bright cyan-blue) with a dramatic photoreal hero car (colour-shift
   purple-to-blue wrap, front three-quarter angle) bleeding in behind/beside it.
2. A row of 6 small icon+label benefits directly under the headline: Protect
   Original Paint, Scratch Resistant, UV Protection, Easy Maintenance, Enhance
   Look, Remove Without Damaging Paint.
3. Four tall vertical brand cards side by side, each with its OWN distinct
   photoreal car photo wrapped in a different colour, the brand name at top and
   price at bottom in bold: Nextfeel (purple car) RM2900 | Atmos Shield (blue
   car) RM3500 | Naka (green car) RM3800 | TeckWrap (gold car) RM3800.
4. A banner: "WE HAVE MORE THAN 3000+ COLOURS FOR YOU TO CHOOSE" with colour
   swatch fan-deck graphics on both sides.
5. A row of 6 small car headlight/fender close-up photos labelled: Matte,
   Satin, Satin Metallic, Ultra Gloss, Gloss Metallic, Chrome Colours.
6. A banner "FULL DESIGN AND INJECT PRINTING AS WELL!" above a row of 4 wild
   custom-livery wrapped car photos (graffiti, racing stripes, abstract art,
   gold chrome).
7. Bottom row of 5 icon+label benefits: Experienced Team, Premium Quality
   Vinyl, Professional Installation, Long Lasting Durability, After Sales
   Support.
8. Closing tagline: "CHANGE THE LOOK. PROTECT IN STYLE."`,
  },
  {
    key: "ppf-coating",
    content: `Match this exact real reference poster layout (a car-detailing
shop's "PPF, Coating & Combos" price sheet), rebuilt for the HyperWrapz brand
(cyan-blue/silver instead of the reference's own colours):

1. Tagline under the masthead area: "PROTECT WHAT MATTERS", then a row of 3
   icon+label benefits: Premium Protection, Advanced Technology, Lasting
   Excellence.
2. A dramatic photoreal hero car bleeding in near the top.
3. Four tall vertical service cards side by side, each with its own themed
   close-up photoreal car photo and an icon, title, and price: Tinted
   (Sputtering HD) RM1200 | Coating (Graphene 10H) RM1200 | Full Front PPF
   (8.5MIL) RM1900 | Full Car PPF (8.5MIL) RM3800.
4. Two wide combo cards side by side, each with a moody car photo background,
   a bold price badge, and a bullet list with small icons:
   "3 In 1 Combo Lite" RM4800 - Full Front PPF (8.5MIL), Full Car Tinted
   (Sputtering HD), Full Car Coating (Graphene 10H).
   "3 In 1 Combo Ultra" RM5800 - Full Car PPF (8.5MIL), Full Car Tinted (Royal
   Titanium HD), Full Car Coating (Graphene 10H).
5. Bottom row of 4 icon+label benefits: Premium Quality, Professional
   Installation, Long Lasting Performance, Warranty Assured.
6. Closing tagline: "SHIELD YOUR DRIVE. ELEVATE EVERY JOURNEY."`,
  },
  {
    key: "tinting",
    content: `Match this exact real reference poster layout (a car-detailing
shop's "Window Film - Tinted" price sheet), rebuilt for the HyperWrapz brand
(cyan-blue/silver instead of the reference's own colours):

1. Headline "WINDOW FILM - TINTED" with a dramatic photoreal hero car (rear
   three-quarter angle, city night background) bleeding in behind it.
2. A row of 5 icon+label benefits: High Heat Rejection, UV Protection
   Excellent, Enhanced Privacy, Crystal Clear Visibility, Durable & Long
   Lasting.
3. Three horizontal tier bands stacked vertically, each colour-coded
   (green/blue/gold-cyan), each containing: the tier name as a bold heading,
   a left column of spec bullet points with small icons, a middle column of 3
   pricing rows (Small/Medium/Large) each with a small car icon, and a tinted
   car-window photo on the right edge of the band.
   Tier 1 "Nano Carbon Ceramic HD" (green): Heat Rejection/IRR 95%, UV
   Rejection/UVR 97%, Darkness/VLT 30% 50% 80% 95%, Thickness 2Mil, 5 Years
   Workmanship, 5 Years Colour. Pricing: Small RM850, Medium RM1000, Large
   RM1150.
   Tier 2 "Ultra Sputtering HD" (blue): Heat Rejection/IRR 97%, UV
   Rejection/UVR 99%, Darkness/VLT 30% 50% 80% 95%, Thickness 4Mil, 5 Years
   Workmanship, 5 Years Colour. Pricing: Small RM1300, Medium RM1500, Large
   RM1700.
   Tier 3 "Royal Titanium HD+" (gold-cyan): Heat Rejection/IRR 99%, UV
   Rejection/UVR 99%, Darkness/VLT 30% 50% 80% 95%, Thickness 4Mil+, 10 Years
   Workmanship, 10 Years Colour. Pricing: Small RM1500, Medium RM1700, Large
   RM2000.
4. Bottom row of 5 icon+label benefits: Blocks Extreme Heat, Protects Skin &
   Interior, Comfort & Privacy, Fade Resistant & Durable, Premium Quality
   Window Film.
5. Closing tagline: "DRIVE COOL. STAY PROTECTED." with a small subtagline
   "PREMIUM QUALITY - SUPERIOR PERFORMANCE - TRUSTED PROTECTION".`,
  },
];

async function generate(base, key, prompt, refDataUri) {
  const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-3.1-flash-image-preview",
      prompt,
      inputImages: [refDataUri],
      generationOptions: { aspect_ratio: "3:4", resolution: "2K" },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

async function compositeLogo(bgPath, outPath) {
  const bg = sharp(bgPath);
  const meta = await bg.metadata();
  const W = meta.width, H = meta.height;
  const bandH = Math.round(H * 0.14);
  const logo = sharp(LOGO_CUTOUT);
  const logoMeta = await logo.metadata();
  const scaleByHeight = (bandH * 0.82) / logoMeta.height;
  const scaleByWidth = (W * 0.62) / logoMeta.width;
  const scale = Math.min(scaleByHeight, scaleByWidth);
  const logoTargetW = Math.round(logoMeta.width * scale);
  const logoTargetH = Math.round(logoMeta.height * scale);
  const logoBuf = await logo.resize(logoTargetW, logoTargetH).png().toBuffer();
  const left = Math.round((W - logoTargetW) / 2);
  const top = Math.round((bandH - logoTargetH) / 2);
  await bg.composite([{ input: logoBuf, left, top: Math.max(top, 10) }]).toFile(outPath);
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  await fs.mkdir(OUT_DIR, { recursive: true });
  const logoUri = await toDataUri(LOGO_RAW);

  const only = process.argv[2];
  for (const p of POSTERS) {
    if (only && p.key !== only) continue;
    process.stdout.write(`[${p.key}] ... `);
    const prompt = `${BAND}${p.content}`;
    const r = await generate(base, key, prompt, logoUri);
    if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0,200)}`); continue; }
    const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    const rawOut = await safePath(path.join(OUT_DIR, `${p.key}-raw.png`));
    await fs.writeFile(rawOut, Buffer.from(await img.arrayBuffer()));
    const finalOut = await safePath(path.join(OUT_DIR, `${p.key}.png`));
    await compositeLogo(rawOut, finalOut);
    console.log(`saved ${path.relative(ROOT, finalOut)}`);
  }
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
