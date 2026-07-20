// ADletic custom-dashboard poster pack, photoreal at Apple-studio level, via
// MotionBoards Nano Banana 2. Each render is fed the original HTML dashboard
// poster (for exact copy + layout) plus the ADletic logo (brand seal).
//   node scripts/gen-dashboard-nb2.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML_DIR = path.join(ROOT, "aios", "outputs", "2026-07-08-adletic-dashboard-posters");
const OUT = path.join(ROOT, "aios", "outputs", "2026-07-10-adletic-dashboard-nb2");
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

async function dataUri(file) {
  const buf = await sharp(file)
    .resize({ width: 900, height: 1200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const STYLE = `You are given two reference images:
1 = ADletic circular logo. Reproduce it faithfully as a SMALL, subtle brand seal near the bottom of the poster.
2 = the original ADletic dashboard poster. KEEP its exact headline, label/eyebrow, and CTA wording, and keep its top-to-bottom structure (eyebrow/label near the top, hero object in the middle, CTA at the bottom). Do NOT keep its flat vector look.

Re-imagine poster 2 as a REAL photographed scene, elevated to Apple-keynote / Apple product-photography design level.

Design bar (very important): Apple studio. Minimal, premium, expensive, calm. Generous negative space. Soft diffused studio lighting, gentle realistic shadows, shallow depth of field. Matte premium surfaces. Precise clean modern sans-serif typography, perfectly kerned, crisp and highly legible on mobile. Restrained palette: deep charcoal and off-white with ADletic navy plus a single warm-orange accent. Photoreal but understated and uncluttered. NEVER a busy detective corkboard, NEVER stock smiling office people, NEVER clip-art icons.

Hero object: a real premium device (an iMac, MacBook, or iPad on a clean minimal desk) displaying a genuinely beautiful modern business analytics DASHBOARD UI, clean KPI cards, a smooth line/area chart, a tidy bar chart, real-looking numbers, the quality of a Linear / Vercel / Apple-tier product interface.

9:16 vertical poster. Render ONLY the exact text listed below, large and clean. No lorem or gibberish micro-text, no QR code, no fake URL or phone number, no watermark, no giant logo splash.`;

const posters = [
  {
    slug: "01-kpi-leak-check",
    ref: "01-kpi-leak-check.png",
    prompt: `Concept: a clean minimal desk. The hero is a large screen showing a refined analytics dashboard where one KPI is gently highlighted in orange. Beside the device, a single printed report page with one orange marker circle and a small tab reading "LEAK FOUND". The contrast: overlooked paper report vs the clear dashboard.

Exact text:
Label: "FREE KPI LEAK CHECK"
Headline: "Berapa revenue hilang dalam report yang tak pernah dibuka?"
CTA: "Audit free. Isi form."`,
  },
  {
    slug: "02-followup-leak",
    ref: "02-followup-leak.png",
    prompt: `Concept: a premium smartphone standing on a clean desk showing a single incoming lead notification / one WhatsApp-style message bubble ("new lead"), with a MacBook slightly out of focus behind it showing a follow-up dashboard. Quiet, premium, one clear idea: the lead came in but nobody followed up.

Exact text:
Label: "FOLLOW-UP LEAK"
Headline: "Lead masuk. Tapi siapa follow-up?"
CTA: "Check leak free."`,
  },
  {
    slug: "03-spreadsheet-maze",
    ref: "03-spreadsheet-maze.png",
    prompt: `Concept: on one side a small, subdued stack of messy spreadsheet printouts; the hero, sharply lit, is a laptop or tablet showing ONE clean unified dashboard. Minimal contrast of chaos resolved into clarity. Lots of negative space.

Exact text:
Label: "BUSINESS DASHBOARD"
Headline: "12 sheet. 0 jawapan."
CTA: "Dapatkan blueprint."`,
  },
  {
    slug: "04-monday-meeting",
    ref: "04-monday-meeting.png",
    prompt: `Concept: a MacBook or iPad on a clean, calm meeting table in soft Monday-morning light, showing a founder's overview dashboard as tidy rows/cards (revenue, cashflow, follow-up, ads spend, all live). A single coffee cup nearby. Serene, in-control, premium.

Exact text:
Label: "FOUNDER VIEW"
Headline: "Masuk Monday meeting dah tahu number."
CTA: "Build my dashboard."`,
  },
  {
    slug: "05-command-center",
    ref: "05-command-center.png",
    prompt: `Concept: a large iMac / desktop monitor as a clean command center, one beautiful dashboard filling the screen: a big LIVE headline number, a smooth area chart, a row of KPI cards. Minimal desk, single warm-orange accent, museum-grade product shot.

Exact text:
Label: "CUSTOM DASHBOARD DEV"
Headline: "Satu dashboard. Semua nombor penting."
CTA: "Free KPI Leak Check."`,
  },
];

async function generate(base, key, prompt, inputImages) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image-preview",
        prompt,
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
  if (!key) throw new Error("No API key. Expected MB_API_KEY in env.local.");
  await fs.mkdir(OUT, { recursive: true });

  const logoUri = await dataUri(LOGO);
  for (const p of posters) {
    process.stdout.write(`[${p.slug}] ... `);
    const posterUri = await dataUri(path.join(HTML_DIR, p.ref));
    const prompt = `${STYLE}\n\n${p.prompt}`;
    const r = await generate(base, key, prompt, [logoUri, posterUri]);
    if (r.status !== "completed" || !r.outputUrl) {
      console.log(`unexpected: ${JSON.stringify(r).slice(0, 200)}`);
      continue;
    }
    const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    const buf = Buffer.from(await img.arrayBuffer());
    await fs.writeFile(path.join(OUT, `${p.slug}.png`), buf);
    console.log(`saved ${(buf.length / 1024).toFixed(0)} KB`);
  }
  console.log(`Done. Output in ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
