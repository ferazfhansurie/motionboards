/**
 * One 15-second Hyperwrapz PPF advert, generated natively with Veo 3.1 Fast.
 * Veo creates the eight-second reference-led opening and then extends that
 * same Veo asset by seven seconds.  The extension response is one continuous
 * 15-second video, not an edited/stiched pair of clips.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");
const FACE = path.join(ROOT, "public", "ESP", "_gen", "presenter-frames", "esp-presenter-01.jpg");
const CAR_AND_SHOP = path.join(ROOT, "Hyperwrapz & Detailing", "myvi.jpeg");
const LOGO = path.join(ROOT, "Hyperwrapz & Detailing", "file_1784542697071_030875c0424f.jpeg");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const hit = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (hit && !(hit[1] in process.env)) process.env[hit[1]] = hit[2].replace(/^["']|["']$/g, "");
  }
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing from env.local");
}

async function reference(file, crop) {
  let pipeline = sharp(file).rotate();
  if (crop) pipeline = pipeline.extract(crop);
  const bytes = await pipeline.resize({ width: 1080, height: 1920, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  return { image: { imageBytes: bytes.toString("base64"), mimeType: "image/jpeg" }, referenceType: "ASSET" };
}

async function waitForVideo(ai, operation, label) {
  let current = operation;
  for (let i = 0; !current.done && i < 55; i++) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    process.stdout.write(`${label}.`);
    current = await ai.operations.getVideosOperation({ operation: current });
  }
  process.stdout.write("\n");
  if (!current.done) throw new Error(`${label} timed out while Veo was rendering`);
  if (current.error) throw new Error(`${label}: ${JSON.stringify(current.error)}`);
  const video = current.response?.generatedVideos?.[0]?.video;
  if (!video) throw new Error(`${label}: no video returned: ${JSON.stringify(current.response)}`);
  return video;
}

const OPENING_PROMPT = `Create a premium, photorealistic vertical 9:16 Hyperwrapz & Detailing PPF advert. This is the opening half of ONE continuous commercial; the exact same presenter, black compact hatchback, shop lighting and wardrobe must continue into the next beat.

Reference roles: Reference 1 locks the adult Malaysian man\'s facial identity only: same face, hairline, skin tone and build. Replace all original clothing/branding with a fitted plain charcoal polo, NO logo. Reference 2 locks the actual Hyperwrapz detailing studio and black hatchback: same red-and-black interlocking floor, dark walls, detailing equipment, bright ceiling strips and vehicle proportions. Reference 3 is the official Hyperwrapz & Detailing logo, to appear only as a small clean end-card badge later; never redraw or put it on clothing.

The confident adult presenter is beside the black hatchback\'s front bumper inside the real studio. He faces camera and speaks precisely, loudly and naturally in an adult Kuala Lumpur/Klang Valley sales tone. First line only in this opening: "Kereta baru tu bukan murah, jangan sampai dia tercalar guys!" He taps the bonnet once, then smoothly holds a transparent PPF sheet above the paint as the camera makes a subtle handheld commercial push-in. Use natural showroom ambience and a very subtle energetic music bed under a clear human voice. Strong but not rushed; leave a tiny natural pause after the line.

No captions, subtitles, price cards, numbers, floating text or fake signage. No ESP branding, no Faeez, no extra people. Keep his face stable, lips accurately synced to the exact Malay-English words, hands anatomically correct, car and shop locked with zero background morphing or jitter.`;

const EXTENSION_PROMPT = `Continue the EXACT same 9:16 Hyperwrapz & Detailing PPF commercial seamlessly from the final frame. Maintain the same adult Malaysian presenter\'s face, same plain charcoal polo without logos, same black hatchback and unchanged studio. Continue his speech exactly with this remaining dialogue, in the same firm, clear, adult Kuala Lumpur/Klang Valley salesperson delivery:
"Buat seven point five mil Full car PPF dengan harga promo murah. Bawah tiga ribu lima guys. promo ni tak lama. maintain condition, maintain value. WhatsApp Hyperwrapz sekarang"

On "seven point five mil Full car PPF", he lays the transparent PPF sheet cleanly onto the bonnet edge. On "Bawah tiga ribu lima", he gives one clear open-palm price gesture beside the car, with NO visible text or numbers. On "maintain condition, maintain value", use a close, believable gliding reflection over the protected black paint and return immediately to him. On "WhatsApp Hyperwrapz sekarang", he gives a compact WhatsApp/call hand gesture and ends confidently facing camera. Finish with a short, clean hold; only then show the exact supplied Hyperwrapz logo small and sharp in a bottom corner. Keep the music bed low enough that every word is intelligible.

Do not add captions, subtitles, any price text, altered brand names, distorted logos, facial drift, robotic/rushed voice, awkward pauses, extra people, car changes, flickering background, morphing tools, warped hands, or cutaway stock footage.`;

async function main() {
  await loadEnv();
  await fs.mkdir(OUT, { recursive: true });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  // Keep only the face from the source video. This deliberately excludes its
  // old shop, polo and every old logo so Veo cannot carry those into Hyperwrapz.
  const refs = await Promise.all([
    reference(FACE, { left: 205, top: 300, width: 315, height: 315 }),
    reference(CAR_AND_SHOP),
    reference(LOGO),
  ]);

  console.log("Starting Veo 3.1 Fast opening...");
  let op = await ai.models.generateVideos({
    model: "veo-3.1-fast-generate-preview",
    prompt: OPENING_PROMPT,
    config: { referenceImages: refs, aspectRatio: "9:16", durationSeconds: 8, resolution: "720p", numberOfVideos: 1, personGeneration: "allow_adult" },
  });
  const opening = await waitForVideo(ai, op, "opening");

  console.log("Extending the same Veo asset by seven seconds...");
  op = await ai.models.generateVideos({
    model: "veo-3.1-fast-generate-preview",
    video: opening,
    prompt: EXTENSION_PROMPT,
    config: { aspectRatio: "9:16", durationSeconds: 8, resolution: "720p", numberOfVideos: 1, personGeneration: "allow_all" },
  });
  const fullVideo = await waitForVideo(ai, op, "extension");
  const output = path.join(OUT, "hyperwrapz-ppf-7_5mil-full-car-15s-veo31.mp4");
  await ai.files.download({ file: fullVideo, downloadPath: output });
  console.log(`SAVED ${output}`);
}

main().catch((error) => { console.error(`FATAL: ${error.message}`); process.exitCode = 1; });
