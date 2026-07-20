import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const REFDIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-refs");
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
async function imgB64(file) {
  const buf = await sharp(file).resize({ width: 1080, height: 1920, fit: "inside" }).png().toBuffer();
  return buf.toString("base64");
}

async function main() {
  await loadEnv();
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const kid = await imgB64(path.join(REFDIR, "kid-01.png"));
  const s1 = await imgB64(path.join(REFDIR, "studio-01-wide.png"));
  const s2 = await imgB64(path.join(REFDIR, "studio-02-side.png"));

  const prompt = `The young Malaysian boy from the reference image (preteen, glasses)
stands in the real car-wrap detailing studio from the reference images, on the
red-accent floor path, smiling warmly and gesturing toward the colourful vinyl
wrap rolls on the wall as he presents to camera, kid-friendly energetic tone.
Friendly upbeat boy's voice speaking casually about a colour-change wrap service;
quiet studio room tone, light music. Smooth steady camera slowly pushing in.
Photoreal, candid, no text overlays, no watermark.`;

  const input = [
    { type: "image", data: kid, mime_type: "image/png" },
    { type: "image", data: s1, mime_type: "image/png" },
    { type: "image", data: s2, mime_type: "image/png" },
    { type: "text", text: prompt },
  ];

  console.log("creating interaction...");
  let interaction = await ai.interactions.create({
    model: "gemini-omni-flash-preview",
    input,
    background: true,
    store: true,
    response_format: { type: "video", delivery: "uri" },
    generation_config: { video_config: { task: "reference_to_video" } },
  });
  console.log("id:", interaction.id, "status:", interaction.status);

  let tries = 0;
  while (interaction.status !== "completed" && interaction.status !== "failed" && tries < 60) {
    await new Promise((r) => setTimeout(r, 6000));
    process.stdout.write(".");
    interaction = await ai.interactions.get(interaction.id);
    tries++;
  }
  console.log("\nfinal:", interaction.status);
  if (interaction.status !== "completed") { console.log(JSON.stringify(interaction).slice(0, 1000)); process.exit(1); }

  function findUri(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (typeof obj.uri === "string" && obj.uri.includes("download")) return obj.uri;
    for (const k of Object.keys(obj)) { const r = findUri(obj[k]); if (r) return r; }
    return null;
  }
  const uri = findUri(interaction);
  const dlUrl = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${apiKey}`;
  const r = await fetch(dlUrl);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.mkdir(OUT, { recursive: true });
  const outPath = path.join(OUT, "kid-wrap-test.mp4");
  await fs.writeFile(outPath, buf);
  console.log("SAVED:", path.relative(ROOT, outPath));
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
