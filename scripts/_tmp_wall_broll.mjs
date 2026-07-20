// 10s b-roll: the colourful vinyl wrap wall only - no car, no people, just a
// cinematic pan/push across the rolls.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const REFDIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-refs");
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips", "broll");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
async function imgB64(file) {
  const buf = await sharp(file).resize({ width: 1080, height: 1920, fit: "inside" }).jpeg({ quality: 90 }).toBuffer();
  return buf.toString("base64");
}
async function safePath(p) {
  try { await fs.access(p); } catch { return p; }
  const ext = path.extname(p);
  const base = p.slice(0, -ext.length);
  for (let n = 2; ; n++) {
    const candidate = `${base}-v${n}${ext}`;
    try { await fs.access(candidate); } catch { return candidate; }
  }
}
function findUri(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.uri === "string" && obj.uri.includes("download")) return obj.uri;
  for (const k of Object.keys(obj)) { const r = findUri(obj[k]); if (r) return r; }
  return null;
}

const PROMPT = `Animate this exact real photo of the colourful vinyl wrap roll
wall in the detailing shop (keep the same wall, same racks, same colours - no
cars, no people in frame at all, just the wall of rolls). CAMERA: slow, smooth
cinematic pan/push movement gliding along the wall, gradually revealing the
different coloured vinyl rolls (blue, red, orange, yellow, silver, teal) one
after another, shallow depth of field with soft highlights catching the glossy
film surfaces under the studio lights. No text, no logos, no watermark, no
dialogue, no music - just quiet ambient studio room tone. Photoreal, editorial
commercial b-roll style.`;

async function main() {
  await loadEnv();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  await fs.mkdir(OUT, { recursive: true });

  const img = await imgB64(path.join(REFDIR, "studio-01-wide.png"));
  const input = [
    { type: "image", data: img, mime_type: "image/jpeg" },
    { type: "text", text: PROMPT },
  ];

  process.stdout.write("[wall-broll] generating");
  let interaction = await ai.interactions.create({
    model: "gemini-omni-flash-preview",
    input,
    background: true,
    store: true,
    response_format: { type: "video", delivery: "uri", aspect_ratio: "9:16" },
    generation_config: { video_config: { task: "image_to_video" } },
  });
  let tries = 0;
  while (interaction.status !== "completed" && interaction.status !== "failed" && tries < 60) {
    await new Promise((r) => setTimeout(r, 6000));
    process.stdout.write(".");
    interaction = await ai.interactions.get(interaction.id);
    tries++;
  }
  if (interaction.status !== "completed") { console.log(`\nfailed: ${JSON.stringify(interaction).slice(0,400)}`); process.exit(1); }
  const uri = findUri(interaction);
  const apiKey = process.env.GEMINI_API_KEY;
  const dlUrl = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${apiKey}`;
  const r = await fetch(dlUrl);
  const buf = Buffer.from(await r.arrayBuffer());
  const mp4 = await safePath(path.join(OUT, "wall-broll-only.mp4"));
  await fs.writeFile(mp4, buf);
  console.log(` done -> ${path.relative(ROOT, mp4)}`);
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
