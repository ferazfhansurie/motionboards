// Gemini Omni Flash I2V runner + last-frame chaining.
//   node scripts/_tmp_hw_video.mjs clip <inputImage.png> <outName> "<motion prompt>"
//   -> generates a ~10s 9:16 clip, downloads mp4, extracts last frame + samples.
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
const pexec = promisify(execFile);

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");
const MODEL = process.env.HW_MODEL || "veo-3.1-fast-generate-preview/i2v";

async function loadEnv() {
  for (const f of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}
const base = () => (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
const key = () => process.env.MB_API_KEY || process.env.MB_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadImage(file) {
  const buf = await sharp(file).jpeg({ quality: 92 }).toBuffer();
  const r = await fetch(`${base()}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "content-type": "image/jpeg", "x-filename": path.basename(file) + ".jpg" },
    body: buf,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(`upload ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.url;
}

async function genClip(inputImage, outName, prompt) {
  const img = await uploadImage(inputImage);
  const startRes = await fetch(`${base()}/api/generate`, {
    method: "POST", headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, inputImage: img, generationOptions: { aspect_ratio: "9:16", duration: "8s", resolution: "720p" } }),
  });
  const start = await startRes.json().catch(() => ({}));
  if (!startRes.ok) throw new Error(`start ${startRes.status}: ${JSON.stringify(start).slice(0, 300)}`);
  if (start.status === "completed" && start.outputUrl) return download(start.outputUrl, outName);
  const { generationId, requestId } = start;
  if (!generationId || !requestId) throw new Error(`no ids: ${JSON.stringify(start).slice(0, 300)}`);
  process.stdout.write(`polling`);
  const qs = new URLSearchParams({ requestId, modelId: MODEL, generationId, geminiVideo: "true", durationSec: "8", resolution: "720p" });
  for (let i = 0; i < 60; i++) {
    await sleep(6000);
    process.stdout.write(".");
    const r = await fetch(`${base()}/api/generate/status?${qs}`, { headers: { Authorization: `Bearer ${key()}` } });
    const j = await r.json().catch(() => ({}));
    if (j.status === "completed" && j.outputUrl) { process.stdout.write(" done\n"); return download(j.outputUrl, outName); }
    if (j.status === "failed" || j.error) throw new Error(`poll failed: ${JSON.stringify(j).slice(0, 300)}`);
  }
  throw new Error("timeout after 6min");
}

async function download(url, outName) {
  const abs = url.startsWith("http") ? url : `${base()}${url}`;
  const r = await fetch(abs, { headers: { Authorization: `Bearer ${key()}` } });
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const mp4 = path.join(OUT, `${outName}.mp4`);
  await fs.writeFile(mp4, buf);
  return mp4;
}

async function extractFrames(mp4, outName) {
  // last frame (for chaining) + 3 sample frames (for review)
  const last = path.join(OUT, `${outName}-lastframe.png`);
  await pexec("ffmpeg", ["-y", "-sseof", "-0.2", "-i", mp4, "-frames:v", "1", "-q:v", "2", last]);
  const grid = path.join(OUT, `${outName}-samples.png`);
  // 3 frames at 10%, 50%, 90%
  await pexec("ffmpeg", ["-y", "-i", mp4, "-vf", "select='eq(n\\,5)+eq(n\\,120)+eq(n\\,230)',tile=3x1,scale=1080:-1", "-frames:v", "1", grid]);
  return { last, grid };
}

async function main() {
  await loadEnv();
  const [cmd, inputImage, outName, prompt] = process.argv.slice(2);
  await fs.mkdir(OUT, { recursive: true });
  if (cmd === "clip") {
    console.log(`[${outName}] generating from ${path.basename(inputImage)}...`);
    const mp4 = await genClip(inputImage, outName, prompt);
    console.log("mp4:", path.relative(ROOT, mp4));
    const { last, grid } = await extractFrames(mp4, outName);
    console.log("lastframe:", path.relative(ROOT, last));
    console.log("samples:", path.relative(ROOT, grid));
  } else {
    console.log("usage: clip <inputImage> <outName> <prompt>");
  }
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
