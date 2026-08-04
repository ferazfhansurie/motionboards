import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GoogleGenAI } from "@google/genai";

const exec = promisify(execFile);
const ROOT = "/Users/faeez/motionboards";
const OUT_DIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");
const OPENING = path.join(OUT_DIR, "hyperwrapz-ppf-google-omni-opening.mp4");
const FRAME = path.join(OUT_DIR, "_hyperwrapz-omni-continuation-frame.jpg");
const CLOSE = path.join(OUT_DIR, "_hyperwrapz-omni-close.mp4");
const FINAL = path.join(OUT_DIR, "hyperwrapz-ppf-google-omni-15s.mp4");
const PROMPT = `Continue the same generic adult Malaysian male presenter, the same black Myvi BNM 5566, and the same red-and-black Hyperwrapz workshop in a photoreal vertical 9:16 sales video. He wears a plain, completely unbranded black polo with no readable writing. He continues speaking clearly in the same firm, natural adult Kuala Lumpur/Klang Valley salesperson style: "Bawah tiga ribu lima guys. promo ni tak lama. maintain condition, maintain value. WhatsApp Hyperwrapz sekarang". He makes a confident open-palm price gesture, then the camera makes a short realistic glide across the glossy bonnet reflections, then returns as he makes a small WhatsApp/call gesture and ends with direct eye contact. Natural lip-sync, quiet detailing-shop ambience, subtle music under the voice. No captions, subtitles, price text, extra people, fabricated logos, ESP branding, changing face, changing car, changing plate, jitter, warped hands or fake text.`;

async function loadEnv() { const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8"); for (const line of raw.split(/\r?\n/)) { const found = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (found && !(found[1] in process.env)) process.env[found[1]] = found[2].replace(/^["']|["']$/g, ""); } }
async function main() {
  await loadEnv(); await exec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-sseof", "-0.1", "-i", OPENING, "-frames:v", "1", FRAME]);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const image = await fs.readFile(FRAME);
  const interaction = await ai.interactions.create({ model: "gemini-omni-flash-preview", input: [{ type: "image", data: image.toString("base64"), mime_type: "image/jpeg" }, { type: "text", text: PROMPT }], background: false, store: true, response_format: { type: "video", aspect_ratio: "9:16", duration: "8s", delivery: "uri" } });
  const video = interaction.output_video;
  if (!video?.data && !video?.uri) throw new Error("Google Omni returned no continuation");
  if (video.data) await fs.writeFile(CLOSE, Buffer.from(video.data, "base64")); else await ai.files.download({ file: video, downloadPath: CLOSE });
  const list = path.join(OUT_DIR, "_hyperwrapz-omni-concat.txt");
  await fs.writeFile(list, `file '${OPENING}'\nfile '${CLOSE}'\n`);
  // Remove the model's fabricated chest badge with a soft, small inpaint-like blur.
  await exec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-t", "15", "-vf", "delogo=x=500:y=425:w=155:h=125:show=0", "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", FINAL]);
  console.log(`SAVED ${FINAL}`);
}
main().catch((error) => { console.error(`FATAL: ${error.message}`); process.exitCode = 1; });
