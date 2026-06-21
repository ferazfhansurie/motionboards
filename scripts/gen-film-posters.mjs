// 5 film-screening-night poster variations (4:5), film-student aesthetics, all with a
// drive-in motif. Uses the Universiti Malaya logo as a reference (placed in a corner).
//   node scripts/gen-film-posters.mjs [stylesCSV]
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOGO = "public/fathopes/_gen/images (1).png"; // Universiti Malaya logo

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
  return `data:image/png;base64,${buf.toString("base64")}`;
}

const LOGO_LINE = `Place the ATTACHED Universiti Malaya logo (blue shield crest + "UNIVERSITI
MALAYA" wordmark) small and clean in a bottom corner. Reproduce the logo EXACTLY as given
— do not redraw, recolour or distort it. Render all OTHER text with perfect spelling.`;

const EVENT = `Event text, perfectly spelled: title "SCREENING NIGHT", then
"Dewan Auditorium, Anjung Ilmu" and "Friday · 12 June 2026".`;

const STYLES = [
  { key: "a24", p:
`A moody, minimalist 4:5 art-house film poster in the style of A24 / indie cinema. Single
haunting focal image: a lone vintage car seen from behind in a dark empty field, facing a
giant glowing white drive-in screen on the horizon with soft projector haze. Vast negative
space, deep shadows, muted desaturated palette with one warm amber accent from the screen
glow. Subtle 35mm film grain. Elegant thin CONDENSED SERIF typography, small and refined.
${EVENT} ${LOGO_LINE} Cinematic, restrained, mysterious. No clutter, no other logos.` },

  { key: "drivein-retro", p:
`A retro 1950s drive-in cinema poster, 4:5, screen-printed vintage illustration. Rows of
classic tail-finned cars at night facing a huge white outdoor movie screen, a glowing neon
marquee, starry indigo sky, a big crescent moon, string lights. Warm nostalgic palette:
cream, retro red, teal, mustard. Halftone print texture and aged-paper grain. Bold retro
script + chunky condensed sans type. ${EVENT} ${LOGO_LINE} Fun, nostalgic, collectible
vintage-poster feel.` },

  { key: "riso", p:
`An indie film-festival poster, 4:5, in a 2-colour RISOGRAPH print style. Limited palette of
fluorescent orange and deep teal only, heavy halftone dots and slight mis-registration ink
texture. Flat bold graphic composition: a stylised projector throwing a wide beam of light
onto a simple geometric drive-in screen with tiny car silhouettes below. Big bold
grotesk/Helvetica-style type, editorial and confident. ${EVENT} ${LOGO_LINE} Zine energy,
art-school cool, high contrast.` },

  { key: "synthwave", p:
`A neon synthwave film-night poster, 4:5, 1980s retro-futurist aesthetic. A car shot from
behind facing a glowing drive-in screen on a chrome-lined road running into a magenta-and-
purple gradient sunset with a glowing wireframe grid horizon and a giant pixel sun. Neon
pink/cyan glow, VHS scanlines, subtle chromatic aberration, starry sky. Chrome 3D title type
with neon outline. ${EVENT} ${LOGO_LINE} Electric, nostalgic-cool, vaporwave-adjacent.` },

  { key: "vintage-toon", p:
`A vintage 1970s hand-drawn COMIC CARICATURE movie poster, 4:5, in the exaggerated cartoon
style of classic Mad-magazine / Jack Davis drive-in comedy posters. Bright radial sunburst
background from deep red at the edges to warm yellow in the centre, bold black ink outlines,
halftone shading, saturated retro colours. TOP: a big glowing MARQUEE sign made of rows of
round light bulbs spelling "SCREENING NIGHT" in chunky 3D block letters. MIDDLE: a large
glowing drive-in movie SCREEN bursting with a fun montage of tiny movie scenes, tilted in
perspective. FOREGROUND: a lively, crowded, funny scene of exaggerated cartoon characters at
a drive-in — young couples in colourful convertible cars, friends with popcorn and soda, a
snack bar, laughing faces and goofy poses, lots of playful detail. Event text on a banner
ribbon, perfectly spelled: "Dewan Auditorium, Anjung Ilmu" and "Friday · 12 June 2026".
${LOGO_LINE} Fun, chaotic, nostalgic, comedic. ORIGINAL artwork — do not copy any existing
poster.` },

  { key: "criterion", p:
`A sophisticated cinephile poster, 4:5, in the refined spirit of the Criterion Collection. A
tasteful photographic golden-hour drive-in scene: a few cars in soft focus facing a large
screen, warm dusk sky, gentle lens flare, shallow depth of field, filmic colour grade. Clean
wide margins, a thin rule-line frame, a small spine-style "No. 01" in a corner. Classy serif
typography, generous spacing. ${EVENT} ${LOGO_LINE} Curated, timeless, gallery-grade.` },
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
  const only = (process.argv[2] || "").split(",").map((s) => s.trim()).filter(Boolean);

  const logo = await dataUri(LOGO);
  const outDir = path.join(ROOT, "public", "fathopes", "_gen", "film-night");
  await fs.mkdir(outDir, { recursive: true });

  for (const s of STYLES) {
    if (only.length && !only.includes(s.key)) continue;
    process.stdout.write(`[${s.key}] ... `);
    try {
      const r = await generate(base, key, [logo], s.p);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 140)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(outDir, `film-${s.key}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved film-${s.key}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/fathopes/_gen/film-night/");
}

main().catch((e) => { console.error(e); process.exit(1); });
