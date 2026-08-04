/** Google Omni Flash: 8s opening + 8s continuation, trimmed to a 15s final. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ROOT = "/Users/faeez/motionboards";
const MASTER = "/Users/faeez/Downloads/ssssss.png";
const OUT_DIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");
const OUT = path.join(OUT_DIR, "hyperwrapz-ppf-google-omni-15s.mp4");
const CLIP_1 = path.join(OUT_DIR, "_hyperwrapz-omni-part-01.mp4");
const CLIP_2 = path.join(OUT_DIR, "_hyperwrapz-omni-part-02.mp4");
const LAST_FRAME = path.join(OUT_DIR, "_hyperwrapz-omni-part-01-last-frame.jpg");

const OPENING = `Use the supplied image as the exact master frame. Preserve the same generic adult Malaysian male presenter, black Myvi BNM 5566, red-and-black detailing floor, fluorescent ceiling lights, dark workshop walls and wrap-roll racks. The presenter is not Faeez and must not resemble any known person. Create a photorealistic 9:16 Hyperwrapz PPF commercial. In one seamless confident shot, he speaks clearly in an adult Kuala Lumpur/Klang Valley salesperson style, firm but natural and never rushed: "Kereta baru tu bukan murah, jangan sampai dia tercalar guys! Buat seven point five mil Full car PPF dengan harga promo murah." He points to the bonnet on "tercalar" and demonstrates a transparent PPF sheet over the black paint on "seven point five mil Full car PPF". Natural lipsync, realistic hands, glossy paint reflections, quiet workshop ambience and subtle music low under voice. No captions, subtitles, price text, extra people, ESP branding, face drift, car changes, plate changes, flickering background, warped hands, or distorted logos.`;

const CLOSE = `Continue directly from this exact final frame. Keep the same generic adult Malaysian male presenter, same face, same black polo, same black Myvi BNM 5566 and unchanged Hyperwrapz detailing shop. He finishes the same PPF sales conversation in a firm, clear adult Kuala Lumpur/Klang Valley salesperson delivery, natural pace: "Bawah tiga ribu lima guys. promo ni tak lama. maintain condition, maintain value. WhatsApp Hyperwrapz sekarang". On "Bawah tiga ribu lima" he makes one confident open-palm price gesture. On "maintain condition, maintain value" the camera glides briefly across the glossy protected bonnet reflection then returns to his face. On "WhatsApp Hyperwrapz sekarang" he makes a compact phone/WhatsApp gesture and holds a confident direct look. Keep music low beneath the voice and workshop ambience natural. No captions, subtitles, text cards, price numbers, extra people, logo distortion, ESP branding, face changes, car changes, background jitter, warped PPF film or distorted hands.`;

async function loadEnv() {
  for (const file of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, file), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const hit = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (hit && !(hit[1] in process.env)) process.env[hit[1]] = hit[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}

async function upload(base, key, file, label) {
  const data = await fs.readFile(file);
  const type = file.endsWith(".png") ? "image/png" : "image/jpeg";
  const response = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": type, "x-filename": label }, body: data });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.url) throw new Error(`upload failed ${response.status}: ${JSON.stringify(json)}`);
  return json.url;
}

async function generate(base, key, inputImage, prompt, label) {
  console.log(`Submitting ${label}...`);
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemini-omni-flash-preview/i2v", prompt, inputImage, generationOptions: { aspect_ratio: "9:16", resolution: "720p", duration: "8s", generate_audio: true } }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.outputUrl) throw new Error(`${label} failed ${response.status}: ${JSON.stringify(json)}`);
  const video = await fetch(json.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  if (!video.ok) throw new Error(`${label} download failed ${video.status}`);
  return Buffer.from(await video.arrayBuffer());
}

async function main() {
  await loadEnv();
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  if (!key) throw new Error("Missing MotionBoards API key");
  await fs.mkdir(OUT_DIR, { recursive: true });

  const masterUrl = await upload(base, key, MASTER, "hyperwrapz-generic-presenter-master.png");
  await fs.writeFile(CLIP_1, await generate(base, key, masterUrl, OPENING, "opening"));
  await exec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-sseof", "-0.15", "-i", CLIP_1, "-frames:v", "1", LAST_FRAME]);
  const lastFrameUrl = await upload(base, key, LAST_FRAME, "hyperwrapz-generic-presenter-continuation.jpg");
  await fs.writeFile(CLIP_2, await generate(base, key, lastFrameUrl, CLOSE, "continuation"));
  const list = path.join(OUT_DIR, "_hyperwrapz-omni-concat.txt");
  await fs.writeFile(list, `file '${CLIP_1}'\nfile '${CLIP_2}'\n`);
  await exec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-t", "15", "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", OUT]);
  console.log(`SAVED ${OUT}`);
}

main().catch((error) => { console.error(`FATAL: ${error.message}`); process.exitCode = 1; });
