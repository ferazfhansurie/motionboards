import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");
const SOURCE = path.join(OUT, "hyperwrapz-ad1-c4-15s.mp4");
const PRESENTER = "/Users/faeez/.codex/generated_images/019f7e18-95b4-7880-af2a-69e831af4a0b/exec-90487694-1789-44a4-aaa9-cc526873c30b.png";
const SHOP_WIDE = path.join(ROOT, "Hyperwrapz & Detailing", "studio", "hyperwrap.jpeg");
const SHOP_SIDE = path.join(ROOT, "Hyperwrapz & Detailing", "studio", "hyperwrap2.jpeg");
const execFileAsync = promisify(execFile);

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}
async function imageBase64(file) { return (await sharp(file).resize({ width: 1080, height: 1920, fit: "inside" }).png().toBuffer()).toString("base64"); }
async function extractFrame(file) {
  const frame = path.join(OUT, "hyperwrapz-ad1-c4-rm2200-start.png");
  await execFileAsync("ffmpeg", ["-y", "-sseof", "-0.2", "-i", file, "-frames:v", "1", "-update", "1", "-q:v", "2", frame]);
  return imageBase64(frame);
}
function findUri(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.uri === "string" && value.uri.includes("download")) return value.uri;
  for (const key of Object.keys(value)) { const found = findUri(value[key]); if (found) return found; }
  return null;
}

async function main() {
  await loadEnv();
  await fs.access(SOURCE);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const input = [
    { type: "image", data: await extractFrame(SOURCE), mime_type: "image/png" },
    { type: "image", data: await imageBase64(PRESENTER), mime_type: "image/png" },
    { type: "image", data: await imageBase64(SHOP_WIDE), mime_type: "image/png" },
    { type: "text", text: `Create a 15-second vertical continuation clip using the first image as the exact start frame. Preserve the same adult Malay-Chinese mixed Malaysian woman, face, long loose hair, navy polo, same green car, same Hyperwrapz shop, same lighting, same camera perspective and same background. She looks into camera, smiles naturally and says clearly in casual Klang Valley Manglish: "Harga mula dari dua ribu dua ratus. WhatsApp Hyperwrapz sekarang untuk your colour consultation." This means RM2,200. Do not say, display, imply or generate RM2,900 anywhere. No price graphics, no subtitles, no readable text, no logo. Match the previous female voice style: same warm Malaysian accent, pitch, timbre, pacing and natural delivery. Keep the background stable and unchanged; animate only her face, lips, hair and one small welcoming hand gesture. Photorealistic skin texture, accurate lip sync, no background morphing, no jitter, no extra people, no new car, no watermark, no jump cut.` },
  ];
  let interaction = await ai.interactions.create({ model: "gemini-omni-flash-preview", input, background: true, store: true, response_format: { type: "video", delivery: "uri" }, generation_config: { video_config: { task: "reference_to_video" } } });
  let tries = 0;
  while (interaction.status !== "completed" && interaction.status !== "failed" && tries < 60) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    interaction = await ai.interactions.get(interaction.id);
    tries++;
    console.log(`status: ${interaction.status} (${tries * 6}s)`);
  }
  if (interaction.status !== "completed") throw new Error(`Generation ended with ${interaction.status}`);
  const uri = findUri(interaction.steps || interaction);
  if (!uri) throw new Error("No downloadable URI returned");
  const url = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const native = path.join(OUT, "hyperwrapz-ad1-c4-rm2200-native.mp4");
  await fs.writeFile(native, Buffer.from(await response.arrayBuffer()));
  const final = path.join(OUT, "hyperwrapz-ad1-c4-rm2200-15s.mp4");
  await execFileAsync("ffmpeg", ["-y", "-i", native, "-t", "15", "-vf", "tpad=stop_mode=clone:stop_duration=15", "-af", "apad=pad_dur=15", "-shortest", "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", final]);
  console.log(`Saved: ${final}`);
}
main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
