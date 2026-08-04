// Face-free Seedance 2.0 Fast Omni sequence: mini tanker + three Program PUSH cards + logo.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = '/Users/faeez/motionboards';
const OUT = path.join(ROOT, 'FatHopes IMG', 'push-driver-app-infographics');
const MODEL = 'dreamina-seedance-2-0-fast-260128/omni';
const OPTIONS = { aspect_ratio: '9:16', resolution: '720p', duration: '15s', generate_audio: true };
const REFS = [
  'FatHopes IMG/gaji-candidates/07_minitrucks_PUX08459.jpg',
  'FatHopes IMG/push-posters-real-jobdesc/1784620818511_zryfts_image.png',
  'FatHopes IMG/push-driver-app-infographics/01-program-push-driver-callout.png',
  'FatHopes IMG/push-driver-app-infographics/02-ai-auto-routing.png',
  'FatHopes IMG/push-driver-app-infographics/03-collection-whatsapp-cta-no-team.png',
];

const PROMPT = `Use [Image1] as the real FatHopes mini tanker reference. Preserve its exact green cab, tanker geometry, FatHopes livery, depot setting, and daylight. Use [Image2] as the exact FatHopes Energy logo reference. Use [Image3], [Image4], and [Image5] as the three approved Program PUSH infographic plates; preserve their white Apple-style layouts, colors, text hierarchy, spelling, line breaks, and CTA exactly as locked 2D artwork.

MOTION: Start with the parked mini tanker and one lime-aqua route line coming alive along the ground. At "Program PUSH", the route resolves into [Image3]. At "download app", the route becomes app nodes and reveals [Image4]. At "lagi banyak collection", the nodes rise as collection tokens and reveal [Image5]. At "WhatsApp sekarang", hold the third plate cleanly and resolve to [Image2]. Only the tanker reflections, route lines, app nodes, collection tokens, soft light, and transition masks move. Camera makes one slow deliberate push in throughout.

AUDIO: adult Malaysian male, relaxed conversational KL/Klang Valley Malay, warm and natural. Say exactly: "Driver, ada lori? Program PUSH. Download app, AI route kan trip. Lagi banyak collection, lagi banyak komisen. WhatsApp sekarang." Leave clear natural pauses. Use a light modern pulse and subtle depot ambience, rising gently in silence and ducking beneath speech.

DO NOT: show people, faces, hands, bodies, characters, or human silhouettes; add fake trucks; alter livery; change logo; invent or animate text; change words, line breaks, colors, or CTA; add captions, QR codes, watermarks, camera shake, rapid cuts, flicker, morphing, warped type, or a changing background.`;

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

async function upload(base, key, relativePath, index) {
  const source = sharp(path.join(ROOT, relativePath)).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true });
  const isPng = path.extname(relativePath).toLowerCase() === '.png';
  const body = await (isPng ? source.png({ compressionLevel: 9 }) : source.jpeg({ quality: 88, mozjpeg: true })).toBuffer();
  const response = await fetch(`${base}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': isPng ? 'image/png' : 'image/jpeg', 'x-filename': `push-driver-ref-${index + 1}${isPng ? '.png' : '.jpg'}` },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.url) throw new Error(`Upload ${index + 1} failed: HTTP ${response.status}`);
  return json.url;
}

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || 'https://motionboards.vercel.app').replace(/\/$/, '');
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error('Missing MotionBoards API key.');
  if (Buffer.byteLength(PROMPT, 'utf8') > 2000) throw new Error('Seedance prompt exceeds 2000 bytes.');
  console.log(`Seedance prompt: ${Buffer.byteLength(PROMPT, 'utf8')} bytes`);
  const inputImages = [];
  for (let index = 0; index < REFS.length; index++) inputImages.push(await upload(base, key, REFS[index], index));

  const response = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages, generationOptions: OPTIONS }),
  });
  const job = await response.json().catch(() => ({}));
  if (!response.ok || !job.requestId || !job.generationId) throw new Error(`Seedance submit: HTTP ${response.status} ${JSON.stringify(job).slice(0, 300)}`);
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
  const destination = path.join(OUT, 'push-driver-three-card-seedance-face-free-15s.mp4');
  await fs.writeFile(destination, Buffer.from(await video.arrayBuffer()));
  console.log(`Saved ${destination}`);
}

await main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
