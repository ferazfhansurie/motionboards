// Actual Seedance 2.0 Pro Omni moving-footage layer for the PUSH recruitment infographic.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "FatHopes IMG", "push-recruitment-seedance");
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OPTS = { aspect_ratio: "9:16", resolution: "720p", duration: "15s", generate_audio: true };
const REFS = [
  "FatHopes IMG/gaji-candidates/07_minitrucks_PUX08459.jpg",
  "FatHopes IMG/gaji-candidates/08_minitrucks_PUX08503.jpg",
  "FatHopes IMG/drive-download-20260627T093938Z-3-001/PUX08460.JPG",
  "FatHopes IMG/poster-refs/LOGO-mark.png",
  "FatHopes IMG/push-chip-tier-infographics/01-program-push-overview.png",
  "FatHopes IMG/push-chip-tier-infographics/02-job-description.png",
  "FatHopes IMG/push-chip-tier-infographics/03-collection-chip-tier.png",
  "FatHopes IMG/push-chip-tier-infographics/04-register-interest.png",
];

const PROMPT = `Create a polished vertical 9:16 FatHopes Energy recruitment motion infographic.

REFERENCE ROLES: @Image1, @Image2 and @Image3 are the only real mini-tanker footage references. Preserve green cabs, tanker bodies, exact FatHopes livery, depot and daylight. @Image4 is the exact FatHopes logo. @Image5, @Image6, @Image7 and @Image8 are approved final graphic plates. Treat every plate as locked 2D artwork: preserve all words, numbers, RM amounts, tiers, commission examples, spelling, line breaks and hierarchy exactly.

MOTION: Start with one smooth forward glide past a parked mini tanker. Only reflections and a thin aqua route line move. Use the spoken phrases as edit beats, never timestamps. At "bukan barang buang", route line resolves into @Image5. At "kutip, urus laluan, then hantar", reveal @Image6 as stable cards. At "lagi tinggi kadar", transition through one rotating wheel into @Image7; tiers rise in order, while light and chip tokens move around locked text. At "Daftar minat sekarang", resolve into @Image8, then close on @Image4. Only camera, lighting, route lines and tokens animate.

AUDIO: adult Malaysian male, relaxed conversational KL/Klang Valley Malay with light Manglish; warm, natural, never Indonesian or robotic. Say exactly: "Minyak masak terpakai bukan barang buang. Program PUSH: kutip, urus laluan, then hantar. Lagi banyak chip, lagi tinggi kadar. Nak mula? Daftar minat sekarang." Leave natural silence after every sentence. Underlay a modern pulse and quiet depot ambience. During silence, lift music and ambience gently, then smoothly duck beneath speech. No hard pumping.

DO NOT: add people, fake trucks, changed livery, extra logos, invented copy, changed prices, duplicate text, QR codes, captions, watermarks, unreadable signage, camera shake, rapid cuts, morphing, flicker, warped type, cropped plates or generic fintech visuals. Do not animate words.`;

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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function upload(base, key, relativePath, index) {
  const ext = path.extname(relativePath).toLowerCase();
  const source = sharp(path.join(ROOT, relativePath)).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true });
  const png = ext === ".png";
  const buf = await (png ? source.png({ compressionLevel: 9 }) : source.jpeg({ quality: 88, mozjpeg: true })).toBuffer();
  const mime = png ? "image/png" : "image/jpeg";
  const response = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": mime, "x-filename": `push-ref-${index + 1}${png ? ".png" : ".jpg"}` },
    body: buf,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.url) throw new Error(`upload ${index + 1}: HTTP ${response.status} ${JSON.stringify(json).slice(0, 180)}`);
  return json.url;
}

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("Missing MotionBoards API key.");
  if (Buffer.byteLength(PROMPT, "utf8") > 2000) throw new Error("Seedance prompt exceeds 2000 characters.");
  console.log(`Seedance prompt: ${Buffer.byteLength(PROMPT, "utf8")} bytes`);
  const inputImages = [];
  for (let index = 0; index < REFS.length; index++) inputImages.push(await upload(base, key, REFS[index], index));
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages, generationOptions: OPTS }),
  });
  const job = await response.json().catch(() => ({}));
  if (!response.ok || !job.requestId || !job.generationId) throw new Error(`Seedance submit: HTTP ${response.status} ${JSON.stringify(job).slice(0, 300)}`);
  console.log(`Submitted request=${job.requestId} generation=${job.generationId}`);
  const qs = new URLSearchParams({ requestId: job.requestId, modelId: MODEL, generationId: job.generationId, byteplusVideo: "true", durationSec: "15", resolution: "720p" });
  let outputUrl = "";
  for (let tick = 1; tick <= 120; tick++) {
    await sleep(5000);
    const statusResponse = await fetch(`${base}/api/generate/status?${qs}`, { headers: { Authorization: `Bearer ${key}` } });
    const status = await statusResponse.json().catch(() => ({}));
    if (status.status === "completed" && status.outputUrl) { outputUrl = status.outputUrl; break; }
    if (statusResponse.status === 429 || /rate-limit/i.test(status.error || "")) {
      if (tick % 6 === 0) console.log(`${tick * 5}s: provider rate-limited, retrying`);
      continue;
    }
    if (status.status === "failed") throw new Error(status.error || "Seedance generation failed.");
    if (tick % 6 === 0) console.log(`${tick * 5}s: ${status.status || "processing"}`);
  }
  if (!outputUrl) throw new Error("Seedance timed out after 10 minutes.");
  const videoResponse = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  if (!videoResponse.ok) throw new Error(`Seedance download: HTTP ${videoResponse.status}`);
  await fs.mkdir(OUT, { recursive: true });
  const out = path.join(OUT, "push-mini-tanker-infographic-seedance-fast-15s.mp4");
  await fs.writeFile(out, Buffer.from(await videoResponse.arrayBuffer()));
  console.log(`Saved ${out}`);
}
await main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
