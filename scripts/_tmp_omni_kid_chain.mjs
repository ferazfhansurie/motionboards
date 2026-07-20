// Omni reference_to_video chain runner (kid presenter): generates a sequence of
// clips where clip N+1 continues from clip N's last frame + kid/studio identity
// refs, each with a calm, educational/factual beat (no hard-sell energy).
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
  const buf = await sharp(file).resize({ width: 720, height: 1280, fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
  return buf.toString("base64");
}
async function imgB64FromBuffer(buf) {
  const out = await sharp(buf).resize({ width: 720, height: 1280, fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
  return out.toString("base64");
}
async function extractLastFrame(mp4Path) {
  const png = mp4Path.replace(/\.mp4$/, "-lastframe.png");
  await pexec("ffmpeg", ["-y", "-sseof", "-0.15", "-i", mp4Path, "-frames:v", "1", "-update", "1", "-q:v", "2", png]);
  return png;
}
// Voice-consistency: pull the voice out of clip 1 (the "voice bible") and reuse
// it as an audio reference on every later clip, instead of chaining N-1->N which
// lets small drifts compound. Anchoring everything to one source keeps the same
// speaker identity (pitch/pacing/accent) across the whole video.
async function extractVoiceRef(mp4Path) {
  const mp3 = mp4Path.replace(/\.mp4$/, "-voice.mp3");
  await pexec("ffmpeg", ["-y", "-i", mp4Path, "-vn", "-acodec", "libmp3lame", "-b:a", "128k", mp3]);
  const buf = await fs.readFile(mp3);
  return buf.toString("base64");
}
// Never clobber an existing output file - if the target name is taken, append
// -v2, -v3, etc. until we find a free name.
async function safePath(p) {
  try { await fs.access(p); } catch { return p; } // doesn't exist yet -> use as-is
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

async function genOneClip(ai, { kidB64, studio1B64, studio2B64, lastFrameB64, voiceRefB64, prompt, slug }) {
  const input = [];
  if (lastFrameB64) input.push({ type: "image", data: lastFrameB64, mime_type: "image/jpeg" });
  input.push({ type: "image", data: kidB64, mime_type: "image/jpeg" });
  input.push({ type: "image", data: studio1B64, mime_type: "image/jpeg" });
  input.push({ type: "image", data: studio2B64, mime_type: "image/jpeg" });
  // NOTE: audio-reference voice-locking doesn't work - Omni Flash Preview
  // rejects it ("Audio input modality is not enabled for this model"). Falling
  // back to a strong text instruction only; not a hard guarantee like the
  // image identity refs are.
  const finalPrompt = voiceRefB64
    ? `${prompt}\n\nVOICE CONSISTENCY: keep the exact same boy's voice, pitch, pacing and accent as used in the earlier clips of this same video - do not change speaker identity partway through.`
    : prompt;
  input.push({ type: "text", text: finalPrompt });

  let interaction = await ai.interactions.create({
    model: "gemini-omni-flash-preview",
    input,
    background: true,
    store: true,
    response_format: { type: "video", delivery: "uri", aspect_ratio: "9:16" },
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

async function concat(mp4s, outSlug) {
  const listFile = path.join(OUT, `${outSlug}-concat-list.txt`);
  await fs.writeFile(listFile, mp4s.map((f) => `file '${f}'`).join("\n"));
  const outFile = await safePath(path.join(OUT, `${outSlug}-FULL.mp4`));
  await pexec("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outFile]);
  return outFile;
}

const CONT = `Continuing seamlessly from the exact same moment, same studio, same
boy, same outfit, same continuous natural motion - no jump cuts, no wardrobe
change, no scene change.`;

const TONE = `Voice: pure local Kuala Lumpur / Klang Valley conversational Manglish
- a natural mix of Malay and English exactly how a real KL preteen boy talks day
to day. This is Bahasa Malaysia Malaysia, NOT Bahasa Indonesia/Jakarta: final "-a"
is a schwa (saya = "sa-yuh", apa = "a-puh"), soft "r", relaxed KL intonation. No
Indonesian accent, no American accent, no British RP, no generic international
voice. Tone: calm, relaxed, matter-of-fact and educational - like he's genuinely
explaining how the service works and what it costs, NOT hyped-up salesy energy.
Quiet studio room tone, no loud music. Photoreal, candid, no text overlays.`;

const BEATS = [
  { slug: "omni-kid-wrap-c1", prompt: `The young Malaysian boy from the reference (preteen, glasses) stands in the real car-wrap detailing studio, on the red-accent floor, calm and friendly, gesturing simply toward the colourful vinyl wrap rolls on the wall as he opens the video. He says in Klang Valley Manglish: "Eh guys, ni kat HyperWrapz & Detailing. Tau tak, boleh tukar warna kereta terus, tak payah hantar kereta pergi cat?" Smooth steady camera slowly pushing in. ${TONE}` },
  { slug: "omni-kid-wrap-c2", prompt: `${CONT} He reaches out and pulls one vinyl wrap roll off the rack, holding it up naturally to show the colour and finish. He says in Klang Valley Manglish: "Tengok ni, banyak gila warna diorang ada. Ada matte, ada gloss, ada chrome, semua jenis pun ada kat sini." ${TONE}` },
  { slug: "omni-kid-wrap-c3", prompt: `${CONT} He walks a couple of steps further down the studio aisle and gestures calmly at two different coloured rolls side by side. He says in Klang Valley Manglish: "Pastu harga pun tak mahal sangat - dalam RM2900 kalau basic punya, sampai RM3800 kalau nak brand yang lagi premium sikit." ${TONE}` },
  { slug: "omni-kid-wrap-c4", prompt: `${CONT} He touches the surface of a vinyl roll, explaining relaxed. He says in Klang Valley Manglish: "Yang best part dia, cat asal kereta korang tu langsung tak kena apa-apa, dia selamat je kat dalam sana." ${TONE}` },
  { slug: "omni-kid-wrap-c5", prompt: `${CONT} He turns back to face the camera directly, calm and simple hand gesture. He says in Klang Valley Manglish: "Dan kalau satu hari korang bosan dengan warna tu, boleh tanggal balik je, senang, takde kesan pun kat cat asal." ${TONE}` },
  { slug: "omni-kid-wrap-c6", prompt: `${CONT} He gives a calm closing smile and a simple, low-key hand gesture. He says in Klang Valley Manglish: "So kalau korang berminat nak tau harga untuk kereta korang sendiri, terus je WhatsApp HyperWrapz & Detailing ya." ${TONE}` },
];

async function main() {
  await loadEnv();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  await fs.mkdir(OUT, { recursive: true });

  const kidB64 = await imgB64FromFile(path.join(REFDIR, "kid-01.png"));
  const studio1B64 = await imgB64FromFile(path.join(REFDIR, "studio-01-wide.png"));
  const studio2B64 = await imgB64FromFile(path.join(REFDIR, "studio-02-side.png"));

  const resumeFlag = process.argv.find((a) => a.startsWith("--resume-from="));
  const resumeFrom = resumeFlag ? parseInt(resumeFlag.split("=")[1], 10) : 0; // 0-indexed beat to start generating at
  const maxFlag = process.argv.find((a) => a.startsWith("--max="));
  const maxBeats = maxFlag ? parseInt(maxFlag.split("=")[1], 10) : BEATS.length; // stop after generating this many NEW clips

  const mp4s = [];
  let lastFrameB64 = null;
  let voiceRefB64 = null; // set once, from clip 1's audio - reused for every later clip
  let generatedCount = 0;
  for (let i = 0; i < BEATS.length; i++) {
    const beat = BEATS[i];
    const mp4Path = path.join(OUT, `${beat.slug}.mp4`);
    if (i >= resumeFrom && generatedCount >= maxBeats) {
      console.log(`[stopping early: --max=${maxBeats} reached]`);
      break;
    }
    if (i < resumeFrom) {
      // reuse existing clip, just derive lastFrame (+ voice ref if this is clip 1) from it
      mp4s.push(mp4Path);
      const lastFramePng = await extractLastFrame(mp4Path);
      lastFrameB64 = await imgB64FromBuffer(await fs.readFile(lastFramePng));
      if (i === 0) voiceRefB64 = await extractVoiceRef(mp4Path);
      console.log(`[${beat.slug}] reused existing -> ${path.relative(ROOT, mp4Path)}`);
      continue;
    }
    process.stdout.write(`[${beat.slug}] generating`);
    // clip 1 (i===0) has no voice ref yet - it establishes the voice bible
    const mp4 = await genOneClip(ai, { kidB64, studio1B64, studio2B64, lastFrameB64, voiceRefB64: i === 0 ? null : voiceRefB64, prompt: beat.prompt, slug: beat.slug });
    console.log(` done -> ${path.relative(ROOT, mp4)}`);
    mp4s.push(mp4);
    const lastFramePng = await extractLastFrame(mp4);
    lastFrameB64 = await imgB64FromBuffer(await fs.readFile(lastFramePng));
    if (i === 0) voiceRefB64 = await extractVoiceRef(mp4);
    generatedCount++;
  }

  if (mp4s.length === BEATS.length) {
    console.log("concatenating...");
    const full = await concat(mp4s, "kid-wrap");
    console.log("FULL VIDEO:", path.relative(ROOT, full));
  } else {
    console.log(`Stopped after ${mp4s.length}/${BEATS.length} clips. Run again with --resume-from=${mp4s.length} to continue.`);
  }
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
