import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/fathopes-ep1-phone-call-storyboard-variant-5-kit-face-updated.png");
const REFS = [
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/fathopes-ep1-phone-call-storyboard-variant-5.png"),
  path.join(ROOT, "FatHopes IMG/sg-video/refs/WhatsApp Image 2026-07-23 at 12.15.10 PM.jpeg"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Sparron-Action.png"),
  path.join(ROOT, "public/Fathopes_heroes_animated/superheroes-group.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/lab-style-reference-1.png"),
];
const PROMPT = "Edit the supplied storyboard sheet while preserving its exact 8-panel layout, panel order, phone-call story, HQ laboratory, split-screen black villain silhouette, wide-brim hat reveal, worm, Sparron and third hero. Do not redesign the storyboard.\\n\\nImage 1 is the storyboard to edit. Image 2 is the exact Kit face reference and must be the source of truth for Kit in every panel: round chubby face, thick angled eyebrows, small brown eyes, short black hair under the wide-brim black hat, rounded nose, broad mouth, teal workwear and black gloves. Replace every Kit face in the storyboard with this exact identity and facial design. Keep Kit’s teal uniform, reflective bands, hat and proportions consistent. Do not use the older Kit face from Image 1.\\n\\nImage 3 locks Sparron. Image 4 locks the third hero lineup. Image 5 locks the established 2D cel-shaded FatHopes lab style, linework, teal palette, glass reflections and oily highlights.\\n\\nKeep exactly three heroes in HQ: Kit, Sparron and the third hero. No aunty, no extra woman and no extra characters. Preserve the phone ringing, confused reactions, close-up phone shots, split-screen caller, black figure, hidden face, visible wide-brim hat silhouette and final group confusion. No captions, subtitles, speech bubbles, readable text, watermarks, morphing or changed outfits.";

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
  const b = await sharp(file).resize({ width: 900, height: 1200, fit: "inside" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const r = await fetch(base + "/api/upload", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "image/jpeg", "x-filename": "kit-face-update-ref-" + index + ".jpg" }, body: b });
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
