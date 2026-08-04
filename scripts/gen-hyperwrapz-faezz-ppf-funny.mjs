// Seedance 2.0 Fast Omni: Faeez-led, short funny PPF talking-head advert.
// Run: node scripts/gen-hyperwrapz-faezz-ppf-funny.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = '/Users/faeez/motionboards';
const MODEL = 'dreamina-seedance-2-0-fast-260128/omni';
const OPTIONS = { aspect_ratio: '9:16', resolution: '720p', duration: '15s', generate_audio: true };
const REFS = [
  "Faeez's photos/0dc03762-823c-416f-ab60-10735b222c97.jpeg", // face identity
  "Faeez's photos/668e440b-1107-41b4-b699-2db188fc4249.jpeg", // full body identity
  'Hyperwrapz & Detailing/studio/hyperwrap.jpeg', // real workshop
];
const OUTPUT = 'Hyperwrapz & Detailing/_gen/video-clips/hyperwrapz-faezz-ppf-funny-15s.mp4';

const PROMPT = `Use @Image1 and @Image2 only as the exact identity references for Faeez. Use @Image3 only as the fixed real Hyperwrapz & Detailing workshop location. Create one continuous photorealistic vertical PPF advert: Faeez wears a clean dark workshop polo, standing beside a glossy dark sedan in the real shop. Preserve his exact facial identity, hairstyle, skin tone and natural proportions across the entire video.

Faeez speaks directly to camera in a friendly, slightly deadpan Kuala Lumpur/Klang Valley conversational style. At “kereta baru?” he leans in and points to one tiny stone chip on the front bumper. At “PPF ni screen protector untuk kereta” he holds a small transparent film sample beside the bonnet, then gives the camera a short knowing look after “Simple.” On the price, he smiles and makes one relaxed WhatsApp hand gesture beside the finished car. The pacing is calm and clear, with short natural silent pauses between sentences.

AUDIO — one real-sounding Malaysian male voice, warm and conversational, unhurried, no robotic cadence. Say exactly:
“Bro, kereta baru? Jangan bagi batu highway makan cat dulu. PPF ni screen protector untuk kereta. Simple. Harga mula dari dua ribu dua ratus. WhatsApp Hyperwrapz—jaga cat dulu, menangis tak payah.”

CAMERA: stable handheld phone-commercial look, one gentle push-in then close detail of film on the bonnet, ending in a clean medium shot. Natural workshop ambience stays quiet under voice.

DO NOT: add any captions, title cards, logos, prices, phone numbers, subtitles, text, watermarks, extra people, duplicate Faeez, face changes, voice changes, lip-sync drift, fast speech, camera shake, flickering lights, warped cars, changing car colour, morphing background, fake workshop signs, or exaggerated comedy acting.`;

async function loadEnv() {
  for (const file of ['env.local', '.env.local']) {
    try {
      const raw = await fs.readFile(path.join(ROOT, file), 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function uploadReference(base, key, file, index) {
  const jpg = await sharp(path.join(ROOT, file)).rotate().resize({ width: 960, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  const response = await fetch(`${base}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'image/jpeg', 'x-filename': `hyperwrapz-faezz-ppf-ref-${index + 1}.jpg` },
    body: jpg,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(`Reference ${index + 1} upload failed: HTTP ${response.status}`);
  return data.url;
}

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || 'https://motionboards.vercel.app').replace(/\/$/, '');
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error('Missing MotionBoards API key.');
  if (Buffer.byteLength(PROMPT, 'utf8') > 2000) throw new Error('Seedance prompt exceeds 2,000 bytes.');

  const images = [];
  for (let index = 0; index < REFS.length; index++) images.push(await uploadReference(base, key, REFS[index], index));
  console.log(`Seedance prompt: ${Buffer.byteLength(PROMPT, 'utf8')} bytes; references uploaded.`);

  const submitted = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages: images, generationOptions: OPTIONS }),
  });
  const job = await submitted.json().catch(() => ({}));
  if (!submitted.ok || !job.requestId || !job.generationId) throw new Error(`Seedance submit failed: HTTP ${submitted.status} ${JSON.stringify(job).slice(0, 240)}`);
  console.log(`Submitted ${job.requestId}.`);

  const query = new URLSearchParams({ requestId: job.requestId, modelId: MODEL, generationId: job.generationId, byteplusVideo: 'true', durationSec: '15', resolution: '720p' });
  let outputUrl = '';
  for (let tick = 1; tick <= 120; tick++) {
    await sleep(5000);
    const statusResponse = await fetch(`${base}/api/generate/status?${query}`, { headers: { Authorization: `Bearer ${key}` } });
    const status = await statusResponse.json().catch(() => ({}));
    if (status.status === 'completed' && status.outputUrl) { outputUrl = status.outputUrl; break; }
    if (status.status === 'failed') throw new Error(status.error || 'Seedance generation failed.');
    if (tick % 6 === 0) console.log(`${tick * 5}s: ${status.status || 'processing'}`);
  }
  if (!outputUrl) throw new Error('Seedance timed out after 10 minutes.');

  const video = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  if (!video.ok) throw new Error(`Video download failed: HTTP ${video.status}`);
  const destination = path.join(ROOT, OUTPUT);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, Buffer.from(await video.arrayBuffer()));
  console.log(`Saved ${destination}`);
}

await main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
