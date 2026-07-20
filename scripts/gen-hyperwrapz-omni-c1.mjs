import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");
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

async function imageBase64(file) {
  return (await sharp(file).resize({ width: 1080, height: 1920, fit: "inside" }).png().toBuffer()).toString("base64");
}

function findUri(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.uri === "string" && value.uri.includes("download")) return value.uri;
  for (const key of Object.keys(value)) {
    const found = findUri(value[key]);
    if (found) return found;
  }
  return null;
}

async function main() {
  await loadEnv();
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in env.local");
  await fs.mkdir(OUT, { recursive: true });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Create the opening clip of a premium vertical automotive advertisement, reference-to-video task.

Use the first reference as the exact presenter identity: an adult Malay-Chinese mixed Malaysian woman with ultra-realistic skin texture, natural facial microdetails, long loose free-flowing black hair, navy polo shirt and dark jeans. Use the second and third references as the exact Hyperwrapz automotive wrapping shop, including the red-and-black floor, fluorescent ceiling lights, colourful vinyl rolls and detailing bay.

Action: She walks confidently into the real shop and looks toward the colourful vinyl rolls. The camera tracks beside her, then smoothly arcs around into a medium close-up. She lightly touches two vinyl rolls, turns to camera, smiles naturally and speaks clearly in casual Klang Valley Manglish: "Kereta lama, tapi you nak new look? Jom tukar colour tanpa cat semula."

Keep the performance natural and professional, like a real Malaysian car-detailing presenter. Preserve the exact face, hair, outfit, shop layout and car-wrap atmosphere. Smooth gimbal movement, subtle hair motion, authentic footsteps, quiet workshop ambience and upbeat premium automotive music. Photorealistic commercial cinematography, realistic skin pores, detailed eyes, individual hair strands, accurate glossy vinyl reflections. Vertical 9:16. No children, no extra people, no subtitles, no generated text, no logos, no watermark, no jump cuts, no surreal changes.`;

  const input = [
    { type: "image", data: await imageBase64(PRESENTER), mime_type: "image/png" },
    { type: "image", data: await imageBase64(SHOP_WIDE), mime_type: "image/png" },
    { type: "image", data: await imageBase64(SHOP_SIDE), mime_type: "image/png" },
    { type: "text", text: prompt },
  ];

  console.log("Submitting Google Gemini Omni Flash reference-to-video...");
  let interaction = await ai.interactions.create({
    model: "gemini-omni-flash-preview",
    input,
    background: true,
    store: true,
    response_format: { type: "video", delivery: "uri" },
    generation_config: { video_config: { task: "reference_to_video" } },
  });
  let tries = 0;
  while (interaction.status !== "completed" && interaction.status !== "failed" && tries < 60) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    interaction = await ai.interactions.get(interaction.id);
    tries++;
    console.log(`status: ${interaction.status} (${tries * 6}s)`);
  }
  if (interaction.status !== "completed") throw new Error(`Generation ended with status ${interaction.status}`);
  const uri = findUri(interaction.steps || interaction);
  if (!uri) throw new Error("No downloadable video URI returned by Gemini");
  const downloadUrl = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`Video download failed: HTTP ${response.status}`);
  const nativePath = path.join(OUT, "hyperwrapz-ad1-c1-omni-native.mp4");
  await fs.writeFile(nativePath, Buffer.from(await response.arrayBuffer()));

  const finalPath = path.join(OUT, "hyperwrapz-ad1-c1-15s.mp4");
  await execFileAsync("ffmpeg", ["-y", "-i", nativePath, "-t", "15", "-vf", "tpad=stop_mode=clone:stop_duration=15", "-af", "apad=pad_dur=15", "-shortest", "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", finalPath]);
  console.log(`Saved: ${finalPath}`);
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
