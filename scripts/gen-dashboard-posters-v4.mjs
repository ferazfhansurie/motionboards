// Dashboard ad posters v4 — same 5 angles + Apple-keynote look as v3, BUT the
// ADletic logo is NOT redrawn by the model. Instead we reserve a clean empty band
// at the bottom and composite the REAL Adetic.png seal pixel-perfect (the
// HyperWrapz technique) so the brand mark never looks AI-generated.
//   node scripts/gen-dashboard-posters-v4.mjs [--slug=v4-01-owner-realtime]
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "aios", "outputs", "2026-07-19-adletic-dashboard-posters-v4");
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

// No logo reference passed to the model — it must NOT try to draw a brand seal.
const STYLE = `Create a premium 9:16 vertical ad poster for ADletic (Malaysia),
Apple-keynote / Apple product-photography level: minimal, expensive, calm,
generous negative space, soft diffused studio light, gentle shadows, matte
surfaces, restrained palette (deep charcoal + off-white with ADletic navy and one
warm-orange accent). Photoreal but uncluttered. Make it feel like a real premium
studio photograph, not a CG render: subtle real-world lighting, natural shadow
falloff, fine surface texture. Avoid over-glossy plastic sheen and fake glow.

Hero: a real premium device (iMac / MacBook / iPad) on a clean desk showing a
business dashboard.

CRITICAL — keep the ON-SCREEN dashboard EXTREMELY MINIMAL and legible:
- ONE big currency number in large type (use "RM" for currency, NEVER "$" or "R$").
  The tile above it has NO label, OR a short real business word only (e.g. JUALAN,
  SALES, UNTUNG). NEVER print the words "HERO NUMBER", "KPI", "LABEL", "TILE", or
  any instruction-like text on screen.
- ONE simple clean chart.
- AT MOST two large KPI tiles with SHORT real one-word labels (e.g. UNITS, GROWTH).
- NO sidebar full of menu items, NO tiny text, NO long labels, NO clutter, NO fake small numbers.
- Big, simple words only. Treat on-screen text as design and keep it sparse and perfectly legible.

CTA STYLE: render the CTA line inside a solid warm-orange rounded-rectangle button
with white bold text, placed low in the poster (just above the reserved bottom band).

BRAND SEAL SPACE — leave the BOTTOM 12% of the poster as a clean, calm, empty area
(plain off-white / matching background, NO text, NO logo, NO icon, NO watermark
there). A real circular brand seal will be composited into that empty area
afterwards, so do NOT draw any logo, badge, seal, mascot, or brand name anywhere
in the poster.

Poster text: render ONLY the exact label, headline, and CTA below, large, crisp,
high-contrast (the eyebrow label must be clearly readable, deep navy or orange,
not faint). No other text, no hashtags, no QR, no fake URL, no watermark, no logo.`;

const posters = [
  {
    slug: "v4-01-owner-realtime",
    text: `Label: "REAL-TIME OWNER VIEW"\nHeadline: "Nak tau performance bisnes, tak payah tanya sesiapa."\nCTA: "Tengok demo free."`,
    concept: "A calm founder glancing at an iPad on a desk, screen shows ONE big live number and one simple chart only — no staff, no phone calls, just the owner and the dashboard.",
  },
  {
    slug: "v4-02-time-leak",
    text: `Label: "TIME LEAK"\nHeadline: "3 jam sehari copy-paste Excel. Sepatutnya 3 saat."\nCTA: "Automate free check."`,
    concept: "A subdued stack of spreadsheet windows fading into the background on one side; the hero laptop screen shows ONE clean live number replacing them, a small subtle arrow motion implying automation.",
  },
  {
    slug: "v4-03-growing-pains",
    text: `Label: "GROWING PAINS"\nHeadline: "Bisnes dah besar. Spreadsheet still yang lama."\nCTA: "Semak kesediaan free."`,
    concept: "A small cluster of messy overlapping spreadsheet papers on one side (representing scale outgrowing tools); the hero screen shows a minimal dashboard with one big number and one chart scaling upward.",
  },
  {
    slug: "v4-04-decision-trust",
    text: `Label: "DECISION RISK"\nHeadline: "Buat keputusan besar, tapi number pun tak sure betul ke tak."\nCTA: "Dapatkan clarity free."`,
    concept: "A MacBook on a quiet desk in soft light, screen shows ONE big verified-looking number with a small checkmark accent and one simple chart — calm, trustworthy, single source of truth.",
  },
  {
    slug: "v4-05-competitive",
    text: `Label: "STAY AHEAD"\nHeadline: "Competitor you dah guna dashboard. You still guna Excel?"\nCTA: "Book free consult."`,
    concept: "Two devices side by side: one dim/older-looking laptop with a plain spreadsheet, one bright modern iMac beside it showing a minimal live dashboard with one big number — clear contrast, ahead vs behind.",
  },
];

async function generate(base, key, prompt) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt, generationOptions: { aspect_ratio: "9:16", resolution: "2K" } }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    if ((res.status === 429 || /rate.?limit/i.test(JSON.stringify(json))) && attempt <= 10) { process.stdout.write(`(429 #${attempt}) `); await sleep(45000); continue; }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
}

// Composite the REAL circular logo, small, centered in the reserved bottom band.
async function compositeLogo(bgPath, outPath) {
  const bg = sharp(bgPath);
  const meta = await bg.metadata();
  const W = meta.width, H = meta.height;
  const sealW = Math.round(W * 0.16);              // small brand seal
  const logoBuf = await sharp(LOGO).resize(sealW, sealW, { fit: "inside" }).png().toBuffer();
  const left = Math.round((W - sealW) / 2);         // centered horizontally
  const top = Math.round(H - H * 0.115);            // sits inside the reserved bottom band
  await bg.composite([{ input: logoBuf, left, top }]).toFile(outPath);
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  await fs.mkdir(OUT, { recursive: true });
  const slugFlag = process.argv.find((a) => a.startsWith("--slug="));
  const only = slugFlag ? slugFlag.split("=")[1] : null;
  const recompose = process.argv.includes("--recomposite");
  for (const p of posters) {
    if (only && p.slug !== only) continue;
    const rawOut = path.join(OUT, `${p.slug}-raw.png`);
    const finalOut = path.join(OUT, `${p.slug}.png`);
    if (recompose) {
      try { await fs.access(rawOut); await compositeLogo(rawOut, finalOut); console.log(`recomposited ${p.slug}`); }
      catch (e) { console.log(`skip ${p.slug}: ${e instanceof Error ? e.message : e}`); }
      continue;
    }
    process.stdout.write(`[${p.slug}] ... `);
    const prompt = `${STYLE}\n\nConcept: ${p.concept}\n\n${p.text}`;
    const r = await generate(base, key, prompt);
    if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0,160)}`); continue; }
    const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    await fs.writeFile(rawOut, Buffer.from(await img.arrayBuffer()));
    await compositeLogo(rawOut, finalOut);
    console.log("saved");
  }
  console.log(`Done. ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
