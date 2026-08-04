import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OUT = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/ep1-glinciro-phone-call-15s-short-script.mp4");
const REFS = [
  path.join(ROOT, "FatHopes IMG/sg-video/refs/WhatsApp Image 2026-07-23 at 2.32.57 PM.jpeg"),
  path.join(ROOT, "FatHopes IMG/sg-video/refs/WhatsApp Image 2026-07-23 at 12.15.10 PM.jpeg"),
  path.join(ROOT, "public/Fathopes_heroes_animated/Kit-action.png"),
  path.join(ROOT, "public/Fathopes_heroes_animated/glinciro-action.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/worm-reference-from-previous-clip.jpg"),
];
const PROMPT = `FORMAT: Vertical 9:16, 15-second direct image-to-video continuation. Do not use a storyboard.

REFERENCES: @Image1 locks the exact HQ lab layout: centered glass tube, worm inside, Kit on the left, silver lab table, blue-white ceiling lights, pale blue walls and reflective floor. @Image2 and @Image3 lock Kit's exact face, hat, teal outfit, proportions and cel-shaded style. @Image4 locks Glinciro's exact villain design. @Image5 locks the worm's appearance.

ACTION: Begin with the phone clearly ringing and vibrating on the lab table for approximately one second before anyone answers. Show the exact @Image1 lab layout. The phone screen must visibly display the single readable word “UNKNOWN” while ringing. Kit then picks up the phone and says clearly in a natural young-adult Klang Valley voice: “Hello? Siapa ni?” As soon as Kit answers, cut to a persistent cinematic split-screen call layout: Kit in the exact HQ lab on the left, and Glinciro represented only as a dark shadow silhouette on the right. The silhouette may show a wide-brim hat, shoulders and one gloved hand, but absolutely no visible face or facial details. Glinciro says in a low threatening Malaysian voice: “Cacing tu aku punya. Pulangkan balik sebelum 12 malam.” Return briefly to Kit's side as he glances at the worm tube and replies: “Ooo, cacing ni kau punya?” Immediately cut Kit off, then return to the split-screen. The shadow leans forward without revealing a face and angrily says: “Kalau tak, aku lepaskan semua monster! Sapu semua minyak masak dunia!” End with the shadow's evil laugh, the split-screen collapsing into a sharp call-disconnect cut.

CAMERA: Phone insert, Kit close-up, then a clean locked split-screen call composition for the villain dialogue. Use a brief Kit reaction close-up, return to split-screen for the threat, then a final phone-disconnect detail. Fast clean cuts synced to audio beats. Keep Kit's face and outfit consistent. Never use a normal full-face villain close-up.

AUDIO: Clear dialogue, phone ambience, low suspense music, subtle phone static, realistic ringtone and vibration during the first second, sharp disconnect tone and exaggerated evil laugh. Let the dialogue breathe naturally across the 15-second duration. Prioritise dialogue intelligibility.

DO NOT: Show Glinciro's face or facial details. Do not show the aunty, sink or kitchen. Do not confuse Glinciro with the worm. No extra characters, captions, subtitles, text, face changes, outfit changes, morphing, distorted hands, duplicated limbs, camera shake or watermark.`;

async function loadEnv() { for (const file of ["env.local", ".env.local"]) { try { const raw = await fs.readFile(path.join(ROOT, file), "utf8"); for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {} } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function upload(base, key, file, i) { const b = await sharp(file).resize({ width: 900, height: 1200, fit: "inside" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer(); const r = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-filename": `glinciro-phone-ref-${i}.jpg` }, body: b }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.url) throw new Error(`upload failed HTTP ${r.status}: ${JSON.stringify(j)}`); return j.url; }
async function main() { await loadEnv(); const key = process.env.MB_API_KEY || process.env.MB_KEY; const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, ""); if (!key) throw new Error("Missing Motionboards API key"); const refs = []; for (let i = 0; i < REFS.length; i++) refs.push(await upload(base, key, REFS[i], i + 1)); const submit = await fetch(`${base}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages: refs, generationOptions: { aspect_ratio: "9:16", resolution: "720p", duration: "15s", generate_audio: true } }) }); const j = await submit.json().catch(() => ({})); if (!submit.ok || !j.requestId || !j.generationId) throw new Error(`submit failed HTTP ${submit.status}: ${JSON.stringify(j)}`); console.log(`submitted: ${j.requestId}`); const q = new URLSearchParams({ requestId: j.requestId, modelId: MODEL, generationId: j.generationId, byteplusVideo: "true", durationSec: "15", resolution: "720p" }); let outputUrl; for (let n = 0; n < 180; n++) { await sleep(5000); const r = await fetch(`${base}/api/generate/status?${q}`, { headers: { Authorization: `Bearer ${key}` } }); const s = await r.json().catch(() => ({})); if (s.status === "completed" && s.outputUrl) { outputUrl = s.outputUrl; break; } if (s.status === "failed") throw new Error(`generation failed: ${s.error || "unknown"}`); if (n % 6 === 0) console.log(`${n * 5}s ${s.status || "processing"}`); } if (!outputUrl) throw new Error("generation timed out"); const video = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } }); await fs.mkdir(path.dirname(OUT), { recursive: true }); await fs.writeFile(OUT, Buffer.from(await video.arrayBuffer())); console.log(`saved ${OUT}`); }
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
