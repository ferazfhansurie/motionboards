import { promises as fs } from "node:fs";
import path from "node:path";
const ROOT = "/Users/faeez/motionboards";
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OUT = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/ep1-fast-omni-lab-only-6s.mp4");
const IMAGES = [
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Kit-Action.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Sparron-Action.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/worm-reference-from-previous-clip.jpg"),
  path.join(ROOT, "public/Fathopes_heroes_animated/superheroes-group.png"),
];
const PROMPT = `6-second 9:16 vertical FatHopes HQ laboratory scene. @Image1 locks Kit. @Image2 locks Sparron. @Image3 locks the worm’s current design from the previous generated video. @Image4 locks the three-superhero lab lineup. There is NO aunty reference and the aunty must never appear in this video.

Use only Kit, Sparron, the third superhero from @Image4 and the worm. Preserve faces, hair, outfits, colours and proportions. Kit is calm, dry and lightly amused like a young adult, never angry. Sparron is thoughtful and natural, with precise Malaysian/KL pronunciation.

SHOT 1, 0–1.3s: clean symmetrical establishing wide shot of the FatHopes lab. Kit, Sparron and the third hero stand around a table. The sealed clear specimen tube with the worm is visible behind them. No kitchen and no aunty.

SHOT 2, 1.3–2.8s: hard cut to worm POV from inside the tube, looking through curved glass at only the three heroes. Slow glass reflection move toward Sparron. Sparron says clearly: “Hmm, macam mana boleh wujud benda ni?”

SHOT 3, 2.8–4.1s: hard cut to a three-quarter medium close-up of Kit beside the tube. Kit replies calmly and dryly: “Tak tahulah, tapi aku tahu dia buruk.”

SHOT 4, 4.1–6s: hard cut to an extreme close-up of the worm’s sad face behind glass. Slow tiny push-in, oily drips fall downward, the three heroes remain blurred behind it. End on defeated eyes.

AUDIO: native generated audio must be present. Clear dialogue, natural pauses, consistent voice pacing, clean Malaysian/KL pronunciation, quiet lab ambience, glass resonance and a small comedic sting.

DO NOT add the aunty, kitchen, extra characters, Glinciro, captions, subtitles, speech bubbles, text, watermarks, morphing, outfit changes, angry Kit, rushed dialogue, warped anatomy or duplicate limbs.`;
async function loadEnv() { for (const file of ["env.local", ".env.local"]) { try { const raw = await fs.readFile(path.join(ROOT, file), "utf8"); for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {} } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function upload(base, key, file, name) { const body = await fs.readFile(file); const ext = path.extname(file).toLowerCase(); const type = ext === ".png" ? "image/png" : "image/jpeg"; const res = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": type, "x-filename": name + ext }, body }); const j = await res.json().catch(() => ({})); if (!res.ok || !j.url) throw new Error(`upload failed: HTTP ${res.status} ${JSON.stringify(j)}`); return j.url; }
async function main() { await loadEnv(); const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, ""); const key = process.env.MB_KEY || process.env.MB_API_KEY; if (!key) throw new Error("Missing Motionboards API key"); const images = []; for (let i = 0; i < IMAGES.length; i++) images.push(await upload(base, key, IMAGES[i], `fathopes-lab-only-image-${i + 1}`)); const submit = await fetch(`${base}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages: images, generationOptions: { aspect_ratio: "9:16", resolution: "720p", duration: "6s", generate_audio: true } }) }); const j = await submit.json().catch(() => ({})); if (!submit.ok || !j.requestId || !j.generationId) throw new Error(`submit failed HTTP ${submit.status}: ${JSON.stringify(j)}`); console.log(`submitted ${j.requestId}`); const q = new URLSearchParams({ requestId: j.requestId, modelId: MODEL, generationId: j.generationId, byteplusVideo: "true", durationSec: "6", resolution: "720p" }); let outputUrl; for (let i = 0; i < 180; i++) { await sleep(5000); const res = await fetch(`${base}/api/generate/status?${q}`, { headers: { Authorization: `Bearer ${key}` } }); const s = await res.json().catch(() => ({})); if (s.status === "completed" && s.outputUrl) { outputUrl = s.outputUrl; break; } if (s.status === "failed") throw new Error(`generation failed: ${s.error || "unknown"}`); if (i % 6 === 0) console.log(`${i * 5}s ${s.status || "processing"}`); } if (!outputUrl) throw new Error("Timed out waiting for lab clip"); const v = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } }); await fs.mkdir(path.dirname(OUT), { recursive: true }); await fs.writeFile(OUT, Buffer.from(await v.arrayBuffer())); console.log(`saved ${OUT}`); }
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
