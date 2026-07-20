// Veo 3.1 "Ingredients" (native multi-reference) chain runner, kid presenter,
// Manglish dialogue, 9:16. Each clip: kid + studio1 + studio2 (+ prev last-frame
// as a 4th continuity reference) -> generateVideos -> download -> extract last
// frame -> feed into next clip. Concatenate all clips at the end.
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
const MODEL = "veo-3.1-fast-generate-preview";

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
async function imgBytes(file) {
  return sharp(file).resize({ width: 1080, height: 1920, fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
}
async function extractLastFrame(mp4Path) {
  const png = mp4Path.replace(/\.mp4$/, "-lastframe.jpg");
  await pexec("ffmpeg", ["-y", "-sseof", "-0.15", "-i", mp4Path, "-frames:v", "1", "-update", "1", "-q:v", "2", png]);
  return png;
}
function asRef(buf) {
  return { image: { imageBytes: buf.toString("base64"), mimeType: "image/jpeg" }, referenceType: "ASSET" };
}

async function genOneClip(ai, { kidBuf, s1Buf, s2Buf, lastFrameBuf, prompt, slug }) {
  // Veo Ingredients caps at 3 reference images total. First clip: kid + both
  // studio angles (3). Continuation clips: last-frame + kid + one studio angle
  // (the last-frame itself carries the scene/continuity, kid keeps identity lock).
  const refs = [];
  if (lastFrameBuf) {
    refs.push(asRef(lastFrameBuf), asRef(kidBuf), asRef(s1Buf));
  } else {
    refs.push(asRef(kidBuf), asRef(s1Buf), asRef(s2Buf));
  }

  let op = await ai.models.generateVideos({
    model: MODEL,
    prompt,
    config: { referenceImages: refs, aspectRatio: "9:16", numberOfVideos: 1 },
  });
  let n = 0;
  while (!op.done && n < 40) {
    await new Promise((r) => setTimeout(r, 8000));
    process.stdout.write(".");
    op = await ai.operations.getVideosOperation({ operation: op });
    n++;
  }
  if (!op.done) throw new Error(`timeout for ${slug}`);
  const vids = op.response?.generatedVideos || [];
  if (!vids.length) throw new Error(`no video for ${slug}: ${JSON.stringify(op.response).slice(0, 300)}`);
  const outPath = path.join(OUT, `${slug}.mp4`);
  await ai.files.download({ file: vids[0].video, downloadPath: outPath });
  return outPath;
}

async function concat(mp4s, outSlug) {
  const listFile = path.join(OUT, `${outSlug}-concat-list.txt`);
  await fs.writeFile(listFile, mp4s.map((f) => `file '${f}'`).join("\n"));
  const outFile = path.join(OUT, `${outSlug}-FULL.mp4`);
  await pexec("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outFile]);
  return outFile;
}

const CONT = `Continuing seamlessly from the exact same moment, same studio, same
boy, same outfit, same continuous natural motion - no jump cuts, no wardrobe
change, no scene change.`;

const TONE = `Voice: casual Malaysian MANGLISH (natural mix of Malay + English,
exactly how a real Malaysian preteen boy talks - NOT formal Bahasa Malaysia, NOT
pure English). Tone: calm, relaxed, matter-of-fact, educational - genuinely
explaining how the service works and what it costs, not hyped-up salesy energy.
Quiet studio room tone, no loud music. Photoreal, candid, no text overlays.`;

const BEATS = [
  { slug: "veo-kid-wrap-c1", prompt: `The young Malaysian boy from the reference (preteen, glasses) stands in the real car-wrap detailing studio, on the red-accent floor, calm and friendly, gesturing simply toward the colourful vinyl wrap rolls on the wall as he opens the video. He says in Manglish: "Ni namanya colour change wrap - tukar warna kereta tanpa kena cat balik." Smooth steady camera slowly pushing in. ${TONE}` },
  { slug: "veo-kid-wrap-c2", prompt: `${CONT} He reaches out and pulls one vinyl wrap roll off the rack, holding it up naturally to show the colour and finish. He says in Manglish: "Ada lebih 3000 warna - matte, satin, gloss, ke chrome, semua ada." ${TONE}` },
  { slug: "veo-kid-wrap-c3", prompt: `${CONT} He walks a couple of steps further down the studio aisle and gestures calmly at two different coloured rolls side by side. He says in Manglish: "Harga bergantung brand - dalam RM2900 sampai RM3800 untuk yang premium punya." ${TONE}` },
  { slug: "veo-kid-wrap-c4", prompt: `${CONT} He touches the surface of a vinyl roll, explaining relaxed. He says in Manglish: "Wrap ni pun protect cat asal kereta, dan boleh tanggal balik takyah risau rosak cat." ${TONE}` },
  { slug: "veo-kid-wrap-c5", prompt: `${CONT} He turns back to face the camera directly, calm and simple hand gesture. He says in Manglish: "Installation semua kitorang buat professional, dan tahan lama kalau jaga elok-elok." ${TONE}` },
  { slug: "veo-kid-wrap-c6", prompt: `${CONT} He gives a calm closing smile and a simple, low-key hand gesture. He says in Manglish: "Kalau nak tau harga untuk kereta korang, WhatsApp je kedai kami." ${TONE}` },
];

async function main() {
  await loadEnv();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  await fs.mkdir(OUT, { recursive: true });

  const kidBuf = await imgBytes(path.join(REFDIR, "kid-01.png"));
  const s1Buf = await imgBytes(path.join(REFDIR, "studio-01-wide.png"));
  const s2Buf = await imgBytes(path.join(REFDIR, "studio-02-side.png"));

  const resumeFlag = process.argv.find((a) => a.startsWith("--resume-from="));
  const resumeFrom = resumeFlag ? parseInt(resumeFlag.split("=")[1], 10) : 0;

  const mp4s = [];
  let lastFrameBuf = null;
  for (let i = 0; i < BEATS.length; i++) {
    const beat = BEATS[i];
    const mp4Path = path.join(OUT, `${beat.slug}.mp4`);
    if (i < resumeFrom) {
      mp4s.push(mp4Path);
      lastFrameBuf = await fs.readFile(await extractLastFrame(mp4Path));
      console.log(`[${beat.slug}] reused -> ${path.relative(ROOT, mp4Path)}`);
      continue;
    }
    process.stdout.write(`[${beat.slug}] generating`);
    const mp4 = await genOneClip(ai, { kidBuf, s1Buf, s2Buf, lastFrameBuf, prompt: beat.prompt, slug: beat.slug });
    console.log(` done -> ${path.relative(ROOT, mp4)}`);
    mp4s.push(mp4);
    lastFrameBuf = await fs.readFile(await extractLastFrame(mp4));
  }

  console.log("concatenating...");
  const full = await concat(mp4s, "veo-kid-wrap");
  console.log("FULL VIDEO:", path.relative(ROOT, full));
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
