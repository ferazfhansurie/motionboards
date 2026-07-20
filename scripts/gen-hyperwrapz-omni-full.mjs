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

async function extractLastFrame(file) {
  const frame = file.replace(/\.mp4$/, "-lastframe.png");
  await execFileAsync("ffmpeg", ["-y", "-sseof", "-0.2", "-i", file, "-frames:v", "1", "-update", "1", "-q:v", "2", frame]);
  return imageBase64(frame);
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

const clips = [
  {
    slug: "hyperwrapz-ad1-c1-15s",
    prompt: `Opening clip. The adult Malay-Chinese mixed Malaysian woman from @Image2 walks slowly into the exact Hyperwrapz shop shown in @Image3 and @Image4. She stops beside the same colourful vinyl-roll rack, lightly touches two rolls, turns to camera and says clearly in casual Klang Valley Manglish: "Kereta lama, tapi you nak new look? Jom tukar colour tanpa cat semula." Keep the shop background completely locked and unchanged: same walls, same ceiling lights, same vinyl rack positions, same red-and-black floor, same car position. Use a restrained slow push-in only. No background morphing, no moving shelves, no new objects, no extra people, no scene transition, no jump cut.`,
  },
  {
    slug: "hyperwrapz-ad1-c2-15s",
    prompt: `Continue directly from the previous frame. The same woman remains in the same exact shop position and wardrobe. She turns slightly toward the same vinyl rack and presents several colour options with one natural hand gesture, showing matte, satin, gloss and metallic rolls. She says clearly in casual Klang Valley Manglish: "At Hyperwrapz, ada 3,000-plus colours—matte, satin, gloss, metallic, sampai chrome." The background is an immutable locked plate: preserve the exact same walls, ceiling lights, rack geometry, floor pattern and car position from the previous frame. Only her arms, face, hair and lips move. Keep camera nearly static with a very slow controlled push-in. No new background, no object movement, no extra people, no text, no cut.`,
  },
  {
    slug: "hyperwrapz-ad1-c3-15s",
    prompt: `Continue directly from the previous frame with the same woman, same face, same loose hair, same navy polo and same shop. Do not cut away. She stays in the same position and uses only two small natural hand gestures while speaking to camera: "Protect original paint, scratch resistant, UV protection—and easy maintenance." Keep the background completely frozen and unchanged, including the exact same car, walls, lights, vinyl rack, floor tiles and perspective. Only animate her lips, eyes, hair and hands. No camera orbit, no lateral move, no background jitter, no room redesign, no extra cars or people, no subtitles, no logo, no jump cuts.`,
  },
  {
    slug: "hyperwrapz-ad1-c4-15s",
    prompt: `Continue directly from the previous frame. The same woman remains in the exact same position beside the same car and looks confidently into camera. Do not reveal a different angle or a different vehicle. She says clearly in casual Klang Valley Manglish: "Harga mula dari dua ribu dua ratus. WhatsApp Hyperwrapz sekarang untuk your colour consultation." She finishes with one small welcoming hand gesture and a natural smile. Keep every pixel of the shop background visually consistent: same car, same walls, same lights, same vinyl racks, same red-and-black floor and same camera perspective. Only animate the presenter’s face, lips, hair and hand. No background morphing, no camera move, no new people, no text overlays, no watermark, no jump cut.`,
  },
];

async function generateClip(ai, refs, previousFrame, clip) {
  const input = [];
  if (previousFrame) {
    // For continuations, use only the approved previous final frame. Additional
    // shop references caused Gemini to blend in a different car or room layout.
    input.push({ type: "image", data: previousFrame, mime_type: "image/png" });
  } else {
    input.push({ type: "image", data: refs.presenter, mime_type: "image/png" });
    input.push({ type: "image", data: refs.shopWide, mime_type: "image/png" });
    input.push({ type: "image", data: refs.shopSide, mime_type: "image/png" });
  }
  input.push({ type: "text", text: `${clip.prompt}\n\nThe supplied image is the exact final frame and must also be the exact first frame of this continuation. Preserve every background object, car, wall, rack, light, floor tile and camera perspective. Animate only the presenter and the explicitly requested small action.` });

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
    console.log(`[${clip.slug}] ${interaction.status} (${tries * 6}s)`);
  }
  if (interaction.status !== "completed") throw new Error(`${clip.slug} ended with status ${interaction.status}`);
  const uri = findUri(interaction.steps || interaction);
  if (!uri) throw new Error(`No downloadable video URI for ${clip.slug}`);
  const url = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed for ${clip.slug}: HTTP ${response.status}`);
  const nativePath = path.join(OUT, `${clip.slug}-native.mp4`);
  await fs.writeFile(nativePath, Buffer.from(await response.arrayBuffer()));
  const finalPath = path.join(OUT, `${clip.slug}-locked.mp4`);
  await execFileAsync("ffmpeg", ["-y", "-i", nativePath, "-t", "15", "-vf", "tpad=stop_mode=clone:stop_duration=15", "-af", "apad=pad_dur=15", "-shortest", "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", finalPath]);
  return { finalPath, nativePath };
}

async function main() {
  await loadEnv();
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in env.local");
  await fs.mkdir(OUT, { recursive: true });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const refs = {
    presenter: await imageBase64(PRESENTER),
    shopWide: await imageBase64(SHOP_WIDE),
    shopSide: await imageBase64(SHOP_SIDE),
  };
  // The approved first clip is the continuity anchor. Do not regenerate it.
  // Extract its real last frame and feed that as the primary start reference
  // for the first new continuation clip.
  const approvedClip = path.join(OUT, "hyperwrapz-ad1-c1-15s.mp4");
  await fs.access(approvedClip);
  let previousFrame = await extractLastFrame(approvedClip);
  const outputs = [approvedClip];
  for (const clip of clips.slice(1)) {
    const result = await generateClip(ai, refs, previousFrame, clip);
    outputs.push(result.finalPath);
    previousFrame = await extractLastFrame(result.nativePath);
  }
  const list = path.join(OUT, "hyperwrapz-ad1-4x15s-locked-concat.txt");
  await fs.writeFile(list, outputs.map((file) => `file '${file}'`).join("\n"));
  const full = path.join(OUT, "hyperwrapz-ad1-full-60s-locked.mp4");
  await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", full]);
  console.log(`Saved full ad: ${full}`);
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
