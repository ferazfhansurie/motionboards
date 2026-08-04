import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OUT = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/ep1-fast-omni-kitchen-bag-lab-v2.mp4");
const IMAGES = [
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard-frames/clip2-next15-last-frame.jpg"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/aunty-reference-from-clip1.jpg"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Kit-Action.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Sparron-Action.png"),
  path.join(ROOT, "fathopes-heroes-series-bible/Generated image 1.png"),
  path.join(ROOT, "public/Fathopes_heroes_animated/superheroes-group.png"),
];
const PROMPT = `9:16 vertical continuation. @Image1 = exact start frame. @Image2 = aunty from the previous clip. @Image3 = Kit. @Image4 = Sparron. @Image5 = oily worm. @Image6 = three-hero lab lineup. Use native generated audio and hard clean cuts between shots.

Lock faces, hair, proportions, colours, outfits, kitchen and worm design. Kit always wears teal workwear, silver bands, black hat and black gloves. Sparron always wears black top, green pants, green visor and gloves. Aunty matches @Image2 exactly. The worm is separate from Glinciro.

1. Continue exactly from @Image1 in the same kitchen. Kit supports the worm with both hands while Sparron holds an open black bag below it.
2. Beat cut close-up: Kit lowers the worm into the bag. Movement follows grip and gravity.
3. Beat cut top-down: worm fully enters; Sparron closes and ties the bag only afterward. Kit holds it steady.
4. Beat cut to @Image2 aunty. She smiles and says naturally in KL style: “Thank you geng FatHopes.” Only the aunty and one hero are visible; do not combine this with the lab.
5. Beat cut to a clean FatHopes lab wide shot. Kit, Sparron and the third hero from @Image6 stand around a table; the sealed tube with the worm is behind them. This is a new location, not the kitchen.
6. Beat cut to worm POV inside the tube. Sparron says: “Hmm macam mana boleh wujud benda ni?”
7. Beat cut medium reverse shot. Kit replies dryly: “Taktahula, tapi aku tahu dia buruk.”
8. Beat cut to the worm’s sad face behind glass. Oily drips fall; heroes blur behind it.

AUDIO: generate audible natural dialogue, clear KL delivery, kitchen ambience, bag rustle, glove friction, lab tone and small comedic impacts. The final file must contain an audio track.

CAMERA: stable close-up, top-down, wide establishing, tube POV and reverse medium angles. One action per shot. Keep gravity, hand contact, bag weight and object positions continuous.

DO NOT morph faces, change outfits, teleport objects, reverse gravity, close the bag early, add Glinciro, mix kitchen and lab backgrounds, show unrelated characters in a shot, add subtitles, captions, speech bubbles, text, watermarks, flicker, warped hands or duplicate limbs.`;

async function loadEnv() { for (const file of ["env.local", ".env.local"]) { try { const raw = await fs.readFile(path.join(ROOT, file), "utf8"); for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {} } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function upload(base, key, file, name) { const body = await fs.readFile(file); const ext = path.extname(file).toLowerCase(); const type = ext === ".png" ? "image/png" : ext === ".mp3" ? "audio/mpeg" : "image/jpeg"; const res = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": type, "x-filename": name + ext }, body }); const j = await res.json().catch(() => ({})); if (!res.ok || !j.url) throw new Error(`upload failed ${file}: HTTP ${res.status} ${JSON.stringify(j)}`); return j.url; }

async function main() {
  await loadEnv(); const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, ""); const key = process.env.MB_KEY || process.env.MB_API_KEY; if (!key) throw new Error("Missing Motionboards API key");
  const images = []; for (let i = 0; i < IMAGES.length; i++) { images.push(await upload(base, key, IMAGES[i], `fathopes-fast-omni-image-${i + 1}`)); console.log(`uploaded Image${i + 1}`); }
  const submit = await fetch(`${base}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages: images, generationOptions: { aspect_ratio: "9:16", resolution: "720p", duration: "15s", generate_audio: true } }) });
  const j = await submit.json().catch(() => ({})); if (!submit.ok || !j.requestId || !j.generationId) throw new Error(`submit failed HTTP ${submit.status}: ${JSON.stringify(j)}`); console.log(`submitted ${j.requestId}`);
  const q = new URLSearchParams({ requestId: j.requestId, modelId: MODEL, generationId: j.generationId, byteplusVideo: "true", durationSec: "15", resolution: "720p" }); let outputUrl;
  for (let i = 0; i < 180; i++) { await sleep(5000); const res = await fetch(`${base}/api/generate/status?${q}`, { headers: { Authorization: `Bearer ${key}` } }); const s = await res.json().catch(() => ({})); if (s.status === "completed" && s.outputUrl) { outputUrl = s.outputUrl; break; } if (s.status === "failed") throw new Error(`generation failed: ${s.error || "unknown"}`); if (i % 6 === 0) console.log(`${i * 5}s ${s.status || "processing"}`); }
  if (!outputUrl) throw new Error("Timed out waiting for Fast Omni video"); const video = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } }); await fs.mkdir(path.dirname(OUT), { recursive: true }); await fs.writeFile(OUT, Buffer.from(await video.arrayBuffer())); console.log(`saved ${OUT}`);
}
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
