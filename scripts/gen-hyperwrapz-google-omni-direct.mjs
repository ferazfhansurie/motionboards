import { promises as fs } from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const IMAGE = "/Users/faeez/Downloads/ssssss.png";
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips", "hyperwrapz-ppf-google-omni-opening.mp4");
const PROMPT = `Use the supplied image as the exact master frame. Preserve the same generic adult Malaysian male presenter, black Myvi BNM 5566, red-and-black detailing floor, fluorescent ceiling lights, dark workshop walls and wrap-roll racks. The presenter is not Faeez and must not resemble any known person. His fitted black polo must be completely plain and blank: absolutely NO chest badge, writing, logo, flag, emblem or printed mark. Create a photorealistic vertical 9:16 Hyperwrapz PPF sales video. He addresses camera with firm but natural adult Kuala Lumpur/Klang Valley salesperson energy, not robotic or rushed. He points once to the bonnet while saying: "Kereta baru tu bukan murah, jangan sampai dia tercalar guys! Buat seven point five mil Full car PPF dengan harga promo murah." Then he holds a transparent PPF sheet over the glossy black paint. Natural Malay-English lip-sync, clear dialogue, quiet shop ambience, subtle music below the voice. No captions, subtitles, price text, extra people, ESP branding, face drift, changed car, changed plate, flicker, warped hands or any fabricated text or logo.`;

async function env() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const found = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (found && !(found[1] in process.env)) process.env[found[1]] = found[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  await env();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const image = await fs.readFile(IMAGE);
  const interaction = await ai.interactions.create({
    model: "gemini-omni-flash-preview",
    input: [
      { type: "image", data: image.toString("base64"), mime_type: "image/png" },
      { type: "text", text: PROMPT },
    ],
    background: false,
    store: true,
    response_format: { type: "video", aspect_ratio: "9:16", duration: "8s", delivery: "uri" },
  });
  const video = interaction.output_video;
  if (!video?.data && !video?.uri) throw new Error("Google Omni returned no video");
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  if (video.data) await fs.writeFile(OUT, Buffer.from(video.data, "base64"));
  else await ai.files.download({ file: video, downloadPath: OUT });
  console.log(`SAVED ${OUT}`);
}
main().catch((error) => { console.error(`FATAL: ${error.message}`); process.exitCode = 1; });
