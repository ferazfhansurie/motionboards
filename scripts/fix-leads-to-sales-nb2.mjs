// Fix ADletic leads-to-sales poster with strict no-microtext instructions.
// Uses MotionBoards Nano Banana 2 API and the previous image as a composition reference.
//   node scripts/fix-leads-to-sales-nb2.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "aios", "outputs", "2026-07-08-adletic-digital-marketing-nb2-v2", "fixes");
const BASE_IMG = path.join(ROOT, "aios", "outputs", "2026-07-08-adletic-digital-marketing-nb2-v2", "04-leads-to-sales.png");
const LOGO = path.join(ROOT, "public", "Freelance", "Adetic.png");

async function loadEnv() {
  for (const f of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}

async function refUri(file, width = 1200) {
  const buf = await sharp(file)
    .resize({ width, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const PROMPT = `Use the first attached image as the composition reference: premium dark desk, phone, paper checklist, ADletic logo at bottom, orange/navy/off-white palette, 9:16 vertical editorial ad.

CRITICAL TYPO FIX:
Remove ALL small readable text from the phone screen, checklist, receipt, forms, UI cards, date, notifications and background papers.
Replace every small text area with clean abstract UI bars, checkboxes, ticks, blank lines, blurred blocks, or simple shapes.
Do NOT write any words on the phone screen.
Do NOT write any words on the checklist paper.
Do NOT write any words on the receipt.
Do NOT invent labels, names, dates, app text, menu text, or handwriting.

Only these three poster text blocks may be readable, and they must be spelled EXACTLY:
Top pill label: "ADS + WHATSAPP + FOLLOW-UP"
Main headline: "Lead masuk. Sales jalan."
Bottom CTA: "Build the system."

Use the second attached image as the ADletic logo reference. Place a small accurate ADletic circular logo centered near the bottom.

Keep the same high-end editorial photography feel. Make the phone notifications visually obvious using blank rounded notification cards only, no letters. Make the checklist visually obvious using orange ticks and blank lines only, no letters.

Zero extra text. Zero misspellings. Zero gibberish. No watermark. No QR code. No fake website.`;

async function generate(base, key, inputImages, n) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image-preview",
        prompt: `${PROMPT}\n\nVariant ${n}: prioritize exact text accuracy and hide all background writing.`,
        inputImages,
        generationOptions: { aspect_ratio: "9:16", resolution: "2K" },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    if ((res.status === 429 || /rate.?limit/i.test(JSON.stringify(json))) && attempt <= 10) {
      process.stdout.write(`(429 #${attempt}, 45s) `);
      await sleep(45000);
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  if (!key) throw new Error("No MB_API_KEY or MB_KEY in env.local.");
  await fs.mkdir(OUT, { recursive: true });

  const inputImages = [await refUri(BASE_IMG), await refUri(LOGO, 700)];
  for (let i = 1; i <= 4; i++) {
    process.stdout.write(`[fix-${i}] ... `);
    const r = await generate(base, key, inputImages, i);
    if (r.status !== "completed" || !r.outputUrl) {
      console.log(`unexpected ${JSON.stringify(r).slice(0, 160)}`);
      continue;
    }
    const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    const buf = Buffer.from(await img.arrayBuffer());
    const out = path.join(OUT, `04-leads-to-sales-fix-${String(i).padStart(2, "0")}.png`);
    await fs.writeFile(out, buf);
    console.log(`saved ${(buf.length / 1024).toFixed(0)} KB`);
  }
  await fs.writeFile(path.join(OUT, "04-leads-to-sales-fix.prompt.txt"), PROMPT, "utf8");
  console.log(`Done. Output in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
