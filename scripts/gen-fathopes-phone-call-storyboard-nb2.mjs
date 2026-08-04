import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/fathopes-ep1-phone-call-villain-storyboard-nb2-v2-style.png");
const REFS = [
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/ep1-tube-scene-last-frame.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Kit-Action.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Sparron-Action.png"),
  path.join(ROOT, "public/Fathopes_heroes_animated/superheroes-group.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/lab-style-reference-1.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/lab-style-reference-2.png"),
];
async function loadEnv() { for (const file of ["env.local", ".env.local"]) { try { const raw = await fs.readFile(path.join(ROOT, file), "utf8"); for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {} } }
async function dataUri(file) { const b = await sharp(file).resize({ width: 900, height: 1200, fit: "inside" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer(); return `data:image/jpeg;base64,${b.toString("base64")}`; }
async function upload(base, key, file, index) { const b = await sharp(file).resize({ width: 900, height: 1200, fit: "inside" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer(); const r = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-filename": `phone-storyboard-ref-${index}.jpg` }, body: b }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.url) throw new Error(`upload failed HTTP ${r.status}: ${JSON.stringify(j)}`); return j.url; }
const prompt = `Create a pure visual storyboard sheet for an 8-second vertical animated FatHopes Heroes continuation. Use a true 9:16 canvas with exactly 8 portrait-oriented panels arranged in a clean 2-column by 4-row layout. No captions, labels, subtitles, speech bubbles, readable text or panel numbers.

Reference roles: Image 1 is only for HQ lab lighting, tube geometry and worm scale; ignore every person visible in Image 1 and do not copy them. Image 2 locks Kit’s face, black hat, teal workwear, gloves and proportions. Image 3 locks Sparron’s face, blonde hair, green visor, black top, green pants and gloves. Image 4 locks exactly three superheroes. Images 5 and 6 are art-style references from the previous lab-only clips: copy their 2D linework, cel shading, facial rendering, teal/green palette, glass reflections, oily highlights, lab lighting and cinematic framing. Do not use any separate original worm reference. Do not include the aunty or any extra woman.

Preserve character identity, outfits, proportions, linework, colours, HQ laboratory and clear tube consistently. Match the previous lab clip art style exactly, not a new illustration style. Exactly three heroes appear in HQ: Kit, Sparron and the third hero from Image 4. This is a suspense-comedy phone call. The unseen caller is the future villain, but do not reveal his identity or face.

Panel 1: clean wide HQ laboratory shot. The three heroes stand around the specimen tube. A phone on the lab table suddenly vibrates and rings; everyone notices it.
Panel 2: extreme insert close-up of the phone vibrating on the metal table. No readable caller ID or text.
Panel 3: medium reaction shot of Kit, Sparron and the third hero looking at one another, confused and cautious. The phone continues ringing in the foreground.
Panel 4: close-up of Kit reaching for and answering the phone. His expression is curious, not angry.
Panel 5: cinematic split-screen composition. Left side shows Kit holding the phone in the HQ lab; right side shows only a black figure in a dark room answering the call. The figure’s face is completely hidden in shadow; make the wide-brim hat silhouette unmistakably visible, but reveal no facial features.
Panel 6: closer split-screen. Kit listens on the left; on the right, the mysterious figure leans slightly toward the phone. Keep the face hidden, reveal only the clear wide-brim hat outline and one gloved hand.
Panel 7: over-the-shoulder shot behind the three heroes as they crowd around Kit, all confused about who is calling. The tube and silent worm remain visible behind them.
Panel 8: final wide shot of exactly three heroes staring at the phone and each other in confusion while the split-screen black figure remains a vague reflection on the phone glass. End before revealing the villain.

Use varied camera angles: wide establishing, insert macro, reaction medium shot, close-up, split-screen, over-the-shoulder and final wide shot. Keep the lab as one continuous location. No sink, kitchen, faucet or drain. Exactly three heroes only; no aunty, no extra woman, no extra characters, no face reveal, no villain name, no readable text, no morphing, no changed outfits, no distorted hands, no watermarks. The aunty must not appear in any panel or reference interpretation.`;
async function main() { await loadEnv(); const key = process.env.MB_API_KEY || process.env.MB_KEY; const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, ""); if (!key) throw new Error("Missing Motionboards API key"); const inputImages = []; for (let i = 0; i < REFS.length; i++) inputImages.push(await upload(base, key, REFS[i], i + 1)); const r = await fetch(`${base}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt, inputImages, generationOptions: { aspect_ratio: "9:16", resolution: "2K" } }) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.status !== "completed" || !j.outputUrl) throw new Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0, 800)}`); const img = await fetch(j.outputUrl, { headers: { Authorization: `Bearer ${key}` } }); await fs.mkdir(path.dirname(OUT), { recursive: true }); await fs.writeFile(OUT, Buffer.from(await img.arrayBuffer())); console.log(`saved ${OUT}`); }
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
