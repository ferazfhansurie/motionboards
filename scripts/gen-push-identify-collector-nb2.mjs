// Standalone 4:5 FatHopes PUSH identification carousel via Nano Banana 2.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_OUT = path.join(ROOT, "FatHopes IMG", "push-carousel-identify-collector-nb2");
const MODEL = "gemini-3.1-flash-image-preview";
const p = (...parts) => path.join(ROOT, ...parts);
const refs = {
  logo: p("FatHopes IMG", "poster-refs", "LOGO-mark.png"),
  cctv: p("FatHopes IMG", "push-carousel-kenal-push-betul-BOARD", "thief.jpeg"),
  front: p("FatHopes IMG", "drive-download-20260627T093124Z-3-001", "PUX09986.JPG"),
  back: p("FatHopes IMG", "drive-download-20260627T093938Z-3-001", "PUX08646.JPG"),
  login: p("FatHopes IMG", "poster-refs", "login.jpeg"),
  home: p("FatHopes IMG", "poster-refs", "home.jpeg"),
  qr: p("FatHopes IMG", "poster-refs", "qr code.jpeg"),
  tanker: p("FatHopes IMG", "push-people", "PUX02644.JPG"),
};

async function loadEnv() {
  for (const name of [".env.local", "env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, name), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
      return;
    } catch {}
  }
}

