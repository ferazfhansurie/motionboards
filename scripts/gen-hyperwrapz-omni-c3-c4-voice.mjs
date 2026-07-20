import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");
const C2 = path.join(OUT, "hyperwrapz-ad1-c2-15s-locked.mp4");
const VOICE_REF = path.join(OUT, "hyperwrapz-ad1-c2-voice.wav");
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
async function audioBase64(file) { return (await fs.readFile(file)).toString("base64"); }
async function lastFrame(file) {
  const frame = file.replace(/\.mp4$/, "-lastframe.png");
  await execFileAsync("ffmpeg", ["-y", "-sseof", "-0.2", "-i", file, "-frames:v", "1", "-update", "1", "-q:v", "2", frame]);
  return imageBase64(frame);
}
function findUri(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.uri === "string" && value.uri.includes("download")) return value.uri;
  for (const key of Object.keys(value)) { const found = findUri(value[key]); if (found) return found; }
  return null;
}

const prompts = [
  {
    slug: "hyperwrapz-ad1-c3-15s-voice",
    line: "Protect original paint, scratch resistant, UV protection—and easy maintenance.",
    action: "She stays in the same position and uses only two small natural hand gestures while speaking to camera.",
  },
  {
    slug: "hyperwrapz-ad1-c4-15s-voice",
    line: "Harga mula dari dua ribu dua ratus. WhatsApp Hyperwrapz sekarang untuk your colour consultation.",
    action: "She stays beside the same car, finishes with one small welcoming hand gesture and a natural smile.",
  },
];

async function generate(ai, frame, spec) {
  const input = [
    { type: "image", data: frame, mime_type: "image/png" },
    { type: "text", text: `Continue directly from the supplied final frame. The supplied image must be the exact first frame. Preserve the exact same adult Malay-Chinese mixed Malaysian woman, face, hair, navy polo, car, shop background, vinyl racks, walls, lights, floor tiles and camera perspective. ${spec.action} She says clearly: "${spec.line}". Match the approved voice from Clips 1 and 2: same adult female Klang Valley Manglish voice, same pitch, timbre, warmth, accent, pacing, pronunciation and recording quality. Keep background fully locked. Animate only the presenter’s face, lips, hair and hands. Stable commercial camera, realistic skin microtexture, natural lip sync. No new car, no extra people, no background morphing, no jitter, no subtitles, no logo, no watermark, no jump cut.` },
  ];
  let interaction = await ai.interactions.create({ model: "gemini-omni-flash-preview", input, background: true, store: true, response_format: { type: "video", delivery: "uri" }, generation_config: { video_config: { task: "reference_to_video" } } });
  let tries = 0;
  while (interaction.status !== "completed" && interaction.status !== "failed" && tries < 60) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    interaction = await ai.interactions.get(interaction.id);
    tries++;
    console.log(`[${spec.slug}] ${interaction.status} (${tries * 6}s)`);
  }
  if (interaction.status !== "completed") throw new Error(`${spec.slug} ended with status ${interaction.status}`);
  const uri = findUri(interaction.steps || interaction);
  if (!uri) throw new Error(`No video URI for ${spec.slug}`);
  const url = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const native = path.join(OUT, `${spec.slug}-native.mp4`);
  await fs.writeFile(native, Buffer.from(await response.arrayBuffer()));
  const final = path.join(OUT, `${spec.slug}.mp4`);
  await execFileAsync("ffmpeg", ["-y", "-i", native, "-t", "15", "-vf", "tpad=stop_mode=clone:stop_duration=15", "-af", "apad=pad_dur=15", "-shortest", "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", final]);
  return { final, native };
}

async function main() {
  await loadEnv();
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  await fs.mkdir(OUT, { recursive: true });
  await fs.access(C2);
  await execFileAsync("ffmpeg", ["-y", "-i", C2, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", VOICE_REF]);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let frame = await lastFrame(C2);
  const generated = [];
  for (const spec of prompts) {
    const result = await generate(ai, frame, spec);
    generated.push(result.final);
    frame = await lastFrame(result.native);
  }
  const list = path.join(OUT, "hyperwrapz-ad1-voicefix-concat.txt");
  await fs.writeFile(list, generated.map((file) => `file '${file}'`).join("\n"));
  console.log(`Saved replacements: ${generated.join(", ")}`);
}
main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
