import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OUT = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-clips/ep1-clip3-bagging-hq.mp4");
const REFS = [
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard-frames/clip2-next15-last-frame.jpg"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Sparron-Action.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Kit-Action.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Glinciro -Action.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-manifest/fh-ep1-sinki-backplate.png"),
  path.join(ROOT, "public/Fathopes_heroes_animated/superheroes-group.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/fathopes-ep1-bagging-hq-storyboard.png"),
];
const PROMPT_FILE = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-seedance-prompts/clip-03-bagging-hq-paste-ready.txt");

async function loadEnv() { for (const file of ["env.local", ".env.local"]) { try { const raw = await fs.readFile(path.join(ROOT, file), "utf8"); for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {} } }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function upload(base, key, file, index) { const body = await fs.readFile(file); const type = file.endsWith(".jpg") ? "image/jpeg" : "image/png"; const response = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": type, "x-filename": `ep1-clip3-ref-${index + 1}` }, body }); const json = await response.json().catch(() => ({})); if (!response.ok || !json.url) throw new Error(`upload failed ${file}: ${response.status} ${JSON.stringify(json)}`); return json.url; }

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("Missing MB_KEY or MB_API_KEY");
  const prompt = await fs.readFile(PROMPT_FILE, "utf8");
  console.log(`prompt ${prompt.length} chars`);
  const urls = [];
  for (let i = 0; i < REFS.length; i++) { urls.push(await upload(base, key, REFS[i], i)); console.log(`uploaded Image${i + 1}`); }
  const submit = await fetch(`${base}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt, inputImages: urls, generationOptions: { aspect_ratio: "9:16", resolution: "720p", duration: "15s", generate_audio: true } }) });
  const result = await submit.json().catch(() => ({}));
  if (!submit.ok || !result.requestId || !result.generationId) throw new Error(`submit failed ${submit.status}: ${JSON.stringify(result)}`);
  console.log(`submitted ${result.requestId}`);
  const query = new URLSearchParams({ requestId: result.requestId, modelId: MODEL, generationId: result.generationId, byteplusVideo: "true", durationSec: "15", resolution: "720p" });
  let outputUrl;
  for (let i = 1; i <= 120; i++) { await sleep(5000); const status = await fetch(`${base}/api/generate/status?${query}`, { headers: { Authorization: `Bearer ${key}` } }); const json = await status.json().catch(() => ({})); if (json.status === "completed" && json.outputUrl) { outputUrl = json.outputUrl; break; } if (json.status === "failed") throw new Error(`generation failed: ${json.error || "unknown"}`); if (i % 6 === 0) console.log(`${i * 5}s ${json.status || "processing"}`); }
  if (!outputUrl) throw new Error("timed out waiting for video");
  const video = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, Buffer.from(await video.arrayBuffer()));
  console.log(`saved ${OUT}`);
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
