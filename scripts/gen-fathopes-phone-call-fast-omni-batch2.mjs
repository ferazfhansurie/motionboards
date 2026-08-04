import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const REFS = [
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/fathopes-ep1-phone-call-storyboard-variant-5.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Kit-Action.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Sparron-Action.png"),
  path.join(ROOT, "public/Fathopes_heroes_animated/superheroes-group.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/ep1-tube-scene-last-frame.png"),
];
const OUT_DIR = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips");
const VARIANTS = [
  "Take 1: restrained suspense, natural acting, smooth camera movement and a strong final confused reaction.",
  "Take 2: slightly more cinematic tension, stronger phone insert, more dramatic split-screen and a clearer hat silhouette, while keeping the acting grounded and natural.",
];
const BASE_PROMPT = `8-second 9:16 vertical image-to-video continuation. @Image1 is the approved storyboard; follow its shot order and framing. @Image2 locks Kit. @Image3 locks Sparron. @Image4 locks the third hero and three-hero lineup. @Image5 locks the established HQ tube style.

Start with the phone ringing in the FatHopes HQ lab. Do not start from the tube frame. Preserve the established 2D cel-shaded art style, teal/green palette, linework, faces, hairstyles, outfits, proportions, lab lighting, glass reflections and oily worm design. Exactly three heroes appear in HQ: Kit, Sparron and the third hero. No aunty.

Follow the storyboard with clean sequential shots: wide lab shot as the phone vibrates and the three heroes notice it; macro insert of the vibrating phone with no readable caller ID; medium reaction of exactly three heroes looking at one another; Kit answers and says naturally, “Hello?”; cinematic split-screen with Kit in the lab on the left and an unknown black figure in darkness on the right; keep the figure’s face hidden and show only a clear wide-brim hat silhouette and one gloved hand; the unknown male voice says calmly, “You have something that belongs to me”; cut back to the three heroes looking at the phone and each other, confused and uneasy; end before revealing the villain’s face or name.

CAMERA: smooth establishing wide, macro phone insert, reaction medium, Kit close-up, dramatic split-screen, over-the-shoulder and final group shot. One clear action per shot, restrained movement and clean framing.

AUDIO / EDITING: low-volume suspense music bed with a subtle pulse, realistic HQ ambience, fluorescent hum, phone vibration, button tap, quiet footsteps, glass resonance and a restrained low impact at the final reaction. Cut every shot precisely on strong music beats. Use the phone ring as the opening cue, a sharp beat for the split-screen reveal, then lower the music under the caller’s dialogue. Dialogue must stay clear. Kit is a calm young adult; the caller is low, controlled and threatening.

DO NOT show the aunty, sink, kitchen, faucet or drain. Do not reveal Glinciro, add captions, subtitles, speech bubbles, readable text, extra characters, outfit changes, morphing, warped hands, duplicate limbs or watermarks.`;

async function loadEnv() { for (const file of ["env.local", ".env.local"]) { try { const raw = await fs.readFile(path.join(ROOT, file), "utf8"); for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {} } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function upload(base, key, file, index) { const b = await sharp(file).resize({ width: 900, height: 1200, fit: "inside" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer(); const r = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-filename": `phone-call-fast-omni-ref-${index}.jpg` }, body: b }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.url) throw new Error(`upload failed HTTP ${r.status}: ${JSON.stringify(j)}`); return j.url; }
async function generate(base, key, refs, i) { const submit = await fetch(`${base}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt: `${BASE_PROMPT}\n\n${VARIANTS[i]}`, inputImages: refs, generationOptions: { aspect_ratio: "9:16", resolution: "720p", duration: "8s", generate_audio: true } }) }); const j = await submit.json().catch(() => ({})); if (!submit.ok || !j.requestId || !j.generationId) throw new Error(`take ${i + 1} submit failed HTTP ${submit.status}: ${JSON.stringify(j)}`); console.log(`submitted take ${i + 1}: ${j.requestId}`); const q = new URLSearchParams({ requestId: j.requestId, modelId: MODEL, generationId: j.generationId, byteplusVideo: "true", durationSec: "8", resolution: "720p" }); let outputUrl; for (let n = 0; n < 180; n++) { await sleep(5000); const r = await fetch(`${base}/api/generate/status?${q}`, { headers: { Authorization: `Bearer ${key}` } }); const s = await r.json().catch(() => ({})); if (s.status === "completed" && s.outputUrl) { outputUrl = s.outputUrl; break; } if (s.status === "failed") throw new Error(`take ${i + 1} failed: ${s.error || "unknown"}`); if (n % 6 === 0) console.log(`take ${i + 1}: ${n * 5}s ${s.status || "processing"}`); } if (!outputUrl) throw new Error(`take ${i + 1} timed out`); const video = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } }); const out = path.join(OUT_DIR, `ep1-phone-call-fast-omni-take-${i + 1}.mp4`); await fs.mkdir(OUT_DIR, { recursive: true }); await fs.writeFile(out, Buffer.from(await video.arrayBuffer())); console.log(`saved ${out}`); }
async function main() { await loadEnv(); const key = process.env.MB_API_KEY || process.env.MB_KEY; const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, ""); if (!key) throw new Error("Missing Motionboards API key"); const refs = []; for (let i = 0; i < REFS.length; i++) refs.push(await upload(base, key, REFS[i], i + 1)); await Promise.all([0, 1].map(i => generate(base, key, refs, i))); }
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