async function upload(base, key, file, index) {
  // MotionBoards needs a real uploaded URL for reference images. Sending the
  // original 6K camera files inline exceeds the generation request limit.
  const image = await sharp(file)
    .rotate()
    .resize({ width: 1200, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  const response = await fetch(`${base.replace(/\/$/, "")}/api/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "image/jpeg",
      "x-filename": `push-collector-ref-${index}.jpg`,
    },
    body: image,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.url) throw new Error(`Upload HTTP ${response.status}: ${JSON.stringify(json).slice(0, 500)}`);
  return json.url;
}

const SHARED = `Create ONE standalone 4:5 social-media carousel slide. Never make a board, contact sheet, multi-panel layout, presentation page, collage of slides, scrapbook, mood board or mural. This is a high-trust FatHopes Energy PUSH collector-verification guide for outlet owners.

DESIGN IDENTITY: a single seven-slide connected editorial carousel, inspired only by the supplied reference's strong type rhythm and one continuous visual motif—not its colours, typography, layout or copy. Translate it for FatHopes PUSH: one consistent deep forest-green industrial-depot background with soft teal practical lighting, sharp lime safety accents, white condensed bold editorial type and one FLUORESCENT-LIME COLLECTION ROUTE.

LOCKED CAROUSEL SYSTEM FOR EVERY SLIDE: use the exact same small official FatHopes logo at the TOP LEFT with generous margin; large white condensed uppercase title aligned LEFT; one real photo subject in the lower-right two-thirds, with a cut-out edge and cinematic shadow; at most one short supporting sentence. The route MUST ENTER at the LEFT EDGE exactly 70% down from the top and MUST EXIT at the RIGHT EDGE exactly 70% down from the top, except the final slide which resolves at the lower-right corner. Let the route weave around the hero but keep those edge endpoints fixed. Do not add a second logo, decorative badge, unexpected background, different font, second title style or unrelated composition.

Each slide has real cinematic depth: one dominant real photo cut-out breaking through a foreground plane, the same soft-focus depot environment behind it, directional lime edge light and slight perspective. Build motion into the still with only the consistent route line, one scan pulse and a small directional light trail. No magnifying glass, no random stickers, no glass panels unrelated to the product, no repeated body copy. It should feel like one sequence when seen side-by-side, never seven separate posters.

STRICTLY AVOID: cream paper, post-it notes, masking tape, ripped paper, Polaroid frames, doodles, handwriting, sketchy arrows, film strips, corkboards, paper texture, stickers, comic style, mood-board styling, tiny copy, generic AI workers, invented uniforms, invented vehicles, invented app screens or QR codes. Do not make flat rectangles with a photo underneath. Do not make a static brochure, a plain poster, or a PowerPoint layout.

Preserve supplied real uniform, app screen, mini tanker and logo details faithfully. Use the supplied FatHopes logo exactly, never redraw or misspell it. Render only the specified text exactly once. No watermark, no hashtags, no URLs, no extra text, no gibberish.`;

const slides = [
  ["01-cover", ["cctv", "logo"], `INPUT 1 is CCTV context only. Keep the scene but FULLY BLUR and anonymise every identifiable face. Do not name or identify a person. INPUT 2 is the official FatHopes logo. This is the opening slide. Use one dynamic angled CCTV cut-out in the lower-right, with the red NOT PUSH mark integrated inside it. The main headline is required and must appear character-for-character exactly as written below: never substitute, remove, add or alter a word. In particular, do not use the word SOY anywhere. TEXT EXACTLY:\nIDENTIFY FATHOPES ENERGY PUSH COLLECTOR\nBefore you hand over your used cooking oil, check these signs.\nNOT PUSH\nCHECK BEFORE YOU COLLECT`],
  ["02-uniform-front", ["front", "logo"], `INPUT 1 is a real FatHopes collector in the official black polo. Make a dominant cinematic close crop around the upper body and the real FatHopes chest logo. Keep the photo and mini tanker behind him faithful. INPUT 2 is the official logo. This is the first proof point: use one small lime locator dot and line pointing to the chest logo, with no magnifying glass or extra graphic object. Make the title very large and unmistakable in two lines at the upper left. TEXT EXACTLY:\nSTEP 1\nUNIFORM\nLook for the official FatHopes Energy polo.\nOFFICIAL LOGO`],
  ["03-uniform-back", ["back", "logo"], `INPUT 1 is real FatHopes staff viewed from behind. Crop tightly on the black polo back so the real logo and printed phrase are large and legible. Do not alter the printed wording. INPUT 2 is the official logo. This is the second uniform proof point; the same route passes behind the shoulder. No lower black band, no new badge and no extra logo. Use no placeholder text and do not write sentences other than those in TEXT EXACTLY. Make the two-line title very large at upper left. TEXT EXACTLY:\nSTEP 1\nUNIFORM BACK\nTurn around and check the official back print.\nWASTE TO WEALTH CONVERSION EXPERTS`],
  ["04-vendor-app", ["login", "home", "qr", "logo"], `INPUTS 1-3 are the real FatHopes Vendor App login, home and outlet QR screens. Preserve each exact screen and show them as one layered but restrained mobile-interface system. INPUT 4 is the official logo. Use three phones only: QR code nearest in front, home screen behind it, login behind that. One small scan pulse beside the QR code. Never make a generic app or add unrelated app UI. Make the two-line title very large and unmistakable in the upper left. TEXT EXACTLY:\nSTEP 2\nVENDOR APP\nEvery genuine collection is recorded in the app.\nNO APP = RED FLAG`],
  ["05-mini-tanker", ["tanker", "logo"], `INPUT 1 is the real FatHopes mini tanker. Use it as a dominant three-quarter real photo, angled as though it has driven into the lower-right. Preserve branded cab and black collection tank exactly. INPUT 2 is the official logo. Use only a small lime light trail beneath the wheels; do not redesign the truck, add an invented truck text, roadside curb or random platform. TEXT EXACTLY:\nSTEP 3\nMINI TANKER\nOfficial PUSH collectors arrive in a FatHopes mini tanker.\nNOT A NORMAL VAN OR CAR`],
  ["06-verified", ["qr", "home", "logo"], `INPUT 1 is the real outlet QR app screen and INPUT 2 the real FatHopes home app screen. Preserve both exact screens. INPUT 3 is official logo. Use one hero QR phone with the home screen peeking behind it. One small lime scan pulse beside—not over—the QR code. No oversized checkmark, no massive empty background and no second visual system. TEXT EXACTLY:\nSTEP 4\nGET VERIFIED\nNot verified in the app? Do not hand over your oil.\nCHECK FIRST`],
  ["07-case-closed", ["front", "qr", "tanker", "logo"], `INPUTS are real official uniform, real QR screen, real mini tanker and official logo. Use the polo as the main lower-right subject, with a very small tanker and app-screen glimpse as supporting depth layers only. One closing headline and four short checklist lines integrated along the route. Do not use ribbons, floating labels or a second duplicate checklist. TEXT EXACTLY:\nCASE CLOSED\nCHECK BEFORE YOU COLLECT\nOFFICIAL POLO\nVENDOR APP\nMINI TANKER\nVERIFIED IN APP\nCOLLECT WITH CONFIDENCE`],
];

async function generate(base, key, prompt, inputImages, formatInstruction, aspectRatio) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt: `${SHARED}\n\nFORMAT: ${formatInstruction}\n\n${prompt}`, inputImages, generationOptions: { aspect_ratio: aspectRatio, resolution: "2K" } }) });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.status === "completed" && json.outputUrl) return json;
    const notReady = /hasn't finished uploading|has not finished uploading/i.test(JSON.stringify(json));
    if ((res.status === 429 || notReady) && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, notReady ? 8000 : 30000));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
}

async function main() {
  await loadEnv();
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const format = process.env.FORMAT || "carousel";
  const aspectRatio = process.env.ASPECT_RATIO || "4:5";
  const formatInstruction = process.env.FORMAT_INSTRUCTION || "Facebook and Instagram carousel master. Compose in vertical 4:5 with generous safe margins.";
  const OUT = format === "carousel" ? BASE_OUT : path.join(BASE_OUT, format);
  if (!key) throw new Error("Missing MB_API_KEY or MB_KEY in .env.local");
  await fs.mkdir(OUT, { recursive: true });
  const uploadedRefs = new Map();
  let uploadIndex = 0;
  const getUpload = async (name) => {
    if (!uploadedRefs.has(name)) {
      uploadIndex += 1;
      process.stdout.write(`uploading ${name} ... `);
      const url = await upload(base, key, refs[name], uploadIndex);
      uploadedRefs.set(name, url);
      console.log("ready");
    }
    return uploadedRefs.get(name);
  };
  const only = (process.env.ONLY || "").split(",").map((value) => value.trim()).filter(Boolean);
  const selectedSlides = slides.filter(([name]) => only.length === 0 || only.includes(name));
  for (const [selectedIndex, [name, imageNames, prompt]] of selectedSlides.entries()) {
    const index = slides.findIndex(([slideName]) => slideName === name);
    process.stdout.write(`[${selectedIndex + 1}/${selectedSlides.length}] ${name} ... `);
    try {
      const result = await generate(base, key, prompt, await Promise.all(imageNames.map(getUpload)), formatInstruction, aspectRatio);
      const outRes = await fetch(result.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      if (!outRes.ok) throw new Error(`Download HTTP ${outRes.status}`);
      const tag = process.env.RUN_TAG ? `-${process.env.RUN_TAG}` : "";
      const output = path.join(OUT, `${String(index + 1).padStart(2, "0")}-${name}${tag}.png`);
      await fs.writeFile(output, Buffer.from(await outRes.arrayBuffer()));
      console.log(`saved ${path.basename(output)}`);
    } catch (error) { console.log(`failed: ${error instanceof Error ? error.message : error}`); }
  }
  await fs.writeFile(path.join(OUT, "README.md"), `# FatHopes PUSH collector ID carousel\n\nGenerated with MotionBoards Nano Banana 2 (${MODEL}).\n`);
  console.log(`Done: ${OUT}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
