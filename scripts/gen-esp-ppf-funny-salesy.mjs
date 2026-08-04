import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "dreamina-seedance-2-0-260128/i2v";

const JOBS = [
  {
    key: "funny",
    ref: "public/ESP/ref-white-ev-suv-front.jpeg",
    out: "public/ESP/_gen/esp-ppf-funny-pakcik-15s.mp4",
    prompt: `Fast-paced social media advertisement style, punchy and high energy, fun and snappy - NOT slow, NOT elegant, NOT cinematic. A glossy white SUV in a car detailing studio with a colour swatch wall behind it. Energetic camera: quick snappy zoom-ins and a fast orbit around the front, bright light streaks flashing across the glossy bonnet and headlights, upbeat and playful pace. The car stays still; keep its exact shape, white colour and the studio unchanged. AUDIO (generate a spoken voice): a fun, warm, slightly loud older Malaysian uncle (pakcik) voiceover, cheeky and energetic like a friendly market salesman hyping a deal, casual spoken Bahasa Malaysia, comedic timing, clear pronunciation, talking across the whole 15 seconds: "Eh bro! Beli keta baru, confirm bangga kan? Tapi sekali kena batu jalan... terus nangis! Pakcik cakap, jangan tunggu calar baru sedar. ESP Wrapz ada Full Front PPF lapan point lima mil, dengan Graphene sepuluh H Coating - hanya RM seribu dua ratus je, tujuh tahun warranty weh! Confirm senyum sampai telinga. Jom!" Under the voice, upbeat fun playful background music at low volume. Real clear energetic Malay human speech, not robotic. Negatives: no text, no captions, no subtitles, no on-screen words, no logos, no watermark, no people, no faces, no hands, avoid warping the body, avoid changing the paint colour.`,
  },
  {
    key: "salesy",
    ref: "public/ESP/ref-maroon-merc-cla-front.jpeg",
    out: "public/ESP/_gen/esp-ppf-salesy-confident-15s.mp4",
    prompt: `Slow confident premium automotive commercial style, cinematic but brisk - not sluggish. A glossy maroon Mercedes CLA in a dark car detailing studio, dramatic single-source key light raking across the paint. Camera: one slow deliberate orbit from front three-quarter to side profile, light gliding smoothly across the bonnet and door panels, controlled and premium pace, no chaotic cuts. The car stays still; keep its exact shape, maroon colour and the studio unchanged. AUDIO (generate a spoken voice): one confident, warm adult Malaysian voice, direct and reassuring, clear conversational Bahasa Malaysia with light English mixed in, salesperson-firm but not shouting, talking across the whole 15 seconds: "Lindungi pelaburan anda. ESP Wrapz Autospa - Full Front PPF lapan point lima mil, dengan Full Car Graphene sepuluh H Coating, hanya RM seribu dua ratus, dengan tujuh tahun warranty. Kereta kekal licin, kekal bernilai. WhatsApp ESP Wrapz sekarang - Sungai Buloh." Low confident background music under the voice. Real clear human speech, not robotic. Negatives: no text, no captions, no subtitles, no on-screen words, no logos, no watermark, no people, no faces, no hands, avoid warping the body, avoid changing the paint colour.`,
  },
];

const OPTS = { aspect_ratio: "9:16", resolution: "1080p", duration: "15s", generate_audio: true };

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function attemptJob(base, key, job) {
  console.log("uploading start frame...");
  const inputImage = await uploadImage(base, key, job.ref);

  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: job.prompt, inputImage, generationOptions: OPTS }),
  });
  const sub = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`submit HTTP ${res.status}: ${JSON.stringify(sub).slice(0, 300)}`);
  const { generationId, requestId } = sub;
  if (!generationId || !requestId) throw new Error(`unexpected submit response: ${JSON.stringify(sub).slice(0, 300)}`);
  console.log(`submitted: request=${requestId} generation=${generationId}`);

  const statusUrl = `${base}/api/generate/status?requestId=${encodeURIComponent(requestId)}&modelId=${encodeURIComponent(MODEL)}&generationId=${encodeURIComponent(generationId)}&byteplusVideo=true&durationSec=15&resolution=1080p`;
  for (let i = 1; i <= 80; i++) {
    await sleep(6000);
    const sres = await fetch(statusUrl, { headers: { Authorization: `Bearer ${key}` } });
    const s = await sres.json().catch(() => ({}));
    if (s.status === "completed" && s.outputUrl) {
      const v = await fetch(s.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await v.arrayBuffer());
      const outPath = path.join(ROOT, job.out);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, buf);
      console.log(`saved ${job.out} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }
    if (s.status === "failed") throw new Error(`generation failed: ${s.error || "unknown"}`);
    if (i % 5 === 0) console.log(`[${i * 6}s] ${s.status || "?"}`);
  }
  throw new Error("timed out after ~8 min");
}

async function runJob(base, key, job) {
  console.log(`\n=== ${job.key} ===`);
  const backoffs = [20000, 45000, 90000, 150000, 240000];
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      await attemptJob(base, key, job);
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isRateLimit = /rate-limited|rate limit/i.test(msg);
      if (!isRateLimit || attempt === backoffs.length) throw e;
      const wait = backoffs[attempt];
      console.log(`rate-limited, retrying in ${wait / 1000}s (attempt ${attempt + 1}/${backoffs.length})...`);
      await sleep(wait);
    }
  }
}

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  if (!key) throw new Error("Missing MotionBoards API key");
  for (const job of JOBS) await runJob(base, key, job);
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exitCode = 1; });
