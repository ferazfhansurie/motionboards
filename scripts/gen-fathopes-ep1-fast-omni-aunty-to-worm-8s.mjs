import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OUT = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/ep1-fast-omni-aunty-to-worm-8s-v2.mp4");
const IMAGES = [
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/aunty-reference-from-clip1.jpg"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Kit-Action.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Sparron-Action.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/worm-reference-from-previous-clip.jpg"),
  path.join(ROOT, "public/Fathopes_heroes_animated/superheroes-group.png"),
];
const PROMPT = `8-second 9:16 vertical animated continuation. @Image1 locks the exact aunty from the previous clip. @Image2 locks Kit. @Image3 locks Sparron. @Image4 is a small worm frame taken from the previous generated video and locks the worm’s current design. @Image5 locks the three-hero lab lineup. Maintain the established voice pacing and conversational rhythm.

Preserve every face, hairstyle, outfit, colour and proportion. Aunty stays identical to @Image1. Kit always wears teal workwear, silver bands, black hat and black gloves. Sparron always wears black top, green pants, green visor and gloves. The worm is a separate creature, not Glinciro. No captions, subtitles, speech bubbles or text.

SHOT 1, 0–1.8s: close-up of the exact aunty in the kitchen, gentle push-in, warm grateful smile. She says clearly and warmly: “Thank you geng FatHopes.”

SHOT 2, 1.8–3.3s: hard beat cut to a clean FatHopes lab establishing wide shot. Kit, Sparron and the third hero stand around a table; the sealed clear tube with the worm is in the background. The aunty is completely absent from HQ. Stable symmetrical camera.

SHOT 3, 3.3–4.8s: hard beat cut to worm POV from inside the tube, looking upward through curved glass at only the three superheroes. No aunty. Slow glass reflection move toward Sparron. Sparron says clearly, naturally and unhurried: “Hmm, macam mana boleh wujud benda ni?”

SHOT 4, 4.8–6.2s: hard beat cut to a three-quarter medium close-up of Kit beside the tube. Only the three superheroes are in HQ. Kit sounds like a calm young adult, dry and lightly amused, never angry: “Tak tahulah, tapi aku tahu dia buruk.”

SHOT 5, 6.2–8s: hard beat cut to an extreme close-up of the worm’s sad face behind glass, matching @Image4. Slow tiny push-in; oily drips fall downward; only the three heroes remain softly blurred behind it. The aunty must not appear. End on the worm’s defeated eyes.

AUDIO: native generated audio must be present. Keep dialogue clear, correctly pronounced Malaysian/KL conversational Malay, with natural pauses and consistent pacing. Add soft lab ambience, glass resonance and a small comedic sting on the final worm reaction.

DO NOT change identities or outfits, make Kit angry, rush the dialogue, mispronounce the Malay lines, blend shots together, show multiple locations in one shot, bring the aunty into HQ, morph faces, add Glinciro, add extra characters, reverse gravity, add captions, subtitles, text, watermarks, flicker or warped anatomy.`;

async function loadEnv() { for (const file of ["env.local", ".env.local"]) { try { const raw = await fs.readFile(path.join(ROOT, file), "utf8"); for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {} } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function upload(base, key, file, name) { const body = await fs.readFile(file); const ext = path.extname(file).toLowerCase(); const type = ext === ".png" ? "image/png" : ext === ".mp4" ? "video/mp4" : "image/jpeg"; const res = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": type, "x-filename": name + ext }, body }); const j = await res.json().catch(() => ({})); if (!res.ok || !j.url) throw new Error(`upload failed: HTTP ${res.status} ${JSON.stringify(j)}`); return j.url; }

async function main() {
  await loadEnv(); const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, ""); const key = process.env.MB_KEY || process.env.MB_API_KEY; if (!key) throw new Error("Missing Motionboards API key");
  const images = []; for (let i = 0; i < IMAGES.length; i++) { images.push(await upload(base, key, IMAGES[i], `fathopes-aunty-worm-image-${i + 1}`)); console.log(`uploaded Image${i + 1}`); }
  const submit = await fetch(`${base}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages: images, generationOptions: { aspect_ratio: "9:16", resolution: "720p", duration: "8s", generate_audio: true } }) });
  const j = await submit.json().catch(() => ({})); if (!submit.ok || !j.requestId || !j.generationId) throw new Error(`submit failed HTTP ${submit.status}: ${JSON.stringify(j)}`); console.log(`submitted ${j.requestId}`);
  const q = new URLSearchParams({ requestId: j.requestId, modelId: MODEL, generationId: j.generationId, byteplusVideo: "true", durationSec: "8", resolution: "720p" }); let outputUrl;
  for (let i = 0; i < 180; i++) { await sleep(5000); const res = await fetch(`${base}/api/generate/status?${q}`, { headers: { Authorization: `Bearer ${key}` } }); const s = await res.json().catch(() => ({})); if (s.status === "completed" && s.outputUrl) { outputUrl = s.outputUrl; break; } if (s.status === "failed") throw new Error(`generation failed: ${s.error || "unknown"}`); if (i % 6 === 0) console.log(`${i * 5}s ${s.status || "processing"}`); }
  if (!outputUrl) throw new Error("Timed out waiting for Fast Omni video"); const result = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } }); await fs.mkdir(path.dirname(OUT), { recursive: true }); await fs.writeFile(OUT, Buffer.from(await result.arrayBuffer())); console.log(`saved ${OUT}`);
}
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
