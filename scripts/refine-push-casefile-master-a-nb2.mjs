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
async function inline(p) { const b = await sharp(p).rotate().resize({ width: 1600, height: 1000, fit: "inside" }).jpeg({ quality: 92 }).toBuffer(); return { inlineData: { mimeType: "image/jpeg", data: b.toString("base64") } }; }

async function main() {
  await loadEnv();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: [{ text: `Edit Image 1 only. It is a single 21:9 master artwork for three contiguous 4:5 carousel cards. Preserve its exact wide case-file layout, the three-panel crop positions, the continuous thin lime rail at the same height, the matte charcoal/forest-green textured background, the large logo watermark on the first panel only, the tilted NOT PUSH evidence photo, and the real front/back uniform photographs. Do NOT add or change people, logos or photos.

Remove every small lime callout box, tiny annotation, tiny serial text and all tiny connector labels—there must be no garbled small words anywhere. Keep only clean, oversized, high-legibility text. Ensure the third-card headline fits fully in its card and says exactly: “STEP 2” then “CHECK BACK PRINT”. The middle-card text says exactly: “STEP 1” then “UNIFORM” then “OFFICIAL POLO”. Keep the first-card text exact: “IDENTIFY A REAL PUSH COLLECTOR”, stamped “NOT PUSH”, and “CHECK BEFORE YOU COLLECT”. Do not add any other readable text. The outcome must remain one seamless horizontal master, not three separate posters.` }, await inline(path.join(OUT, "master-a-01-03.png"))],
    config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "21:9", imageSize: "2K" } },
  });
  const data = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!data) throw Error("No refinement image returned.");
  const master = path.join(OUT, "master-a-01-03-refined.png");
  await fs.writeFile(master, Buffer.from(data, "base64"));
  const image = sharp(master); const meta = await image.metadata(); const panelW = Math.round(meta.height * 0.8); const totalW = panelW * 3;
  const padded = await image.extend({ left: 0, right: Math.max(0, totalW - meta.width), top: 0, bottom: 0, background: "#082217" }).png().toBuffer();
  for (let i = 0; i < 3; i++) await sharp(padded).extract({ left: i * panelW, top: 0, width: panelW, height: meta.height }).png().toFile(path.join(OUT, `0${i + 1}-casefile-refined.png`));
  await sharp(padded).extract({ left: 0, top: 0, width: totalW, height: meta.height }).png().toFile(path.join(OUT, "_master-a-refined-review.png"));
}
main().catch((error) => { console.error(`FATAL: ${error.message}`); process.exitCode = 1; });
