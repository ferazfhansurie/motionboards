import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OUT = path.join(ROOT, "FatHopes IMG/saf-journey-video-seedance/ke-mana-minyak-masak-terpakai-pergi-15s.mp4");

const REFS = [
  "/private/tmp/claude-501/-Users-faeez-motionboards/9a45d38a-94db-4d02-9904-4e90fbc57221/scratchpad/p1b.png",
  "/private/tmp/claude-501/-Users-faeez-motionboards/9a45d38a-94db-4d02-9904-4e90fbc57221/scratchpad/home_screen_top_only.png",
  path.join(ROOT, "FatHopes IMG/fathopesloyaltyapp/35776523-e0b7-4d9e-9b55-e8ad36db28cb.jpeg"),
  path.join(ROOT, "FatHopes IMG/poster-refs/ALT_newtanker_closeup.jpg"),
  path.join(ROOT, "FatHopes IMG/fathopes logo.png"),
];

const PROMPT = `Use @Image1 as the opening reference: a glass jar of dark murky used cooking oil with a metal funnel resting against it on a dark wood table, preserve the oil color and jar exactly. Use @Image2 as the FatHopes app Home screen - preserve its exact UI layout, header, and the Drop Off Now button text exactly, do not invent or distort any text. Use @Image3 as the FatHopes app Dropoff map screen - preserve its exact dark map UI, green pins, and the View Details location card exactly. Use @Image4 as the closing real photo of the FatHopes tanker with its logo, painted airplane graphic, and three illustrated hero characters - preserve exactly, do not blend or redraw their faces. Use @Image5 only in the final half second as a clean logo reference.

Arc: open on @Image1, camera pushes in slowly on the dark oil, quiet and ominous. A calm male narrator voiceover says in natural KL Malay: "Minyak masak lepas goreng tu, korang ingat jadi sampah?" At 4s dissolve to @Image2, a finger taps Drop Off Now, button glows on press, screen slides sideways. At 8s settle into @Image3, a green pin drops and pulses on the map, then the location card glides up, View Details highlights briefly. At 11s dissolve into @Image4, camera pushes in across the chrome tank onto the airplane graphic and the three characters. Narrator continues: "Sebenarnya, ia jadi Sustainable Aviation Fuel - bahan api kapal terbang." Hold final frame on the FatHopes logo.

Camera: hold or slow push-in only, no pans, no shake, no orbit. Lighting: keep each scene's original lighting, do not relight. Do not invent new UI text or buttons, do not distort the app screenshots' layout, do not blend the characters' faces, no extra fingers, no added people, no text overlays.`;

async function loadEnv() {
  for (const file of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, file), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function upload(base, key, file, index) {
  const b = await sharp(file).resize({ width: 1080, height: 1350, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const r = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-filename": `saf-journey-ref-${index}.jpg` }, body: b });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(`upload failed HTTP ${r.status}: ${JSON.stringify(j)}`);
  return j.url;
}

async function main() {
  await loadEnv();
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  if (!key) throw new Error("Missing MotionBoards API key");
  if (Buffer.byteLength(PROMPT, "utf8") > 2000) throw new Error("Prompt exceeds 2000 bytes: " + Buffer.byteLength(PROMPT, "utf8"));

  console.log(`Prompt bytes: ${Buffer.byteLength(PROMPT, "utf8")}`);
  const refs = [];
  for (let i = 0; i < REFS.length; i++) { console.log(`uploading ref ${i + 1}...`); refs.push(await upload(base, key, REFS[i], i + 1)); }

  const submit = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages: refs, generationOptions: { aspect_ratio: "9:16", resolution: "720p", duration: "15s", generate_audio: true } }),
  });
  const j = await submit.json().catch(() => ({}));
  if (!submit.ok || !j.requestId || !j.generationId) throw new Error(`submit failed HTTP ${submit.status}: ${JSON.stringify(j)}`);
  console.log(`submitted: request=${j.requestId} generation=${j.generationId}`);

  const q = new URLSearchParams({ requestId: j.requestId, modelId: MODEL, generationId: j.generationId, byteplusVideo: "true", durationSec: "15", resolution: "720p" });
  let outputUrl;
  for (let n = 0; n < 180; n++) {
    await sleep(5000);
    const r = await fetch(`${base}/api/generate/status?${q}`, { headers: { Authorization: `Bearer ${key}` } });
    const s = await r.json().catch(() => ({}));
    if (s.status === "completed" && s.outputUrl) { outputUrl = s.outputUrl; break; }
    if (s.status === "failed") throw new Error(`generation failed: ${s.error || JSON.stringify(s)}`);
    if (n % 6 === 0) console.log(`${n * 5}s: ${s.status || "processing"}`);
  }
  if (!outputUrl) throw new Error("generation timed out after 15 minutes");

  const video = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  if (!video.ok) throw new Error(`download failed HTTP ${video.status}`);
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, Buffer.from(await video.arrayBuffer()));
  console.log(`saved ${OUT}`);
}

main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
