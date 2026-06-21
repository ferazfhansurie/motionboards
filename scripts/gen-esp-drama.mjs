// ESP WRAPZ — "Drama" ad (V1), Seedance 2.0 Pro I2V on MotionBoards.
// White SUV start frame -> slow orbit gloss reveal, cool Malay VO, no on-screen text.
//   node scripts/gen-esp-drama.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF = "public/ESP/ref-white-ev-suv-front.jpeg";
const MODEL = "dreamina-seedance-2-0-260128/i2v"; // Seedance 2.0 Pro I2V (ByteDance Ark)

const PROMPT = `Fast-paced social media advertisement style, punchy and high energy, fun and snappy - NOT slow, NOT elegant, NOT cinematic. A glossy white SUV in a car detailing studio with a colour swatch wall behind it. Energetic camera: quick snappy zoom-ins and a fast orbit around the front, bright light streaks flashing across the glossy bonnet and headlights, upbeat and playful pace. The car stays still; keep its exact shape, white colour and the studio unchanged. AUDIO (generate a spoken voice): a fun, warm, slightly loud older Malaysian uncle (pakcik) voiceover, cheeky and energetic like a friendly market salesman hyping a deal, casual spoken Bahasa Malaysia, comedic timing, clear pronunciation, talking across the whole 15 seconds: "Eh adik, beli keta baru ye? Cantik! Tapi kena batu sikit je, calar... sakit hati tau! Pakcik bagitau, buat PPF dulu lah. Calar, batu, habuk - semua tak lekat! Senang, jimat, confirm puas hati. Jom!" Under the voice, upbeat fun playful background music at low volume. Real clear energetic Malay human speech, not robotic, no other voices. Negatives: no text, no captions, no subtitles, no on-screen words, no logos, no watermark, no people, no faces, no hands, avoid warping the body, avoid changing the paint colour.`;

const OPTS = { aspect_ratio: "9:16", resolution: "1080p", duration: "15s", generate_audio: true };

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ark fetches the start frame server-side, so it needs a hosted URL — upload
// the raw bytes to /api/upload and use the returned /api/files/:id URL.
async function uploadImage(base, key, p) {
  const buf = await fs.readFile(path.join(ROOT, p));
  const res = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-filename": path.basename(p) },
    body: buf,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) throw new Error(`upload HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json.url;
}

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("No API key (MB_API_KEY in .env.local).");

  console.log(`Uploading start frame...`);
  const inputImage = await uploadImage(base, key, REF);
  console.log(`Uploaded: ${inputImage}`);

  console.log(`Submitting drama clip to ${base} (${MODEL}, ${OPTS.resolution} ${OPTS.aspect_ratio} ${OPTS.duration})...`);
  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImage, generationOptions: OPTS }),
  });
  const job = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`submit HTTP ${res.status}: ${JSON.stringify(job).slice(0, 300)}`);
  const { generationId, requestId } = job;
  if (!generationId || !requestId) throw new Error(`unexpected submit response: ${JSON.stringify(job).slice(0, 300)}`);
  console.log(`Submitted. generationId=${generationId} requestId=${requestId}. Polling...`);

  const durSec = parseInt(OPTS.duration) || 8;
  const statusUrl = `${base}/api/generate/status?requestId=${encodeURIComponent(requestId)}&modelId=${encodeURIComponent(MODEL)}&generationId=${encodeURIComponent(generationId)}&byteplusVideo=true&durationSec=${durSec}&resolution=${OPTS.resolution}`;

  for (let i = 1; i <= 80; i++) {
    await sleep(6000);
    const sres = await fetch(statusUrl, { headers: { Authorization: `Bearer ${key}` } });
    const s = await sres.json().catch(() => ({}));
    if (s.status === "completed" && s.outputUrl) {
      console.log(`Done (${s.actualCost || "?"}). Downloading...`);
      const v = await fetch(s.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await v.arrayBuffer());
      const outDir = path.join(ROOT, "public", "ESP", "_gen");
      await fs.mkdir(outDir, { recursive: true });
      const out = path.join(outDir, "drama-uncle.mp4");
      await fs.writeFile(out, buf);
      console.log(`Saved public/ESP/_gen/drama-uncle.mp4 (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }
    if (s.status === "failed") throw new Error(`generation failed: ${s.error || "unknown"}`);
    process.stdout.write(`[${i}] ${s.status || "?"}${s.log ? " - " + s.log : ""}\n`);
  }
  throw new Error("timed out after ~8 min of polling");
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
