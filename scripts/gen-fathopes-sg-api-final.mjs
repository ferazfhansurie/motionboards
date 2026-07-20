import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const REFS = [
  "SG fathopes new Photos/2d302377-dd4d-4921-b3a7-f65841275d1a.jpeg",
  "SG fathopes new Photos/Generated image 1.png",
  "SG fathopes new Photos/Generated image 2.png",
  "SG fathopes new Photos/Generated image 3.png",
  "SG fathopes new Photos/Generated image 4.png",
  "SG fathopes new Photos/de343632-83ce-4d19-9e47-dabfa462f1a4.jpeg",
  "SG fathopes new Photos/images.png",
];
const PROMPT = `Create one 15-second vertical 9:16 advertisement using all supplied references. Use @Image1 as a real moving opening B-roll shot of the worker operating the equipment; preserve the person, truck, hose, environment and branding, with smooth handheld push-in and natural action. Use @Image2, @Image3, @Image4 and @Image5 as animated motion-graphic overlays: flowing arrows, icons, gradients, lines and clean infographic elements. Use @Image6 as a real moving closing B-roll shot of the worker doing something natural with the equipment; never leave it static. Use @Image7 as the exact Fathopes Energy logo; preserve it exactly.

Cut to musical beats with close-up logo and hose detail, low truck angle, side tracking across equipment, over-shoulder service angle, macro fittings, wide Singapore environment, then a clean logo end frame. Text has only minor fade, slide or tracking animation: elegant, stable and legible; never jitter, flicker, bounce excessively or duplicate.

Professional English voiceover with warm Southeast Asian tone: "Singapore businesses, manage waste smarter with Fathopes Energy. We provide professional on-site collection and conversion services across Singapore. Call plus six five, eight one two six, two three seven nine — or plus six five, nine eight six nine, three seven six eight. Fathopes Energy — waste to wealth." Add uplifting premium electronic background music, soft mechanical and hose ambience, liquid-flow sounds, subtle whooshes and a clean closing chime; keep music below the voice.

Final text: FATHOPES ENERGY SINGAPORE / CALL +65 8126 2379 / OR +65 9869 3768. Apple high-editorial style: SF Pro Display-style headlines, SF Pro Text-style copy, precise grid, whitespace, charcoal, white, lime and aqua. No static images, invented people or vehicles, altered faces, extra logos, fake signage, gibberish, watermark or duplicated text.`;

async function env() {
  for (const file of ["env.local", ".env.local"]) try {
    const raw = await fs.readFile(path.join(ROOT, file), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function upload(base, key, rel, id) {
  const ext = path.extname(rel).toLowerCase();
  const type = ext === ".png" ? "image/png" : "image/jpeg";
  const res = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": type, "x-filename": `fathopes-api-${id}${ext}` }, body: await fs.readFile(path.join(ROOT, rel)) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) throw new Error(`upload failed ${rel}: HTTP ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json.url;
}
async function main() {
  await env();
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  if (!key) throw new Error("Missing MB_API_KEY/MB_KEY");
  const images = [];
  for (let i = 0; i < REFS.length; i++) images.push(await upload(base, key, REFS[i], i + 1));
  const submit = await fetch(`${base}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages: images, generationOptions: { aspect_ratio: "9:16", resolution: "720p", duration: "15s", generate_audio: true } }) });
  const result = await submit.json().catch(() => ({}));
  if (!submit.ok || !result.requestId || !result.generationId) throw new Error(`submit failed HTTP ${submit.status}: ${JSON.stringify(result).slice(0, 500)}`);
  console.log(`submitted ${result.requestId}`);
  const qs = new URLSearchParams({ requestId: result.requestId, modelId: MODEL, generationId: result.generationId, byteplusVideo: "true", durationSec: "15", resolution: "720p" });
  let outputUrl = null;
  for (let i = 0; i < 180; i++) {
    await sleep(5000);
    const res = await fetch(`${base}/api/generate/status?${qs}`, { headers: { Authorization: `Bearer ${key}` } });
    const s = await res.json().catch(() => ({}));
    if (s.status === "completed" && s.outputUrl) { outputUrl = s.outputUrl; break; }
    if (s.status === "failed") throw new Error(`generation failed: ${s.error || "unknown"}`);
    process.stdout.write(`\r[${(i + 1) * 5}s] ${s.log || s.status || "processing"}`);
  }
  if (!outputUrl) throw new Error("Timed out after 15 minutes");
  const file = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  const out = path.join(ROOT, "FatHopes IMG", "sg-video", "fathopes-sg-seedance-api-15s.mp4");
  await fs.writeFile(out, Buffer.from(await file.arrayBuffer()));
  console.log(`\nSaved ${out}`);
}
main().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
