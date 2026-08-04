// Google Omni Flash fallback for the Faeez-led PPF clip; Seedance rejects real-person references.
// Run: node scripts/gen-hyperwrapz-faezz-ppf-omni.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';

const ROOT = '/Users/faeez/motionboards';
const OUT = path.join(ROOT, 'Hyperwrapz & Detailing', '_gen', 'video-clips');
const OUTPUT = path.join(OUT, 'hyperwrapz-faezz-ppf-funny-v2-15s.mp4');
const REFS = [
  "Faeez's photos/0dc03762-823c-416f-ab60-10735b222c97.jpeg", // grey-shirt identity reference
  'Hyperwrapz & Detailing/studio/hyperwrap.jpeg',
];
const OFFICIAL_LOGO = 'Hyperwrapz & Detailing/file_1784542697071_030875c0424f.jpeg';
const execFileAsync = promisify(execFile);

const PROMPT = `Create one continuous vertical 9:16 reference-to-video advert.
Use Image 1 as the exact real identity reference for Faeez. Preserve his exact facial identity, hairstyle, skin tone, body proportions and natural expression. Use Image 2 as the exact real Hyperwrapz & Detailing workshop: preserve the fluorescent ceiling lights, vinyl-roll wall, car bay, floor and background layout. Faeez wears the same plain grey T-shirt from Image 1, with no logo, badge, words or graphics, and stands beside a glossy dark sedan.

He speaks calmly direct to camera in an easy Kuala Lumpur/Klang Valley conversational style, with natural pauses and a subtle deadpan humour. He leans toward camera at the opening and points to one tiny stone chip on the front bumper. While explaining PPF, he holds a small transparent film sample beside the bonnet. After saying “Simple,” he gives a brief knowing look. Finish with a relaxed WhatsApp hand gesture beside the completed car.

Say exactly: “Bro, kereta baru? Jangan bagi batu highway makan cat dulu. PPF ni screen protector untuk kereta. Simple. Full front PPF harga mula dari seribu sembilan ratus. WhatsApp Hyperwrapz—jaga cat dulu, menangis tak payah.”

Camera is stable and natural: gentle push-in, one crisp close detail of transparent film on the bonnet, then end medium-wide on Faeez and car. Natural quiet workshop ambience and a soft modern music bed, ducked under speech. No on-screen text.

Do not add captions, titles, logos, prices, phone numbers, subtitles, watermarks, extra people, changed identity, extra limbs, face changes, voice changes, robotic or rushed pacing, lip-sync drift, camera shake, flickering lights, warped car panels, changing car colour, background morphing, fake shop signs, or any logo on clothing.`;

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, 'env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

async function imageBase64(file) {
  return (await sharp(path.join(ROOT, file)).rotate().resize({ width: 1080, height: 1920, fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
}

function findUri(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.uri === 'string' && value.uri.includes('download')) return value.uri;
  for (const key of Object.keys(value)) {
    const found = findUri(value[key]);
    if (found) return found;
  }
  return null;
}

async function main() {
  await loadEnv();
  if (!process.env.GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY in env.local.');
  await fs.mkdir(OUT, { recursive: true });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const input = [
    { type: 'image', data: await imageBase64(REFS[0]), mime_type: 'image/png' },
    { type: 'image', data: await imageBase64(REFS[1]), mime_type: 'image/png' },
    { type: 'text', text: PROMPT },
  ];

  console.log('Submitting Google Omni Flash reference-to-video...');
  let interaction = await ai.interactions.create({
    model: 'gemini-omni-flash-preview', input, background: true, store: true,
    response_format: { type: 'video', delivery: 'uri' },
    generation_config: { video_config: { task: 'reference_to_video' } },
  });
  for (let tries = 1; interaction.status !== 'completed' && interaction.status !== 'failed' && tries <= 60; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    interaction = await ai.interactions.get(interaction.id);
    console.log(`status: ${interaction.status} (${tries * 6}s)`);
  }
  if (interaction.status !== 'completed') throw new Error(`Generation ended with ${interaction.status}.`);
  const uri = findUri(interaction.steps || interaction);
  if (!uri) throw new Error('No downloadable video URI returned.');
  const downloadUrl = uri.includes('key=') ? uri : `${uri}${uri.includes('?') ? '&' : '?'}key=${process.env.GEMINI_API_KEY}`;
  const video = await fetch(downloadUrl);
  if (!video.ok) throw new Error(`Video download failed: HTTP ${video.status}`);
  const native = path.join(OUT, 'hyperwrapz-faezz-ppf-funny-native.mp4');
  await fs.writeFile(native, Buffer.from(await video.arrayBuffer()));
  const logoCrop = path.join(OUT, 'hyperwrapz-official-logo-lock.png');
  await sharp(path.join(ROOT, OFFICIAL_LOGO)).extract({ left: 0, top: 320, width: 768, height: 620 }).resize({ width: 210 }).png().toFile(logoCrop);
  await execFileAsync('ffmpeg', ['-y', '-i', native, '-i', logoCrop, '-filter_complex', '[0:v][1:v]overlay=18:18:format=auto[v]', '-map', '[v]', '-map', '0:a?', '-t', '15', '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', OUTPUT]);
  console.log(`Saved ${OUTPUT}`);
}

await main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
