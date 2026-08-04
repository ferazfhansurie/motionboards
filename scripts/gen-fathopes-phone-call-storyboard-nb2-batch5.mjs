import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const BASE_OUT = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard");
const REFS = [
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/ep1-tube-scene-last-frame.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Kit-Action.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Sparron-Action.png"),
  path.join(ROOT, "public/Fathopes_heroes_animated/superheroes-group.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/lab-style-reference-1.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/lab-style-reference-2.png"),
];
const VARIATIONS = [
  "Direct cinematic version: prioritise clean continuity, restrained camera moves and a strong final confused group reaction.",
  "Phone suspense version: make the vibrating phone the visual anchor, with a dramatic rack focus before the split-screen caller reveal.",
  "Character reaction version: give Kit, Sparron and the third hero distinct confused reactions while preserving exactly three heroes and no extra people.",
  "Villain silhouette version: make the split-screen reveal especially striking, with a clearly readable wide-brim hat silhouette but absolutely no face reveal.",
  "Comedy version: keep the suspense structure but use slightly exaggerated animated reactions, clean cel shading and a subtle awkward pause before the final group confusion.",
];
const BASE = `Create a pure visual storyboard sheet for an 8-second vertical animated FatHopes Heroes continuation. True 9:16 canvas, exactly 8 portrait-oriented panels in a clean 2-column by 4-row layout. No captions, labels, subtitles, speech bubbles, readable text or panel numbers.

Image 1 is only for HQ lighting, tube geometry and worm scale; ignore all people in it. Image 2 locks Kit: face, black hat, teal workwear, silver bands, gloves and proportions. Image 3 locks Sparron: face, blonde hair, green visor, black top, green pants, gloves and proportions. Image 4 locks exactly three superheroes. Images 5 and 6 lock the previous lab clips’ cel-shaded art style, linework, teal/green palette, facial rendering, glass reflections, oily highlights and cinematic lighting.

Exactly three heroes appear in HQ: Kit, Sparron and the third hero from Image 4. Do not include the aunty, any extra woman or any extra character. The worm stays silent. The unseen caller is the future villain; reveal only a black silhouette and distinctive wide-brim hat, never his face or name.

Panel 1: wide HQ lab shot; the phone suddenly vibrates on the table while the three heroes notice it.
Panel 2: macro insert of the vibrating phone, no readable caller ID.
Panel 3: medium reaction shot of exactly three heroes looking at one another, confused.
Panel 4: close-up of Kit reaching for and answering the phone, curious not angry.
Panel 5: split-screen: Kit in the HQ lab on the left; black figure in a dark room on the right. Face hidden, wide-brim hat unmistakable.
Panel 6: closer split-screen; Kit listens while the figure leans toward the phone, showing only hat outline and one gloved hand.
Panel 7: over-the-shoulder shot behind the three heroes crowding around Kit; tube and silent worm remain visible.
Panel 8: final wide shot of exactly three heroes staring at the phone and each other in confusion. End before revealing the villain.

Use varied wide, macro, medium, close-up, split-screen and over-the-shoulder angles. Keep one continuous HQ lab location. No sink, kitchen, faucet or drain. No morphing, changed outfits, duplicate limbs, distorted hands, watermarks or face reveal.`;

async function loadEnv() { for (const file of ["env.local", ".env.local"]) { try { const raw = await fs.readFile(path.join(ROOT, file), "utf8"); for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {} } }
async function upload(base, key, file, index) { const b = await sharp(file).resize({ width: 900, height: 1200, fit: "inside" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer(); const r = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-filename": `phone-storyboard-batch-ref-${index}.jpg` }, body: b }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.url) throw new Error(`upload failed HTTP ${r.status}: ${JSON.stringify(j)}`); return j.url; }
async function generate(base, key, refs, i) { const prompt = `${BASE}\n\nDIRECTING VARIANT: ${VARIATIONS[i]}`; const r = await fetch(`${base}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt, inputImages: refs, generationOptions: { aspect_ratio: "9:16", resolution: "2K" } }) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.status !== "completed" || !j.outputUrl) throw new Error(`variant ${i + 1} failed HTTP ${r.status}: ${JSON.stringify(j).slice(0, 500)}`); const img = await fetch(j.outputUrl, { headers: { Authorization: `Bearer ${key}` } }); const out = path.join(BASE_OUT, `fathopes-ep1-phone-call-storyboard-variant-${i + 1}.png`); await fs.writeFile(out, Buffer.from(await img.arrayBuffer())); console.log(`saved ${out}`); return out; }
async function main() { await loadEnv(); const key = process.env.MB_API_KEY || process.env.MB_KEY; const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, ""); if (!key) throw new Error("Missing Motionboards API key"); const refs = []; for (let i = 0; i < REFS.length; i++) refs.push(await upload(base, key, REFS[i], i + 1)); await Promise.all(VARIATIONS.map((_, i) => generate(base, key, refs, i))); }
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
