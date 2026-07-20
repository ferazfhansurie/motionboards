// Step 1: generate clean cinematic STUDIO BACKGROUNDS for HyperWrapz editorial
// text-overlay posters, using the shop's real photos as style reference. NO text,
// NO logo baked in - those are overlaid in post for crisp editorial typography.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const ASPECT = (process.argv.find((a) => a.startsWith("--aspect=")) || "--aspect=4:5").split("=")[1];
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", ASPECT === "9:16" ? "bg9x16" : "bg");
const REFS = [
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
  const buf = await sharp(file).resize({ width: 1000, height: 1400, fit: "inside" }).jpeg({ quality: 84 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const BASE = `Reference photos = the REAL HyperWrapz car-wrap & detailing studio in Klang,
Malaysia (rows of bright linear LED ceiling lights, a wall of colourful vinyl wrap
rolls on racks, dark grey diamond interlocking garage floor tiles with a bold RED
accent strip, dark walls). Reproduce THIS EXACT real studio environment and
lighting - it must look like an actual photo taken inside this shop, not a CG
render or a generic showroom.

Create a premium, cinematic vertical PHOTOGRAPH for a social-media poster
background: one freshly-wrapped, glossy, spotless car as the hero, parked on the
red accent floor, clean three-quarter front hero angle, moody premium detailing-
studio lighting with real reflections, subtle film grain, true-to-life colours.
Editorial automotive-magazine quality.

IMPORTANT for text overlay: compose with generous CLEAN NEGATIVE SPACE (a calmer,
slightly darker area - upper portion or one side) where poster text will be added
later. Do NOT render ANY text, letters, numbers, logos, watermarks, badges, or
signage anywhere in the image. Keep it a pure clean photograph. No people in frame.`;

const VARIANTS = [
  { slug: "bg-01-suv-teal", extra: "Hero car: a compact SUV wrapped in a deep matte military-green / sage finish (like the reference), dramatic side-and-front three-quarter view, negative space in the upper third." },
  { slug: "bg-02-sedan-grey", extra: "Hero car: a sleek sedan wrapped in satin nardo-grey, low front three-quarter hero angle, the vinyl-roll wall softly blurred behind, negative space on the left side." },
  { slug: "bg-03-sport-black", extra: "Hero car: a sporty coupe wrapped in gloss black with the red floor accent leading toward it, cinematic depth, negative space across the top." },
  { slug: "bg-04-wide-studio", extra: "Wider studio establishing shot: one hero wrapped car centre-slightly-right on the red accent, the full bright linear-light ceiling receding in perspective, vinyl-roll wall on the left, strong negative space upper-left for a big headline." },
];

async function generate(base, key, prompt, inputImages) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt, inputImages, generationOptions: { aspect_ratio: ASPECT, resolution: "2K" } }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    if ((res.status === 429 || /rate.?limit/i.test(JSON.stringify(json))) && attempt <= 8) { process.stdout.write(`(429 #${attempt}) `); await sleep(40000); continue; }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  await fs.mkdir(OUT, { recursive: true });
  const refs = await Promise.all(REFS.map(dataUri));
  const only = process.argv.find((a) => a.startsWith("--slug="));
  for (const v of VARIANTS) {
    if (only && v.slug !== only.split("=")[1]) continue;
    process.stdout.write(`[${v.slug}] ... `);
    const r = await generate(base, key, `${BASE}\n\n${v.extra}`, refs);
    if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0,160)}`); continue; }
    const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    await fs.writeFile(path.join(OUT, `${v.slug}.png`), Buffer.from(await img.arrayBuffer()));
    console.log("saved");
  }
  console.log(`Done. ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
