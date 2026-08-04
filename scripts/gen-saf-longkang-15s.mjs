import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OUT = path.join(ROOT, "FatHopes IMG/saf-journey-video-seedance/longkang-saf-15s.mp4");

// @Image1 .. @Image5 in order
const REFS = [
  path.join(ROOT, "FatHopes IMG/push-people/OPERASI PENGUATKUASAAN PENCEMARAN SISA MINYAK DALAM LONGKAN (9).jpg"),
  path.join(ROOT, "FatHopes IMG/push-people/PUX03074.JPG"),
  path.join(ROOT, "FatHopes IMG/push-people/PUX03150.JPG"),
  path.join(ROOT, "FatHopes IMG/gaji-candidates/08_minitrucks_PUX08503.jpg"),
  path.join(ROOT, "FatHopes IMG/fathopes logo.png"),
];

const PROMPT = `Use @Image1 as the exact look of the clogged drain: real congealed pale oil waste blocking a concrete roadside drain, brown scum below. Preserve its colors and grime. Use @Image3 as the wide collection shot: a FatHopes worker pouring used cooking oil through a green funnel into a white jerry can, tanker behind. Use @Image2 as the tight insert: gloved hands and funnel, oil running in. Use @Image4 as the green FatHopes mini tanker; preserve its green cab and livery. Use @Image5 as the closing logo.
Cut on the voice, not a clock. One line, one shot, one move.
On "What gets used, then thrown away and forgotten?": drone skimming inches above the drain floor, rushing forward along a stream of dirty oil. Camera: fast forward tracking, low and level.
On "I am, of course, talking about your used cooking oil.": the drone lifts and rolls into a top-down birds eye over the blockage from @Image1. Camera: smooth lift and rotate overhead, then hold.
On "It gets stuck. And causes damage nobody sees.": low raking angle across the congealed surface, almost at oil level. Camera: slow macro push in.
On "FatHopes Energy collects it, and turns it into": wide high three-quarter on @Image3 as he pours, then the tight @Image2 insert of hands and funnel. Camera: slow push in on each.
On "Sustainable Aviation Fuel. Real jet fuel. Schedule your pickup today!": road-level low wide, the @Image4 tanker driving away into the distance, then tilt up to an airplane crossing the sky. Camera: locked low wide, then one slow tilt up.
Final: @Image5 logo on clean white, camera static.
LIGHTING: flat overcast daylight on drain and collection, warmer on the tanker.
VOICE: one adult woman, warm conversational English, real breaths and human pacing, not robotic.
DO NOT: no jitter, no shake, no wobble; all moves smooth and gimbal-steady. No people in the drain shots, no trees in the sky, no lens flare, no vignette, no text overlays or captions, no garbled text on the tanker, no morphing, no changed faces.`;

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
  // .rotate() with no args auto-orients from EXIF (these PUX files carry orientation tag 8)
  const b = await sharp(file).rotate().resize({ width: 1080, height: 1350, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  const meta = await sharp(b).metadata();
  console.log(`  ref${index}: ${meta.width}x${meta.height}  ${path.basename(file)}`);
  const r = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-filename": `longkang-saf-ref-${index}.jpg` }, body: b });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(`upload failed HTTP ${r.status}: ${JSON.stringify(j)}`);
  return j.url;
}

async function main() {
  await loadEnv();
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  if (!key) throw new Error("Missing MotionBoards API key");
  const bytes = Buffer.byteLength(PROMPT, "utf8");
  if (bytes > 2000) throw new Error(`Prompt exceeds 2000 bytes: ${bytes}`);
  console.log(`Prompt bytes: ${bytes}`);

  const refs = [];
  for (let i = 0; i < REFS.length; i++) refs.push(await upload(base, key, REFS[i], i + 1));

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
