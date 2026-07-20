// Dashboard ad posters v2 — same Apple-studio look but the ON-SCREEN dashboard
// is deliberately MINIMAL (few big words) so NB2 doesn't distort tiny UI text.
//   node scripts/gen-dashboard-nb2-v2.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "aios", "outputs", "2026-07-10-adletic-dashboard-nb2-v2");
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
  { slug: "01-kpi-leak-check", text: `Label: "FREE KPI LEAK CHECK"\nHeadline: "Berapa revenue hilang dalam report yang tak pernah dibuka?"\nCTA: "Audit free. Isi form."`, concept: "Beside the device, one printed report page with a single orange circle and a small tab 'LEAK FOUND'. The screen shows one big number and a simple chart only." },
  { slug: "02-followup-leak", text: `Label: "FOLLOW-UP LEAK"\nHeadline: "Lead masuk. Tapi siapa follow-up?"\nCTA: "Check leak free."`, concept: "A premium phone on the desk showing ONE simple 'new lead' notification card; a MacBook behind shows a minimal dashboard with one big number." },
  { slug: "03-spreadsheet-maze", text: `Label: "BUSINESS DASHBOARD"\nHeadline: "12 sheet. 0 jawapan."\nCTA: "Dapatkan blueprint."`, concept: "A small subdued stack of messy spreadsheets on one side; the hero laptop shows ONE clean minimal dashboard: one big number + one chart." },
  { slug: "04-monday-meeting", text: `Label: "FOUNDER VIEW"\nHeadline: "Masuk Monday meeting dah tahu number."\nCTA: "Build my dashboard."`, concept: "An iPad or MacBook on a calm meeting table in soft morning light, screen shows a minimal founder view: one big headline metric and a couple of large KPI tiles. A single coffee cup." },
  { slug: "05-command-center", text: `Label: "CUSTOM DASHBOARD DEV"\nHeadline: "Satu dashboard. Semua nombor penting."\nCTA: "Free KPI Leak Check."`, concept: "A large iMac as a clean command center: one big LIVE number in RM, one smooth area chart, two large KPI tiles with short labels. Minimal desk." },
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
