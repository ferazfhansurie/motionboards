// Face-free Seedance 2.0 Fast Omni background layer for the Program PUSH collection/commission card.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = '/Users/faeez/motionboards';
const OUT = path.join(ROOT, 'FatHopes IMG', 'push-driver-app-infographics');
const MODEL = 'dreamina-seedance-2-0-fast-260128/omni';
const OPTIONS = { aspect_ratio: '9:16', resolution: '720p', duration: '15s', generate_audio: true };
const REFERENCE = 'FatHopes IMG/push-driver-app-infographics/backgrounds/03-collection-commission-bg.png';

const PROMPT = `Use [Image1] as the master faceless 9:16 collection-growth background. Preserve its white editorial canvas, lime and aqua route, metallic collection tokens, glass forms, rising bars, and upward arrow. No people or faces appear at any point.

MOTION: A single collection token begins to glide along the route. More tokens rise in sequence and the route gains a soft lime-aqua glow. At the phrase "komisen pun naik", the bars build upward and one token settles cleanly at each level. At "semuanya dalam app", route nodes pulse once with a calm app-like signal. At "WhatsApp sekarang", hold the upward arrow and leave the lower area stable for a later real-team reveal. Only route lines, tokens, bars, soft reflections, and light move.

CAMERA: one slow deliberate push in. Preserve the composition, white negative space, color palette, and geometry.

AUDIO: adult Malaysian male, relaxed conversational KL/Klang Valley Malay, warm and natural. Say exactly: "Lagi banyak collection, lagi banyak komisen. Semuanya dalam app. Nak mula? WhatsApp sekarang." Leave clear natural pauses after each sentence. Use a light modern pulse and gentle depot ambience; lift it softly in the pauses and duck beneath speech.

DO NOT: show people, faces, hands, bodies, characters, logos, words, letters, numbers, captions, QR codes, watermarks, fake app text, camera shake, rapid cuts, flicker, morphing, warped geometry, or a changing background.`;

async function loadEnv() {
  for (const file of ['env.local', '.env.local']) {
    try {
      const raw = await fs.readFile(path.join(ROOT, file), 'utf8');
      for (const line of raw.split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    } catch {}
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || 'https://motionboards.vercel.app').replace(/\/$/, '');
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error('Missing MotionBoards API key.');
  if (Buffer.byteLength(PROMPT, 'utf8') > 2000) throw new Error('Seedance prompt exceeds 2000 bytes.');

  const image = await sharp(path.join(ROOT, REFERENCE)).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const upload = await fetch(`${base}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'image/png', 'x-filename': 'push-collection-face-free-bg.png' },
    body: image,
  });
  const uploadBody = await upload.json().catch(() => ({}));
  if (!upload.ok || !uploadBody.url) throw new Error(`Upload failed: HTTP ${upload.status}`);

  console.log(`Seedance prompt: ${Buffer.byteLength(PROMPT, 'utf8')} bytes`);
  const submitted = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages: [uploadBody.url], generationOptions: OPTIONS }),
  });
  const job = await submitted.json().catch(() => ({}));
  if (!submitted.ok || !job.requestId || !job.generationId) throw new Error(`Seedance submit: HTTP ${submitted.status} ${JSON.stringify(job).slice(0, 300)}`);
  console.log(`Submitted request=${job.requestId} generation=${job.generationId}`);

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
  if (!video.ok) throw new Error(`Seedance download: HTTP ${video.status}`);
  await fs.mkdir(OUT, { recursive: true });
  const destination = path.join(OUT, '03-collection-seedance-face-free-base-15s.mp4');
  await fs.writeFile(destination, Buffer.from(await video.arrayBuffer()));
  console.log(`Saved ${destination}`);
}

await main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
