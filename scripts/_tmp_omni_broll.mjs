// B-roll generator: animate a REAL car photo directly (no AI studio compositing)
// to show the actual service action happening - e.g. PPF being applied.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
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

async function genBroll({ ai, imagePath, prompt, slug }) {
  const img = await imgB64(imagePath);
  const input = [
    { type: "image", data: img, mime_type: "image/jpeg" },
    { type: "text", text: prompt },
  ];
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
  if (interaction.status !== "completed") throw new Error(`${slug} status=${interaction.status}: ${JSON.stringify(interaction).slice(0,400)}`);
  const uri = findUri(interaction);
  if (!uri) throw new Error(`no uri for ${slug}`);
  const apiKey = process.env.GEMINI_API_KEY;
  const dlUrl = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${apiKey}`;
  const r = await fetch(dlUrl);
  if (!r.ok) throw new Error(`download failed ${r.status} for ${slug}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const mp4 = await safePath(path.join(OUT, `${slug}.mp4`));
  await fs.writeFile(mp4, buf);
  return mp4;
}

const PPF_PROMPT = `Animate this exact real photo of the black Perodua Myvi in the
detailing shop (keep the same car, same shop, same floor, same everything from the
photo). Show a pair of installer's hands (gloved, professional) applying a large
sheet of clear paint-protection film (PPF) onto the car's front bonnet, using a
squeegee tool to smooth out the film and press out air bubbles, careful and
precise real workshop motion. Close-up/medium shot on the bonnet area. Realistic
ambient workshop sound (squeegee friction, quiet background), no dialogue, no
music, no text overlays, no watermark. Photoreal, candid documentary b-roll style.`;

async function main() {
  await loadEnv();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  await fs.mkdir(OUT, { recursive: true });
  const imagePath = path.join(ROOT, "Hyperwrapz & Detailing", "myvi.jpeg");

  process.stdout.write("[ppf-broll] generating");
  const mp4 = await genBroll({ ai, imagePath, prompt: PPF_PROMPT, slug: "ppf-broll-myvi" });
  console.log(` done -> ${path.relative(ROOT, mp4)}`);
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
