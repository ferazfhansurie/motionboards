// Omni reference_to_video chain runner: generates a sequence of clips where
// clip N+1 seeds from clip N's last frame (as an additional ASSET reference,
// alongside the girl + studio refs) to keep continuity, with a new motion
// beat/prompt per clip. Concatenates all clips into one ~1min video at the end.
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
const pexec = promisify(execFile);

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
async function imgB64FromFile(file) {
  const buf = await sharp(file).resize({ width: 1080, height: 1920, fit: "inside" }).png().toBuffer();
  return buf.toString("base64");
}
async function imgB64FromBuffer(buf) {
  const out = await sharp(buf).resize({ width: 1080, height: 1920, fit: "inside" }).png().toBuffer();
  return out.toString("base64");
}

async function extractLastFrame(mp4Path) {
  const png = mp4Path.replace(/\.mp4$/, "-lastframe.png");
  await pexec("ffmpeg", ["-y", "-sseof", "-0.15", "-i", mp4Path, "-frames:v", "1", "-update", "1", "-q:v", "2", png]);
  return png;
}

async function genOneClip(ai, { girlB64, studio1B64, studio2B64, lastFrameB64, prompt, seconds, slug }) {
  const input = [];
  if (lastFrameB64) {
    // continuation mode: lead with the previous clip's last frame as the primary
    // continuity reference, plus the identity/studio refs to keep them locked
    input.push({ type: "image", data: lastFrameB64, mime_type: "image/png" });
  }
  input.push({ type: "image", data: girlB64, mime_type: "image/png" });
  input.push({ type: "image", data: studio1B64, mime_type: "image/png" });
  input.push({ type: "image", data: studio2B64, mime_type: "image/png" });
  input.push({ type: "text", text: prompt });

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
    await new Promise((r) => setTimeout(r, 6000));
    process.stdout.write(".");
    interaction = await ai.interactions.get(interaction.id);
    tries++;
  }
  if (interaction.status !== "completed") throw new Error(`clip ${slug} status=${interaction.status}`);
  function findUri(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (typeof obj.uri === "string" && obj.uri.includes("download")) return obj.uri;
    for (const k of Object.keys(obj)) { const r = findUri(obj[k]); if (r) return r; }
    return null;
  }
  const uri = findUri(interaction.steps || interaction);
  if (!uri) throw new Error(`no uri for ${slug}`);
  const apiKey = process.env.GEMINI_API_KEY;
  const dlUrl = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${apiKey}`;
  const r = await fetch(dlUrl);
  if (!r.ok) throw new Error(`download failed ${r.status} for ${slug}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const mp4 = path.join(OUT, `${slug}.mp4`);
  await fs.writeFile(mp4, buf);
  return mp4;
}

async function concat(mp4s, outSlug) {
  const listFile = path.join(OUT, `${outSlug}-concat-list.txt`);
  await fs.writeFile(listFile, mp4s.map((f) => `file '${f}'`).join("\n"));
  const outFile = path.join(OUT, `${outSlug}-FULL.mp4`);
  await pexec("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outFile]);
  return outFile;
}

const BEATS = [
  { slug: "wrap-c1", seconds: 10, prompt: `The young Malaysian-Chinese woman from the reference stands in the real car-wrap detailing studio, on the red-accent floor, smiling warmly and gesturing toward the colourful vinyl wrap rolls on the wall as she opens the video introducing colour-change wraps. Friendly upbeat female voice speaking casually in English; quiet studio room tone, light music. Smooth steady camera slowly pushing in. Photoreal, candid, no text overlays.` },
  { slug: "wrap-c2", seconds: 10, prompt: `Continuing seamlessly from the same moment and pose: she turns slightly and reaches out to touch/pull one of the vinyl wrap rolls (a bold matte colour) off the rack, holding it up toward camera to show the texture and finish, still smiling and talking enthusiastically. Same voice continuing naturally about colour options. Same studio, same outfit, same continuous energy - no jump cuts, no wardrobe change.` },
  { slug: "wrap-c3", seconds: 10, prompt: `Continuing seamlessly: she walks a few steps further down the studio aisle past the vinyl wall, gesturing at several different colour rolls in sequence (blue, red, matte black) as if showcasing variety, animated and engaged, talking the whole time. Same studio, same person, same outfit, continuous natural motion, no jump cuts.` },
  { slug: "wrap-c4", seconds: 10, prompt: `Continuing seamlessly: she stops, faces the camera directly with a confident closing smile, gestures welcomingly with both hands as if inviting viewers to visit, delivering a friendly closing line. Same studio, same person, same outfit, natural continuous motion, warm satisfied tone, no jump cuts, no text overlays.` },
];

async function main() {
  await loadEnv();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  await fs.mkdir(OUT, { recursive: true });

  const girlB64 = await imgB64FromFile(path.join(REFDIR, "girl-01.png"));
  const studio1B64 = await imgB64FromFile(path.join(REFDIR, "studio-01-wide.png"));
  const studio2B64 = await imgB64FromFile(path.join(REFDIR, "studio-02-side.png"));

  const mp4s = [];
  let lastFrameB64 = null;
  for (const beat of BEATS) {
    process.stdout.write(`[${beat.slug}] generating`);
    const mp4 = await genOneClip(ai, { girlB64, studio1B64, studio2B64, lastFrameB64, prompt: beat.prompt, seconds: beat.seconds, slug: beat.slug });
    console.log(` done -> ${path.relative(ROOT, mp4)}`);
    mp4s.push(mp4);
    const lastFramePng = await extractLastFrame(mp4);
    lastFrameB64 = await imgB64FromBuffer(await fs.readFile(lastFramePng));
  }

  console.log("concatenating...");
  const full = await concat(mp4s, "wrap");
  console.log("FULL VIDEO:", path.relative(ROOT, full));
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
