import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/fathopes-ep1-phone-call-storyboard-kit-face-12s.png");
const REFS = [
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/fathopes-ep1-phone-call-storyboard-variant-5.png"),
  path.join(ROOT, "FatHopes IMG/sg-video/refs/WhatsApp Image 2026-07-23 at 12.15.10 PM.jpeg"),
];
const PROMPT = "Edit Image 1, the approved storyboard, while preserving its exact 8-panel layout, panel order, phone-call story, HQ laboratory, split-screen black villain silhouette, wide-brim hat reveal, worm, Sparron and third hero. Use only two references. Image 1 is the storyboard to edit. Image 2 is the exact Kit face and art-style reference. Replace every Kit face in Image 1 with Image 2’s identity and design: round chubby face, thick angled eyebrows, small brown eyes, short black hair beneath the wide-brim black hat, rounded nose, broad mouth, teal workwear and black gloves. Match Image 2’s clean 2D cel-shaded linework, facial rendering, colour treatment and expression style while preserving Image 1’s existing lab composition and other characters. Do not use the older Kit face from Image 1. Keep Sparron, the third hero, the worm, phone and unknown black figure unchanged. Exactly three heroes in HQ; no aunty, no extra woman or extra characters. No captions, subtitles, speech bubbles, readable text or watermarks. Add a 12-second pacing note visually through the storyboard: give the final panel a sustained confused reaction, with the three heroes holding their looks toward the phone before the cut. Do not change the story: phone rings, heroes react, Kit answers, split-screen unknown black figure with only a wide-brim hat visible, everyone ends confused. No villain face or name reveal.";

async function loadEnv() {
  for (const file of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, file), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
}
async function upload(base, key, file, index) {
  const b = await sharp(file).resize({ width: 1000, height: 1400, fit: "inside" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const r = await fetch(base + "/api/upload", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "image/jpeg", "x-filename": "kit-face-two-ref-" + index + ".jpg" }, body: b });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error("upload failed HTTP " + r.status + ": " + JSON.stringify(j));
  return j.url;
}
async function main() {
  await loadEnv();
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  if (!key) throw new Error("Missing Motionboards API key");
  const refs = [];
  for (let i = 0; i < REFS.length; i++) refs.push(await upload(base, key, REFS[i], i + 1));
  const r = await fetch(base + "/api/generate", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt: PROMPT, inputImages: refs, generationOptions: { aspect_ratio: "9:16", resolution: "2K" } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status !== "completed" || !j.outputUrl) throw new Error("HTTP " + r.status + ": " + JSON.stringify(j).slice(0, 800));
  const img = await fetch(j.outputUrl, { headers: { Authorization: "Bearer " + key } });
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, Buffer.from(await img.arrayBuffer()));
  console.log("saved " + OUT);
}
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
