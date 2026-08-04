/** Mural-first, seam-locked carousel rebuild with Nano Banana 2. */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "FatHopes IMG", "push-carousel-identify-collector-mural-v3");
const asset = (...p) => path.join(ROOT, ...p);
const refs = {
  logo: asset("FatHopes IMG", "poster-refs", "LOGO-mark.png"),
  cctv: asset("FatHopes IMG", "push-carousel-kenal-push-betul-BOARD", "thief.jpeg"),
  front: asset("FatHopes IMG", "drive-download-20260627T093124Z-3-001", "PUX09986.JPG"),
  back: asset("FatHopes IMG", "drive-download-20260627T093938Z-3-001", "PUX08646.JPG"),
  login: asset("FatHopes IMG", "poster-refs", "login.jpeg"),
  home: asset("FatHopes IMG", "poster-refs", "home.jpeg"),
  qr: asset("FatHopes IMG", "poster-refs", "qr code.jpeg"),
  tanker: asset("FatHopes IMG", "push-people", "PUX02644.JPG"),
};
const shared = `Create ONE vertical 4:5 Facebook/Instagram carousel panel, not a board, collage, contact sheet or presentation. This panel belongs to one continuous seven-panel FatHopes Energy PUSH collector-verification mural. The visual world is a premium cinematic night-time industrial FatHopes depot: deep forest-green steel walls, lime safety rails, soft teal haze, practical overhead industrial lights, strong depth and realistic photo composites. It is NOT a new location.

The one non-negotiable continuity device is a single thick fluorescent-lime physical route cable/light-trail. It must enter the panel from the LEFT edge and exit through the RIGHT edge at the exact specified heights. It is one real continuous cable with one scan glow—not arrows, ribbons, scribbles or duplicate lines. Match the same scale, lime colour and depot lighting. Bold white condensed uppercase editorial typography only; minimal copy. Use the official supplied FatHopes logo exactly when a logo is requested. No invented logos, no gibberish, no tiny text, no post-its, no paper, no Polaroids, no comic look, no generic app UI, no extra people, no watermark.`;
const slides = [
  { id: "01-identify", files: ["logo", "cctv"], p: `REFERENCE 1 is the official FatHopes Energy logo. REFERENCE 2 is anonymous CCTV context only: fully blur all faces. This opening is the EXCEPTION: its entire background is a deep forest-green gradient built only around one huge faint, authentic FatHopes Energy logo mark; do not show the depot in this slide. The route grows from the logo mark and exits lower-right at 72% height. Use one angled CCTV evidence inset in the lower half, integrated into the route. TEXT EXACTLY, large and readable: IDENTIFY FATHOPES ENERGY PUSH COLLECTOR / NOT PUSH / CHECK BEFORE YOU COLLECT.` },
  { id: "02-uniform-front", files: ["front", "logo"], p: `REFERENCE 1 is the real FatHopes official polo and collector. REFERENCE 2 is the official logo. Enter the route lower-left at 72% height; exit centre-right at 57% height. The same depot begins here, as if the cable has entered the building. Show the real collector front-facing on the right, chest logo large and faithful. The route makes one scanner pass across the chest then continues out. TEXT EXACTLY: STEP 1 / UNIFORM / OFFICIAL POLO.` },
  { id: "03-uniform-back", files: ["back", "logo"], p: `REFERENCE 1 is the same real FatHopes collector from behind; preserve the back print faithfully. REFERENCE 2 is official logo. Enter centre-left at 57% height; exit lower-right at 66% height. The collector has turned around inside the same uninterrupted depot, with the route passing behind his shoulder and scanning the back wording. TEXT EXACTLY: STEP 1 / UNIFORM BACK / CHECK THE BACK PRINT.` },
  { id: "04-vendor-app", files: ["login", "home", "qr", "logo"], p: `REFERENCES 1-3 are the exact real FatHopes Vendor App screens; REFERENCE 4 is official logo. Enter lower-left at 66% height; exit centre-right at 59% height. In the exact same depot, the physical route powers a layered but restrained set of three real phone screens, QR nearest. One realistic lime scan pulse beside—not over—the QR. TEXT EXACTLY: STEP 2 / VENDOR APP / NO APP = RED FLAG.` },
  { id: "05-mini-tanker", files: ["tanker", "logo"], p: `REFERENCE 1 is the real FatHopes mini tanker. REFERENCE 2 is official logo. Enter centre-left at 59% height; exit lower-right at 73% height. The route becomes one luminous wheel-level light trail as the genuine mini tanker drives into the same depot bay from left toward right. Preserve the actual branded tanker, no redesigned vehicle. TEXT EXACTLY: STEP 3 / MINI TANKER / NOT A NORMAL VAN OR CAR.` },
  { id: "06-verified", files: ["qr", "home", "logo"], p: `REFERENCES 1-2 are exact real FatHopes app screens; REFERENCE 3 is official logo. Enter lower-left at 73% height; exit centre-right at 54% height. The exact same route leads into a real QR verification scan with the home screen behind it. Make the scan glow turn solid green only after successful verification. TEXT EXACTLY: STEP 4 / GET VERIFIED / CHECK FIRST.` },
  { id: "07-case-closed", files: ["front", "qr", "tanker", "logo"], p: `REFERENCES are real official polo, app, mini tanker and official logo. Enter centre-left at 54% height and resolve the same route in the lower-right corner, no exit. The final scene is the same depot, with the uniform as hero and tiny app/tanker depth layers. TEXT EXACTLY: CASE CLOSED / OFFICIAL POLO / VENDOR APP / MINI TANKER / VERIFIED IN APP / COLLECT WITH CONFIDENCE.` },
];
async function env() { const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8"); for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } }
async function inline(file) { const data = await sharp(file).rotate().resize({ width: 1200, height: 1500, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(); return { inlineData: { mimeType: "image/jpeg", data: data.toString("base64") } }; }
async function main() {
  await env(); await fs.mkdir(OUT, { recursive: true }); const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  for (const slide of slides) {
    console.log(`Generating ${slide.id}...`);
    const contents = [{ text: `${shared}\n\n${slide.p}` }, ...await Promise.all(slide.files.map((name) => inline(refs[name])))];
    const response = await ai.models.generateContent({ model: "gemini-3.1-flash-image-preview", contents, config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5", imageSize: "2K" } } });
    const part = response.candidates?.[0]?.content?.parts?.find((x) => x.inlineData)?.inlineData;
    if (!part?.data) throw new Error(`${slide.id}: Nano Banana 2 returned no image`);
    await fs.writeFile(path.join(OUT, `${slide.id}.png`), Buffer.from(part.data, "base64"));
  }
  const frames = await Promise.all(slides.map(async (slide) => ({ input: await sharp(path.join(OUT, `${slide.id}.png`)).resize({ width: 432 }).png().toBuffer() })));
  const meta = await sharp(frames[0].input).metadata();
  await sharp({ create: { width: 432 * frames.length, height: meta.height, channels: 4, background: "#061c15" } }).composite(frames.map((frame, i) => ({ ...frame, left: 432 * i, top: 0 }))).png().toFile(path.join(OUT, "_mural-review.png"));
  console.log(`SAVED ${OUT}`);
}
main().catch((error) => { console.error(`FATAL: ${error.message}`); process.exitCode = 1; });
