// ADletic digital marketing solutions poster pack via MotionBoards Nano Banana 2.
//   node scripts/gen-digital-marketing-nb2.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "aios", "outputs", "2026-07-08-adletic-digital-marketing-nb2");
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
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  const buf = await fs.readFile(file);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const BASE_STYLE = `Create a premium 9:16 vertical Facebook/Instagram ad poster for ADletic Agency in Malaysia.
Use the attached ADletic logo accurately as a small brand mark near the bottom, not huge.
Editorial Apple-level advertising photography, not a Canva template, not generic stock.
Dark charcoal studio background, warm orange ADletic accent, off-white paper, navy details.
Malaysian SMB owner audience. The idea should feel like evidence, receipts, screenshots,
ad account artifacts and working notes, not a normal agency promo.

Typography must be bold, clean, modern, high contrast, easy to read on mobile.
Use ONLY the exact text requested. No extra paragraphs, no fake phone number, no fake website,
no QR code, no watermark, no extra logos, no misspelled words.`;

const posters = [
  {
    slug: "01-ads-leak-audit",
    prompt: `${BASE_STYLE}

Concept: "ad spend autopsy". A physical Meta ads spend report on a dark desk, orange marker circles around wasted spend, a calculator, a small receipt, and a clean dashboard card in the background. Moody editorial lighting, shallow depth of field, realistic paper texture.

Exact poster text:
Headline: "Bajet iklan keluar. Customer tak masuk?"
Small label: "FREE ADS LEAK AUDIT"
CTA: "Isi form. Kami check."

Keep the headline large at the top. Keep CTA at the bottom. Make it look like a serious diagnostic offer, not a cheap discount.`,
  },
  {
    slug: "02-boost-button",
    prompt: `${BASE_STYLE}

Concept: "boost button is not a strategy". A sad boosted-post insights screen printed on paper, lying on a dark table. It shows abstract UI blocks, 3 tiny like icons, one orange warning sticker. Do not use real Facebook branding, only generic social-ad UI shapes.

Exact poster text:
Headline: "Boost post bukan strategy."
Small label: "DIGITAL MARKETING SOLUTIONS"
CTA: "Jom betulkan funnel."

Minimal, funny but serious. Premium editorial poster. The line should feel like a punch.`,
  },
  {
    slug: "03-leads-system",
    prompt: `${BASE_STYLE}

Concept: "lead machine". A sleek phone with overflowing lead notifications, beside a neat printed checklist: Ads, Landing, Form, WhatsApp, Follow-up. Orange ticks, realistic paper shadows, high-end product photography.

Exact poster text:
Headline: "Lead masuk. Follow-up jalan."
Small label: "ADS + FUNNEL + AUTOMATION"
CTA: "Build the system."

Make it feel like ADletic builds the whole marketing system, not just ads.`,
  },
  {
    slug: "04-full-funnel",
    prompt: `${BASE_STYLE}

Concept: "full funnel map". A corkboard with four pinned cards connected by orange thread: CONTENT, ADS, LANDING, FOLLOW-UP. One clean analytics card at the side. Editorial detective-board composition but polished and modern, not messy.

Exact poster text:
Headline: "Iklan bagus tak cukup."
Small label: "FULL FUNNEL MARKETING"
CTA: "Audit funnel free."

Strong top headline, visual system in the middle, CTA bottom.`,
  },
  {
    slug: "05-rm100-test",
    prompt: `${BASE_STYLE}

Concept: "small budget test". A clean orange RM100 voucher card pinned to a black corkboard, surrounded by tiny abstract lead cards and ad cards. Do not show real Malaysian banknotes. Use a stylised voucher, not currency.

Exact poster text:
Headline: "Bagi RM100. Kita test."
Small label: "SMB AD TEST"
CTA: "Kira sendiri lepas 7 hari."

Serious dare energy. Editorial, premium, trust-building, no hype.`,
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
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 360)}`);
  }
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  if (!key) throw new Error("No API key. Expected MB_API_KEY or MB_KEY in env.local.");
  await fs.mkdir(OUT, { recursive: true });

  const logo = await dataUri(LOGO);
  const manifest = [];
  for (const p of posters) {
    process.stdout.write(`[${p.slug}] ... `);
    const r = await generate(base, key, p.prompt, [logo]);
    if (r.status !== "completed" || !r.outputUrl) {
      console.log(`unexpected: ${JSON.stringify(r).slice(0, 180)}`);
      manifest.push({ slug: p.slug, status: "unexpected", response: r });
      continue;
    }
    const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    const buf = Buffer.from(await img.arrayBuffer());
    const out = path.join(OUT, `${p.slug}.png`);
    await fs.writeFile(out, buf);
    await fs.writeFile(path.join(OUT, `${p.slug}.prompt.txt`), p.prompt, "utf8");
    manifest.push({ slug: p.slug, output: out, outputUrl: r.outputUrl });
    console.log(`saved ${(buf.length / 1024).toFixed(0)} KB`);
  }

  await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(path.join(OUT, "README.md"), `# ADletic digital marketing solutions - Nano Banana 2

Generated through MotionBoards Nano Banana 2 using the ADletic logo reference.

Offer angle: Free Ads Leak Audit / digital marketing solutions for Malaysian SMB owners.
`, "utf8");
  console.log(`Done. Output in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
