// Test: Veo 3.1 "Ingredients" (multi reference-image) directly via Gemini API.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const REFDIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-refs");
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
async function imgPart(file) {
  const buf = await sharp(file).resize({ width: 1080, height: 1920, fit: "inside" }).jpeg({ quality: 90 }).toBuffer();
  return { image: { imageBytes: buf.toString("base64"), mimeType: "image/jpeg" }, referenceType: "ASSET" };
}

async function main() {
  await loadEnv();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const refs = [
    await imgPart(path.join(REFDIR, "girl-01.png")),
    await imgPart(path.join(REFDIR, "studio-01-wide.png")),
    await imgPart(path.join(REFDIR, "studio-02-side.png")),
  ];
  const prompt = `The young Malaysian-Chinese woman from the reference stands in the real car-wrap detailing studio from the references, on the red-accent floor, smiling and gesturing warmly toward the colourful vinyl wrap rolls on the wall as she presents to the camera. Friendly upbeat female voice speaking casually; quiet studio room tone. Smooth steady camera slowly pushing in. Photoreal, candid, no text overlays.`;

  for (const model of ["veo-3.1-fast-generate-preview", "veo-3.1-generate-preview"]) {
    try {
      process.stdout.write(`[${model}] starting... `);
      let op = await ai.models.generateVideos({
        model,
        prompt,
        config: { referenceImages: refs, aspectRatio: "9:16", numberOfVideos: 1 },
      });
      process.stdout.write("polling");
      let n = 0;
      while (!op.done && n < 40) {
        await new Promise((r) => setTimeout(r, 8000));
        process.stdout.write(".");
        op = await ai.operations.getVideosOperation({ operation: op });
        n++;
      }
      if (!op.done) { console.log(" timeout"); continue; }
      const vids = op.response?.generatedVideos || [];
      if (!vids.length) { console.log(` no video. resp=${JSON.stringify(op.response).slice(0,200)}`); continue; }
      const file = vids[0].video;
      const outPath = path.join(OUT, `wrap-ingredients-${model.includes("fast") ? "fast" : "pro"}.mp4`);
      await ai.files.download({ file, downloadPath: outPath });
      console.log(` SAVED ${path.relative(ROOT, outPath)}`);
      return;
    } catch (e) {
      console.log(` ERROR: ${(e && e.message ? e.message : String(e)).slice(0, 240)}`);
    }
  }
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
