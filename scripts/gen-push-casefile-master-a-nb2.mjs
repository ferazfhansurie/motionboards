import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "FatHopes IMG", "push-carousel-identify-collector-casefile-v4");
const file = (...parts) => path.join(ROOT, ...parts);

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

async function asInline(imagePath) {
  const data = await sharp(imagePath).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  return { inlineData: { mimeType: "image/jpeg", data: data.toString("base64") } };
}

async function main() {
  await loadEnv();
  await fs.mkdir(OUT, { recursive: true });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const refs = [
    file("FatHopes IMG", "poster-refs", "LOGO-mark.png"),
    file("FatHopes IMG", "push-carousel-kenal-push-betul-BOARD", "thief.jpeg"),
    file("FatHopes IMG", "drive-download-20260627T093124Z-3-001", "PUX09986.JPG"),
    file("FatHopes IMG", "drive-download-20260627T093938Z-3-001", "PUX08646.JPG"),
  ];
  const prompt = `Use case: ads-marketing. Create ONE seamless ultra-wide 21:9 master artwork that is intentionally designed to be cropped into THREE equal vertical 4:5 Instagram/Facebook carousel cards. It is one continuous premium PUSH COLLECTOR IDENTITY case file, not three separate posters and not three unrelated scenes. The visual system must cross each crop boundary exactly: continuous deep charcoal and forest-green evidence-dossier background, thin lime case-file rail passing horizontally at the same height, consistent paper grain, tiny non-legible serial marks only, same margins and lighting.

REFERENCE ROLES: Image 1 is the official FatHopes Energy logo; reproduce it only as a subtle oversized watermark in CARD ONE background, never invent or alter the logo. Image 2 is the exact real non-PUSH collection photo; place it as a clipped evidence photo in CARD ONE, preserve the person and crop. Image 3 is the real official front polo photo; use it in CARD TWO as a clean evidence portrait. Image 4 is the real official back polo photo; use it in CARD THREE as a clean evidence portrait. Preserve real clothing markings from the photos; do not add chest logos, made-up badges or extra people.

CARD ONE (left third): minimal logo-only background, no warehouse or photo scene. Huge subtle official logo watermark. Headline, exact and legible: “IDENTIFY A REAL PUSH COLLECTOR”. A tilted clipped evidence image using Image 2 with a strong stamped label: “NOT PUSH”. Bottom label: “CHECK BEFORE YOU COLLECT”.

CARD TWO (middle third): same case-file world, use Image 3. Large exact labels: “STEP 1” / “UNIFORM” / “OFFICIAL POLO”. A lime verification tag points only to the real chest mark.

CARD THREE (right third): use Image 4. Large exact labels: “STEP 2” / “CHECK THE BACK PRINT”. A lime verification tag points to the real back print.

Style: Apple-like editorial security briefing, deep tactile layered paper, photographic evidence mounted with subtle shadow, premium controlled lime accents, serious but clear. No fake warehouse panorama, no looping neon cable, no repeated title, no dense copy, no QR code, no app UI, no watermarks other than the official logo in card one, no gibberish text. Keep all listed text very large and clean.`;
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: [{ text: prompt }, ...await Promise.all(refs.map(asInline))],
    config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "21:9", imageSize: "2K" } },
  });
  const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData?.data;
  if (!data) throw new Error("Nano Banana 2 returned no image.");
  const master = path.join(OUT, "master-a-01-03.png");
  await fs.writeFile(master, Buffer.from(data, "base64"));
  const source = sharp(master);
  const meta = await source.metadata();
  const panelW = Math.round(meta.height * 0.8);
  const totalW = panelW * 3;
  const padded = await source.extend({ left: 0, right: Math.max(0, totalW - meta.width), top: 0, bottom: 0, background: "#082217" }).png().toBuffer();
  for (let index = 0; index < 3; index += 1) {
    await sharp(padded).extract({ left: index * panelW, top: 0, width: panelW, height: meta.height }).png().toFile(path.join(OUT, `0${index + 1}-casefile.png`));
  }
  await sharp(padded).extract({ left: 0, top: 0, width: totalW, height: meta.height }).png().toFile(path.join(OUT, "_master-a-crop-review.png"));
}

main().catch((error) => { console.error(`FATAL: ${error.message}`); process.exitCode = 1; });
