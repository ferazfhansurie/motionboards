// Dashboard ad posters v3 — 5 NEW angles (ownership, time-leak, scaling pain,
// decision-trust, competitive) alongside the DASHBOARD AD(5).mp4 video creative.
// Same Apple-studio look as v2, minimal on-screen dashboard text.
//   node scripts/gen-dashboard-posters-v3.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "aios", "outputs", "2026-07-18-adletic-dashboard-posters-v3");
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
  const buf = await sharp(file).resize({ width: 900, height: 1200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const STYLE = `Reference 1 = ADletic circular logo: reproduce it faithfully as a SMALL brand seal near the bottom.

Create a premium 9:16 vertical ad poster for ADletic (Malaysia), Apple-keynote / Apple product-photography level: minimal, expensive, calm, generous negative space, soft diffused studio light, gentle shadows, matte surfaces, restrained palette (deep charcoal + off-white with ADletic navy and one warm-orange accent). Photoreal but uncluttered.

Hero: a real premium device (iMac / MacBook / iPad) on a clean desk showing a business dashboard.

CRITICAL — keep the ON-SCREEN dashboard EXTREMELY MINIMAL and legible:
- ONE big hero number in large type (use "RM" for any currency, NEVER "$" or "R$").
- ONE simple clean chart.
- AT MOST two large KPI tiles with SHORT one-word labels.
- NO sidebar full of menu items, NO tiny text, NO long labels, NO clutter, NO fake small numbers.
- Big, simple words only. Treat on-screen text as design and keep it sparse and perfectly legible. Fewer words is better.

Poster text: render ONLY the exact label, headline, and CTA below, large, crisp, high-contrast (the eyebrow label must be clearly readable, deep navy or orange, not faint). No other text, no hashtags, no QR, no fake URL, no watermark.`;

const posters = [
  {
    slug: "v3-01-owner-realtime",
    text: `Label: "REAL-TIME OWNER VIEW"\nHeadline: "Nak tau performance bisnes, tak payah tanya sesiapa."\nCTA: "Tengok demo free."`,
    concept: "A calm founder glancing at an iPad on a desk, screen shows ONE big live number and one simple chart only — no staff, no phone calls, just the owner and the dashboard.",
  },
  {
    slug: "v3-02-time-leak",
    text: `Label: "TIME LEAK"\nHeadline: "3 jam sehari copy-paste Excel. Sepatutnya 3 saat."\nCTA: "Automate free check."`,
    concept: "A subdued stack of spreadsheet windows fading into the background on one side; the hero laptop screen shows ONE clean live number replacing them, a small subtle arrow motion implying automation.",
  },
  {
    slug: "v3-03-growing-pains",
    text: `Label: "GROWING PAINS"\nHeadline: "Bisnes dah besar. Spreadsheet still yang lama."\nCTA: "Semak kesediaan free."`,
    concept: "A small cluster of messy overlapping spreadsheet papers on one side (representing scale outgrowing tools); the hero screen shows a minimal dashboard with one big number and one chart scaling upward.",
  },
  {
    slug: "v3-04-decision-trust",
    text: `Label: "DECISION RISK"\nHeadline: "Buat keputusan besar, tapi number pun tak sure betul ke tak."\nCTA: "Dapatkan clarity free."`,
    concept: "A MacBook on a quiet desk in soft light, screen shows ONE big verified-looking number with a small checkmark accent and one simple chart — calm, trustworthy, single source of truth.",
  },
  {
    slug: "v3-05-competitive",
    text: `Label: "STAY AHEAD"\nHeadline: "Competitor you dah guna dashboard. You still guna Excel?"\nCTA: "Book free consult."`,
    concept: "Two devices side by side: one dim/older-looking laptop with a plain spreadsheet, one bright modern iMac beside it showing a minimal live dashboard with one big number — clear contrast, ahead vs behind.",
  },
];

async function generate(base, key, prompt, inputImages) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt, inputImages, generationOptions: { aspect_ratio: "9:16", resolution: "2K" } }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    if ((res.status === 429 || /rate.?limit/i.test(JSON.stringify(json))) && attempt <= 10) { process.stdout.write(`(429 #${attempt}) `); await sleep(45000); continue; }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  await fs.mkdir(OUT, { recursive: true });
  const logoUri = await dataUri(LOGO);
  for (const p of posters) {
    process.stdout.write(`[${p.slug}] ... `);
    const prompt = `${STYLE}\n\nConcept: ${p.concept}\n\n${p.text}`;
    const r = await generate(base, key, prompt, [logoUri]);
    if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0,160)}`); continue; }
    const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    await fs.writeFile(path.join(OUT, `${p.slug}.png`), Buffer.from(await img.arrayBuffer()));
    console.log("saved");
  }
  console.log(`Done. ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
