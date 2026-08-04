import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "FatHopes IMG", "push-carousel-identify-collector-casefile-v4", "final");
const file = (...p) => path.join(ROOT, ...p);
async function env() { const s = await fs.readFile(path.join(ROOT, "env.local"), "utf8"); for (const l of s.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } }
async function inline(p) { const b = await sharp(p).rotate().resize({ width: 1200, height: 1200, fit: "inside" }).jpeg({ quality: 90 }).toBuffer(); return { inlineData: { mimeType: "image/jpeg", data: b.toString("base64") } }; }
async function main() {
  await env(); const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const style = path.join(OUT, "06-verified.jpg");
  const tanker = file("FatHopes IMG", "push-people", "PUX02644.JPG");
  const r = await ai.models.generateContent({ model: "gemini-3.1-flash-image-preview", contents: [{ text: `Create ONE single vertical 4:5 text-free Instagram carousel closing card for FatHopes Energy PUSH. Image 1 is the previous carousel card: match only its deep forest-green case-file background, tactile paper texture, and horizontal lime evidence rail entering from the LEFT at mid-height. Image 2 is the real FatHopes mini tanker reference.

Build one calm “case closed” evidence flat-lay with ALL elements fully contained inside a wide 80-pixel safe margin. Nothing may touch or cross any canvas edge. Use a compact real mini-tanker evidence photo at upper-centre, a flat dark official polo with lanyard-ID at lower-left, a simple phone silhouette at lower-right, and a small tanker icon near it. Keep all objects 100% visible with generous breathing space. Do not put any words, letters, numerals, app UI text, logos, badge text or watermark into the image. Do not crop the truck, phone, polo, paper board or rail. This must be a single finished 4:5 card—not a segment of a wider mural.` }, await inline(style), await inline(tanker)], config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5", imageSize: "2K" } } });
  const data = r.candidates?.[0]?.content?.parts?.find((x) => x.inlineData)?.inlineData?.data; if (!data) throw Error("No image.");
  await fs.writeFile(path.join(OUT, "07-case-closed-art-safe.png"), Buffer.from(data, "base64"));
}
main().catch((e) => { console.error(`FATAL: ${e.message}`); process.exitCode = 1; });
