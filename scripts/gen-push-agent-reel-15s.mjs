import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const SC = "/private/tmp/claude-501/-Users-faeez-motionboards/9a45d38a-94db-4d02-9904-4e90fbc57221/scratchpad";
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OUT = path.join(ROOT, "FatHopes IMG/push-agent-reel/push-agent-gdl-recruitment-15s.mp4");

const REFS = [
  path.join(ROOT, "fathopes-heroes-series-bible/Kit-action 2.png"),
  path.join(ROOT, "FatHopes IMG/push-people/PUX02644.JPG"),
  path.join(SC, "blue_tong.png"),
  path.join(ROOT, "FatHopes IMG/fathopes logo.png"),
];

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

async function upload(base, key, file, i) {
  const b = await sharp(file).rotate()
    .resize({ width: 1080, height: 1350, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  const meta = await sharp(b).metadata();
  console.log(`  ref${i}: ${meta.width}x${meta.height}  ${path.basename(file)}`);
  const r = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-filename": `push-reel-ref-${i}.jpg` },
    body: b,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(`upload failed HTTP ${r.status}: ${JSON.stringify(j)}`);
  return j.url;
}

async function main() {
  await loadEnv();
  const PROMPT = (await fs.readFile(path.join(SC, "reel.txt"), "utf8")).trim();
  const bytes = Buffer.byteLength(PROMPT, "utf8");
  if (bytes > 2000) throw new Error(`prompt too long: ${bytes}`);
  console.log(`prompt bytes: ${bytes}`);

  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  if (!key) throw new Error("Missing MotionBoards API key");

  const refs = [];
  for (let i = 0; i < REFS.length; i++) refs.push(await upload(base, key, REFS[i], i + 1));

  const submit = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, prompt: PROMPT, inputImages: refs,
      generationOptions: { aspect_ratio: "9:16", resolution: "720p", duration: "15s", generate_audio: true },
    }),
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
  if (!outputUrl) throw new Error("timed out");

  const video = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, Buffer.from(await video.arrayBuffer()));
  console.log(`saved ${OUT}`);
}
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
