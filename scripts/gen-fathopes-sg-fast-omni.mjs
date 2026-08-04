import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = '/Users/faeez/motionboards';
const MODEL = 'dreamina-seedance-2-0-fast-260128/omni';
const OUT = path.join(ROOT, 'FatHopes IMG', 'SG photossss', 'seedance-output');
const PROMPT_FILE = process.env.PROMPT_FILE || path.join(ROOT, 'pushlife', 'fathopes-sg-seedance-fast-omni.txt');
const OUTPUT_NAME = process.env.OUTPUT_NAME || 'fathopes-sg-fast-omni-used-oil-15s.mp4';
const REFS = [
  'FatHopes IMG/SG photossss/seedance-reference-frames/01-shirt-brand-lock.jpg',
  'FatHopes IMG/SG photossss/seedance-reference-frames/02-used-oil-pumping.jpg',
  'FatHopes IMG/SG photossss/seedance-reference-frames/03-singapore-oil-storage.jpg',
  'FatHopes IMG/fathopes logo.png',
];

function envFromFile(raw) {
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

async function loadEnv() {
  for (const name of ['env.local', '.env.local']) {
    try { envFromFile(await fs.readFile(path.join(ROOT, name), 'utf8')); } catch {}
  }
}

async function upload(base, key, relativePath, index) {
  const ext = path.extname(relativePath).toLowerCase() === '.png' ? '.png' : '.jpg';
  const body = await sharp(path.join(ROOT, relativePath))
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    [ext === '.png' ? 'png' : 'jpeg'](ext === '.png' ? { compressionLevel: 9 } : { quality: 90, mozjpeg: true })
    .toBuffer();
  const response = await fetch(`${base}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': ext === '.png' ? 'image/png' : 'image/jpeg', 'x-filename': `fathopes-sg-ref-${index + 1}${ext}` },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.url) throw new Error(`Reference ${index + 1} upload failed: ${response.status} ${JSON.stringify(json)}`);
  return json.url;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || 'https://motionboards.vercel.app').replace(/\/$/, '');
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error('Missing MotionBoards API key.');

  const raw = await fs.readFile(PROMPT_FILE, 'utf8');
  const prompt = raw.split(/^PROMPT\s*$/m)[1]?.trim();
  if (!prompt) throw new Error('PROMPT section is missing.');
  if (Buffer.byteLength(prompt, 'utf8') > 2000) throw new Error('Seedance prompt exceeds the 2,000-character limit.');
  console.log(`Prompt: ${Buffer.byteLength(prompt, 'utf8')} bytes`);

  const inputImages = [];
  for (let index = 0; index < REFS.length; index++) {
    inputImages.push(await upload(base, key, REFS[index], index));
    console.log(`Uploaded Image${index + 1}`);
  }

  const submit = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      inputImages,
      generationOptions: { aspect_ratio: '9:16', resolution: '720p', duration: '15s', generate_audio: true },
    }),
  });
  const job = await submit.json().catch(() => ({}));
  if (!submit.ok || !job.requestId || !job.generationId) throw new Error(`Seedance submission failed: ${submit.status} ${JSON.stringify(job)}`);
  console.log(`Submitted request=${job.requestId} generation=${job.generationId}`);

  const query = new URLSearchParams({ requestId: job.requestId, modelId: MODEL, generationId: job.generationId, byteplusVideo: 'true', durationSec: '15', resolution: '720p' });
  let outputUrl = '';
  for (let attempt = 1; attempt <= 120; attempt++) {
    await sleep(5000);
    const response = await fetch(`${base}/api/generate/status?${query}`, { headers: { Authorization: `Bearer ${key}` } });
    const status = await response.json().catch(() => ({}));
    if (status.status === 'completed' && status.outputUrl) { outputUrl = status.outputUrl; break; }
    if (status.status === 'failed') throw new Error(status.error || 'Seedance generation failed.');
    if (attempt % 6 === 0) console.log(`${attempt * 5}s: ${status.status || 'processing'}`);
  }
  if (!outputUrl) throw new Error('Seedance generation timed out after 10 minutes.');

  const video = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  if (!video.ok) throw new Error(`Unable to download generated video: ${video.status}`);
  await fs.mkdir(OUT, { recursive: true });
  const destination = path.join(OUT, OUTPUT_NAME);
  await fs.writeFile(destination, Buffer.from(await video.arrayBuffer()));
  console.log(`Saved ${destination}`);
}

await main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
