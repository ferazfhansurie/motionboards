import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "FatHopes IMG", "push-carousel-identify-collector-casefile-v4", "final");
const asset = (...p) => path.join(ROOT, ...p);
process.env.FONTCONFIG_FILE = path.join(ROOT, "FatHopes IMG", "fonts", "fonts.conf");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
async function inline(p) {
  const b = await sharp(p).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  return { inlineData: { mimeType: "image/jpeg", data: b.toString("base64") } };
}
async function generate(ai, output, prompt, refs) {
  console.log(`Generating ${path.basename(output)}`);
  const r = await ai.models.generateContent({ model: "gemini-3.1-flash-image-preview", contents: [{ text: prompt }, ...await Promise.all(refs.map(inline))], config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "21:9", imageSize: "2K" } } });
  const data = r.candidates?.[0]?.content?.parts?.find((x) => x.inlineData)?.inlineData?.data;
  if (!data) throw Error(`No image returned for ${path.basename(output)}`);
  await fs.writeFile(output, Buffer.from(data, "base64"));
}
const escape = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
function overlay({ step, title, sub, stamp, mode = "standard" }) {
  const titleLines = title.split("\n");
  const isCase = mode === "case";
  const isCompact = mode === "compact";
  const titleSvg = titleLines.map((line, i) => `<text x="${isCase ? 66 : isCompact ? 66 : 84}" y="${isCase ? 160 + i * 104 : isCompact ? 300 + i * 92 : mode === "cover" ? 250 + i * 145 : 300 + i * 140}" class="${isCase ? "caseTitle" : isCompact ? "compactTitle" : "title"}">${escape(line)}</text>`).join("");
  const caseBox = isCase ? `<rect x="36" y="44" width="440" height="250" rx="28" fill="#09231a" fill-opacity=".96" stroke="#c8ec42" stroke-width="4"/>` : "";
  const compactBox = isCompact ? `<rect x="36" y="190" width="420" height="230" rx="24" fill="#09231a" fill-opacity=".97" stroke="#c8ec42" stroke-width="3"/>` : "";
  const titleBox = !isCase && !isCompact ? `<rect x="42" y="${mode === "cover" ? 88 : 190}" width="510" height="${mode === "cover" ? 350 : 310}" rx="24" fill="#09231a" fill-opacity=".94" stroke="#c8ec42" stroke-width="3"/>` : "";
  const stampSvg = stamp ? `<g transform="translate(84 760) rotate(-7)"><rect width="370" height="116" rx="10" fill="#d82020"/><text x="26" y="77" class="stamp">${escape(stamp)}</text></g>` : "";
  const stepSvg = step ? `<text x="84" y="170" class="step">${escape(step)}</text>` : "";
  return Buffer.from(`<svg width="864" height="1080" xmlns="http://www.w3.org/2000/svg"><style>
    .title{font-family:Montserrat,Arial,sans-serif;font-size:104px;font-weight:800;letter-spacing:-4px;fill:#f6f7f2;paint-order:stroke;stroke:#071a14;stroke-width:9px;stroke-linejoin:round}
    .caseTitle{font-family:Montserrat,Arial,sans-serif;font-size:78px;font-weight:800;letter-spacing:-3px;fill:#f6f7f2}
    .compactTitle{font-family:Montserrat,Arial,sans-serif;font-size:72px;font-weight:800;letter-spacing:-3px;fill:#f6f7f2}
    .step{font-family:Montserrat,Arial,sans-serif;font-size:38px;font-weight:800;letter-spacing:3px;fill:#c8ec42}
    .sub{font-family:Montserrat,Arial,sans-serif;font-size:34px;font-weight:700;letter-spacing:.2px;fill:#f6f7f2;paint-order:stroke;stroke:#071a14;stroke-width:5px;stroke-linejoin:round}
    .stamp{font-family:Montserrat,Arial,sans-serif;font-size:61px;font-weight:900;letter-spacing:1px;fill:#fff}
  </style>${caseBox}${compactBox}${titleBox}${stepSvg}${titleSvg}${sub ? `<text x="84" y="${mode === "cover" || isCase ? 990 : 950}" class="sub">${escape(sub)}</text>` : ""}${stampSvg}</svg>`);
}
function officialChestLockup() {
  return Buffer.from(`<svg width="92" height="30" xmlns="http://www.w3.org/2000/svg"><style>.name{font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:12px;fill:#fff}.energy{font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:4.5px;letter-spacing:2px;fill:#fff}</style><text x="28" y="14" class="name">FatHopes</text><text x="29" y="23" class="energy">ENERGY</text></svg>`);
}
async function cropMaster(master, indexes) {
  const image = sharp(master); const m = await image.metadata(); const w = Math.round(m.height * 0.8); const total = w * 3;
  const padded = await image.extend({ left: 0, right: Math.max(0, total - m.width), top: 0, bottom: 0, background: "#102c20" }).png().toBuffer();
  return Promise.all(indexes.map((idx) => sharp(padded).extract({ left: idx * w, top: 0, width: w, height: m.height }).resize(864, 1080).png().toBuffer()));
}
async function writeCard(name, background, copy) {
  await sharp(background).composite([{ input: overlay(copy), top: 0, left: 0 }]).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(OUT, name));
}
async function framedPhoto(photo, width, height) {
  const image = await sharp(photo).rotate().resize({ width, height, fit: "cover", position: "centre" }).jpeg({ quality: 94 }).toBuffer();
  return sharp({ create: { width: width + 22, height: height + 22, channels: 3, background: "#f5f0e7" } }).composite([{ input: image, left: 11, top: 11 }]).jpeg({ quality: 94 }).toBuffer();
}
function evidencePanel(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="26" fill="#0b2b20" stroke="#315f4b" stroke-width="4"/></svg>`);
}
async function main() {
  await loadEnv(); await fs.mkdir(OUT, { recursive: true });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const refs = {
    logo: asset("FatHopes IMG", "poster-refs", "LOGO-mark.png"),
    thief: asset("FatHopes IMG", "push-carousel-kenal-push-betul-BOARD", "thief.jpeg"),
    front: asset("FatHopes IMG", "drive-download-20260627T093124Z-3-001", "PUX09986.JPG"),
    back: asset("FatHopes IMG", "drive-download-20260627T093938Z-3-001", "PUX08646.JPG"),
    app: asset("FatHopes IMG", "poster-refs", "home.jpeg"),
    qr: asset("FatHopes IMG", "poster-refs", "qr code.jpeg"),
    tanker: asset("FatHopes IMG", "push-people", "PUX02644.JPG"),
  };
  const base = `Create ONE text-free, seamless 21:9 premium case-file mural intended to be split into THREE equal vertical 4:5 cards. It is an Apple-like editorial evidence dossier, not a warehouse panorama and not three separate posters. Use one continuous deep charcoal / forest-green textured background, a horizontal lime evidence rail at the exact same height across the entire width, consistent warm white paper frames, subtle shadows, and no readable text anywhere. No invented logos, badges, UI labels, people or writing. Preserve all supplied real photo markings exactly; do not alter official brand marks.`;
  const a = path.join(OUT, "master-a-art.png");
  const b = path.join(OUT, "master-b-art.png");
  const c = path.join(OUT, "master-c-art.png");
  if (!(await fs.stat(a).then(() => true).catch(() => false))) await generate(ai, a, `${base}\nLEFT CARD: only a very subtle oversized official FatHopes logo watermark in the background; a clipped real Image 2 as suspicious evidence with an empty red stamp-shaped area. MIDDLE CARD: feature Image 3, the real front uniform, in a clean upright evidence frame. RIGHT CARD: feature Image 4, the real back uniform, in a clean upright evidence frame. The evidence rail must pass behind all cards.`, [refs.logo, refs.thief, refs.front, refs.back]);
  if (!(await fs.stat(b).then(() => true).catch(() => false))) await generate(ai, b, `${base}\nUse Image 1 only for the shared visual language and match its right-hand background colour, lime evidence-rail height, paper-frame materials and shadow. LEFT CARD: show Image 2, a real FatHopes mobile-app screen, mounted in a clean evidence frame; leave spacious dark space for headline. MIDDLE CARD: show Image 3, real FatHopes mini tanker, in a clean evidence frame; leave spacious dark space for headline. RIGHT CARD: show Image 4 and Image 5 (real QR and app screen) arranged as verification evidence; leave spacious dark space for headline.`, [a, refs.app, refs.tanker, refs.qr, refs.app]);
  if (!(await fs.stat(c).then(() => true).catch(() => false))) await generate(ai, c, `${base}\nUse Image 1 only as a visual-style bridge: match its right-most background, paper and lime-rail height. Create a single case-closed resolution card in the LEFT THIRD using a calm flat-lay of real verification evidence: a blank official polo silhouette, a generic mini-tanker silhouette and a generic phone-screen silhouette, all connected by the lime rail. The other two thirds must be empty continuation background and rail only, because they will not be used.`, [b]);
  const [a1, a2, a3] = await cropMaster(a, [0, 1, 2]); const [b1, b2, b3] = await cropMaster(b, [0, 1, 2]); const [c1] = await cropMaster(c, [0]);
  // Sample the clean, textured charcoal from the right-hand mural background. This is
  // intentionally the same visual surface seen on the later cards, not a flat green fill.
  const rightSideBackground = await sharp(a).extract({ left: 650, top: 0, width: 300, height: 130 })
    .resize(864, 1080, { fit: "fill" }).modulate({ brightness: 0.8, saturation: 0.65 }).png().toBuffer();
  const thiefPhoto = await framedPhoto(refs.thief, 470, 330);
  const collectorPhoto = await framedPhoto(refs.front, 292, 565);
  const backPhoto = await framedPhoto(refs.back, 390, 560);
  // Slides 1–3 share one clean, uninterrupted case-file surface. They are intentionally
  // not nested cards, so the rail reads as a single mural when the carousel is swiped.
  const slide1Art = await sharp(rightSideBackground).composite([
    { input: { create: { width: 864, height: 18, channels: 3, background: "#c8ec42" } }, left: 0, top: 420 },
    { input: thiefPhoto, left: 62, top: 470 },
  ]).png().toBuffer();
  const slide2Art = await sharp(rightSideBackground).composite([
    { input: { create: { width: 864, height: 18, channels: 3, background: "#c8ec42" } }, left: 0, top: 420 },
    { input: collectorPhoto, left: 525, top: 250 },
  ]).png().toBuffer();
  const slide3Art = await sharp(rightSideBackground).composite([
    { input: { create: { width: 864, height: 18, channels: 3, background: "#c8ec42" } }, left: 0, top: 420 },
    { input: backPhoto, left: 420, top: 405 },
  ]).png().toBuffer();
  // The source mural has an unwanted green divider on the right edge of slide 6.
  // Replace it with the adjacent charcoal wall and continue the horizontal evidence rail.
  const slide6WallContinuation = await sharp(b3).extract({ left: 750, top: 0, width: 66, height: 1080 })
    .resize({ width: 48, height: 1080, fit: "fill" }).png().toBuffer();
  const slide6Art = await sharp(b3).composite([
    { input: slide6WallContinuation, left: 816, top: 0 },
  ]).png().toBuffer();
  const safeFinal = path.join(OUT, "07-case-closed-art-safe.png");
  const cFinal = await fs.stat(safeFinal).then(() => sharp(safeFinal).resize(864, 1080).png().toBuffer()).catch(() => c1);
  // Continue the exact same wall through the opening edge of the final card.
  const cSeamless = await sharp(cFinal).composite([{ input: slide6WallContinuation, left: 0, top: 0 }]).png().toBuffer();
  const paperBase = Buffer.from(`<svg width="380" height="375" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="378" height="373" rx="2" fill="#efe9e1" stroke="#d7cec4" stroke-width="2"/></svg>`);
  const poloCutout = await sharp(path.join(OUT, "black-polo-cutout-clean.png")).extract({ left: 460, top: 250, width: 1120, height: 1530 }).resize({ width: 270, height: 350, fit: "contain" }).png().toBuffer();
  const cClean = await sharp(cSeamless).composite([{ input: paperBase, left: 150, top: 552 }, { input: poloCutout, left: 172, top: 566 }]).png().toBuffer();
  const chestMark = await sharp(asset("FatHopes IMG", "poster-refs", "LOGO-mark.png")).resize({ width: 24, height: 24, fit: "contain" }).png().toBuffer();
  const cBranded = await sharp(cClean).composite([{ input: chestMark, left: 350, top: 728 }, { input: officialChestLockup(), left: 371, top: 728 }]).png().toBuffer();
  await writeCard("01-identify.jpg", slide1Art, { title: "IDENTIFY\nPUSH", sub: "CHECK BEFORE YOU COLLECT", stamp: "NOT PUSH", mode: "cover" });
  await writeCard("02-uniform.jpg", slide2Art, { step: "STEP 1", title: "VERIFY\nSHIRT", mode: "compact" });
  await writeCard("03-back-print.jpg", slide3Art, { step: "STEP 2", title: "CHECK\nBACK", mode: "compact" });
  await writeCard("04-vendor-app.jpg", b1, { step: "STEP 3", title: "CHECK\nAPP" });
  await writeCard("05-mini-tanker.jpg", b2, { step: "STEP 4", title: "MINI\nTANKER" });
  await writeCard("06-verified.jpg", slide6Art, { step: "STEP 5", title: "VERIFY\nFIRST" });
  await writeCard("07-case-closed.jpg", cBranded, { title: "ALL\nCLEAR", sub: "COLLECT WITH CONFIDENCE", mode: "case" });
  const cards = await Promise.all(["01-identify.jpg", "02-uniform.jpg", "03-back-print.jpg", "04-vendor-app.jpg", "05-mini-tanker.jpg", "06-verified.jpg", "07-case-closed.jpg"].map(async (n) => ({ input: await sharp(path.join(OUT, n)).resize({ width: 360 }).jpeg().toBuffer() })));
  await sharp({ create: { width: 2520, height: 450, channels: 3, background: "#071a14" } }).composite(cards.map((x, i) => ({ ...x, left: i * 360, top: 0 }))).jpeg({ quality: 92 }).toFile(path.join(OUT, "_full-carousel-review.jpg"));
}
main().catch((e) => { console.error(`FATAL: ${e.message}`); process.exitCode = 1; });
