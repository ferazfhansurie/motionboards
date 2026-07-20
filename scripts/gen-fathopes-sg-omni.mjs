import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OPTS = { aspect_ratio: "9:16", resolution: "720p", duration: "15s", generate_audio: false };
const IMAGE_REFS = [
  "SG fathopes new Photos/images.png",
  "FatHopes IMG/sg-video/refs/real-truck-clean-crop.jpg",
  "FatHopes IMG/sg-video/refs/waste-energy-loop.png",
  "FatHopes IMG/sg-video/refs/process-steps.png",
  "FatHopes IMG/sg-video/refs/singapore-map.png",
];
const VIDEO_REF = null;
const PROMPT = `15-second vertical premium advertisement for Fathopes Energy Singapore. Use @Image2 as the real Singapore truck, hose and waste-collection photo; preserve its actual truck, printed lettering, street and environment exactly. Use @Image1 as the exact official Fathopes Energy logo; never redraw, distort, recolour or replace it. Use @Image3, @Image4 and @Image5 only as flat infographic motion references: animate clean arrows, simple line icons, process steps and a Singapore service route; do not create a fake truck or fake realistic location.

Shot plan: 0-4s, gentle push-in on @Image2 and the real waste-collection truck; minimal caption WASTE TO WEALTH. 4-7s, continue the real truck photo with subtle parallax and hose-flow motion; caption ON-SITE SERVICE IN SINGAPORE. 7-11s, animate a thin lime-to-aqua loop inspired by @Image3 and the three-step icons from @Image4 over a clean white/charcoal field; caption COLLECT / CONVERT / CREATE VALUE. 11-15s, clean end card using the exact @Image1 logo, Singapore map-line motion inspired by @Image5, and the final text FATHOPES ENERGY SINGAPORE / CALL 8869 2979.

Apple high-editorial studio level: SF Pro Display-style bold headline geometry, SF Pro Text-style supporting typography, generous whitespace, precise grid, smooth eased transitions, restrained lime-green and aqua accents, premium soundless visual master. Text must be added cleanly and shown once. No fake realistic objects, no invented people, no new truck, no fake signage, no extra logos, no statistics, no watermark, no gibberish text.`;

async function loadEnv() {
  for (const f of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function upload(base, key, rel, index) {
  const buf = await fs.readFile(path.join(ROOT, rel));
  const ext = path.extname(rel).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".mp4" ? "video/mp4" : "image/jpeg";
  const res = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": type, "x-filename": `fathopes-sg-${index}${ext}` },
    body: buf,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) throw new Error(`upload failed ${rel}: HTTP ${res.status} ${JSON.stringify(json).slice(0, 240)}`);
  return json.url;
}

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  if (!key) throw new Error("Missing MB_API_KEY/MB_KEY");
  const images = [];
  for (let i = 0; i < IMAGE_REFS.length; i++) images.push(await upload(base, key, IMAGE_REFS[i], `image-${i + 1}`));
  const videos = VIDEO_REF ? [await upload(base, key, VIDEO_REF, "video-1")] : [];
  const submit = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages: images, inputVideos: videos, generationOptions: OPTS }),
  });
  const result = await submit.json().catch(() => ({}));
  if (!submit.ok || !result.requestId || !result.generationId) throw new Error(`submit failed HTTP ${submit.status}: ${JSON.stringify(result).slice(0, 500)}`);
  console.log(`submitted ${result.requestId}`);
  const qs = new URLSearchParams({ requestId: result.requestId, modelId: MODEL, generationId: result.generationId, byteplusVideo: "true", durationSec: "15", resolution: "720p" });
  let outputUrl = null;
  for (let i = 0; i < 180; i++) {
    await sleep(5000);
    const res = await fetch(`${base}/api/generate/status?${qs}`, { headers: { Authorization: `Bearer ${key}` } });
    const status = await res.json().catch(() => ({}));
    if (status.status === "completed" && status.outputUrl) { outputUrl = status.outputUrl; break; }
    if (status.status === "failed") throw new Error(`generation failed: ${status.error || "unknown"}`);
    process.stdout.write(`\r[${(i + 1) * 5}s] ${status.log || status.status || "processing"}`);
  }
  if (!outputUrl) throw new Error("Timed out after 15 minutes");
  const download = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  const buf = Buffer.from(await download.arrayBuffer());
  const out = path.join(ROOT, "FatHopes IMG", "sg-video", "fathopes-sg-seedance-omni-15s.mp4");
  await fs.writeFile(out, buf);
  console.log(`\nSaved ${out} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}
main().catch((error) => { console.error("\nERROR:", error.message); process.exit(1); });
