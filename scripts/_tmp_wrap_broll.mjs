// Editorial wrap b-roll: 2 distinct camera angles/movements showing vinyl wrap
// film being applied to the real Myvi, using the real photo directly (no AI
// studio compositing).
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips", "broll");
const CARIMG = path.join(ROOT, "Hyperwrapz & Detailing", "myvi.jpeg");

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

async function genBroll({ ai, prompt, slug }) {
  const img = await imgB64(CARIMG);
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

const SHOTS = [
  {
    slug: "wrap-broll-lowangle-c3",
    prompt: `Editorial automotive-ad b-roll. Animate this exact real photo of the
black Perodua Myvi in the detailing shop (keep the same car, same shop, same
floor). CAMERA: low, slightly upward-angled tracking shot alongside the car's
front-quarter panel, moving smoothly left to right at bumper height. ACTION: a
gloved installer's hands smoothly squeegee a large sheet of matte deep-blue vinyl
wrap film onto the hood, wet-application technique, visible soap-water bubbles
being pushed out from under the film in clean strokes. Dramatic side lighting
reflecting off the wet film. Realistic ambient workshop sound (squeegee friction,
quiet background), no dialogue, no music, no text overlays, no watermark.
Photoreal, candid documentary-commercial b-roll style, cinematic depth of field.`,
  },
  {
    slug: "wrap-broll-overhead-c4",
    prompt: `Editorial automotive-ad b-roll. Animate this exact real photo of the
black Perodua Myvi in the detailing shop (keep the same car, same shop, same
floor). CAMERA: overhead top-down shot looking straight down at the hood and
roof, slow continuous push-in movement. ACTION: the matte deep-blue vinyl wrap
film is being laid down and smoothed across the hood in a satisfying continuous
motion, reflections of the ceiling's linear lights rippling across the new glossy
surface as it gets smoothed flat, installer's gloved hands visible at frame edge.
Realistic ambient workshop sound (squeegee friction, quiet background), no
dialogue, no music, no text overlays, no watermark. Photoreal, candid
documentary-commercial b-roll style, cinematic depth of field.`,
  },
];

async function main() {
  await loadEnv();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  await fs.mkdir(OUT, { recursive: true });
  const only = process.argv[2] ? parseInt(process.argv[2], 10) : SHOTS.length;
  for (const shot of SHOTS.slice(0, only)) {
    process.stdout.write(`[${shot.slug}] generating`);
    const mp4 = await genBroll({ ai, prompt: shot.prompt, slug: shot.slug });
    console.log(` done -> ${path.relative(ROOT, mp4)}`);
  }
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
