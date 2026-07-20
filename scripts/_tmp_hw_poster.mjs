// Editorial PRICING posters for HyperWrapz. AI studio background + dark scrim +
// crisp editorial type (resvg-js, DIN Condensed Bold) + real transparent logo.
// One template, 4 service categories, feed (4:5) + story (9:16).
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

const ROOT = "/Users/faeez/motionboards";
const DIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen");
const LOGO = path.join(DIR, "HYPERWRAPZ-LOGO-cutout.png");
const FONT_DIN = "/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf";
const FONT_ARIAL_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
const FONT_ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf";

async function safePath(p) {
  try { await fs.access(p); } catch { return p; }
  const ext = path.extname(p);
  const base = p.slice(0, -ext.length);
  for (let n = 2; ; n++) {
    const candidate = `${base}-v${n}${ext}`;
    try { await fs.access(candidate); } catch { return candidate; }
  }
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ACCENT = "#1FA8E0"; // HyperWrapz cyan-blue (from logo)
const FOOTER = "KLANG  ·  WHATSAPP 011-6188 4476  ·  @HYPERWRAPZ";

// ---- Pricing content ----
const POSTERS = [
  {
    slug: "01-wrap", bg: "bg-04-wide-studio.png", mode: "lr",
    eyebrow: "Colour Change Wrap", note: "3000+ colours · matte / satin / gloss / chrome",
    rows: [
      { name: "Nextfeel", price: "RM2900" },
      { name: "Atmos Shield", price: "RM3500" },
      { name: "Naka", price: "RM3800" },
      { name: "TeckWrap", price: "RM3800" },
    ],
  },
  {
    slug: "02-ppf", bg: "bg-03-sport-black.png", mode: "lr",
    eyebrow: "Paint Protection Film & Combos", note: "Self-healing 8.5MIL film",
    rows: [
      { name: "Full Front PPF", sub: "8.5MIL", price: "RM1900" },
      { name: "Full Car PPF", sub: "8.5MIL", price: "RM3800" },
      { name: "3 In 1 Combo Lite", sub: "Front PPF + Tint + Coating", price: "RM4800" },
      { name: "3 In 1 Combo Ultra", sub: "Full PPF + Tint + Coating", price: "RM5800" },
    ],
  },
  {
    slug: "03-tint", bg: "bg-02-sedan-grey.png", mode: "stack",
    eyebrow: "Premium Window Tint", note: "Pricing: Small · Medium · Large",
    rows: [
      { name: "Nano Carbon Ceramic HD", sub: "IRR 95% · UV 97% · 2Mil · 5yr", price: "RM850 · 1000 · 1150" },
      { name: "Ultra Sputtering HD", sub: "IRR 97% · UV 99% · 4Mil · 5yr", price: "RM1300 · 1500 · 1700" },
      { name: "Royal Titanium HD+", sub: "IRR 99% · UV 99% · 4Mil+ · 10yr", price: "RM1500 · 1700 · 2000" },
    ],
  },
  {
    slug: "04-coating", bg: "bg-01-suv-teal.png", mode: "lr",
    eyebrow: "Graphene Ceramic Coating", note: "10H hardness · hydrophobic · glossy finish",
    rows: [
      { name: "Graphene 10H Coating", sub: "Full car", price: "RM1200" },
      { name: "Tinted (Sputtering HD)", sub: "Add-on", price: "RM1200" },
    ],
  },
];

function svg(W, H, p) {
  const M = Math.round(W * 0.06);
  const footerY = H - Math.round(H * 0.04);
  const footerSize = Math.round(W * 0.020 * 1.4);
  const eyebrowSize = Math.round(W * 0.026 * 1.4);
  const noteSize = Math.round(W * 0.019 * 1.4);
  const nameSize = Math.round(W * 0.034 * 1.4);
  const subSize = Math.round(W * 0.0185 * 1.4);
  const priceSize = Math.round(W * (p.mode === "stack" ? 0.040 : 0.052) * 1.4);

  // measure rows top-down; compute block height, then anchor above footer
  const rowGap = Math.round(H * 0.010);
  const rowH = (r) => {
    if (p.mode === "stack") return nameSize * 1.15 + subSize * 1.25 + priceSize * 1.15 + rowGap * 1.6;
    return Math.max(nameSize * 1.15 + (r.sub ? subSize * 1.2 : 0), priceSize) + rowGap * 1.7;
  };
  const rowsH = p.rows.reduce((a, r) => a + rowH(r), 0);
  const eyebrowBlock = eyebrowSize + Math.round(H * 0.012) + noteSize + Math.round(H * 0.022);
  const ruleY0 = footerY - Math.round(H * 0.035) - rowsH - eyebrowBlock;
  const ruleW = Math.round(W * 0.10);

  let y = ruleY0;
  const parts = [];
  // rule
  parts.push(`<rect x="${M}" y="${y}" width="${ruleW}" height="${Math.max(4, Math.round(H * 0.0035))}" fill="${ACCENT}"/>`);
  y += Math.round(H * 0.028);
  // eyebrow
  parts.push(`<text x="${M}" y="${y + eyebrowSize}" font-family="Arial" font-weight="bold" font-size="${eyebrowSize}" fill="${ACCENT}" letter-spacing="${eyebrowSize * 0.22}">${esc(p.eyebrow.toUpperCase())}</text>`);
  y += eyebrowSize + Math.round(H * 0.012);
  // note
  parts.push(`<text x="${M}" y="${y + noteSize}" font-family="Arial" font-size="${noteSize}" fill="#c4c9cf" letter-spacing="0.3">${esc(p.note)}</text>`);
  y += noteSize + Math.round(H * 0.024);

  // rows
  for (const r of p.rows) {
    if (p.mode === "stack") {
      parts.push(`<text x="${M}" y="${y + nameSize}" font-family="Arial" font-weight="bold" font-size="${nameSize}" fill="#ffffff">${esc(r.name)}</text>`);
      let yy = y + nameSize + Math.round(subSize * 1.15);
      parts.push(`<text x="${M}" y="${yy}" font-family="Arial" font-size="${subSize}" fill="#b9bec4">${esc(r.sub)}</text>`);
      yy += Math.round(priceSize * 1.05);
      parts.push(`<text x="${M}" y="${yy}" font-family="DIN Condensed" font-weight="bold" font-size="${priceSize}" fill="${ACCENT}" letter-spacing="0.5">${esc(r.price)}</text>`);
      // divider
      const dy = y + rowH(r) - rowGap;
      parts.push(`<rect x="${M}" y="${dy}" width="${W - 2 * M}" height="1" fill="#ffffff" fill-opacity="0.14"/>`);
    } else {
      const nameY = y + nameSize;
      parts.push(`<text x="${M}" y="${nameY}" font-family="Arial" font-weight="bold" font-size="${nameSize}" fill="#ffffff">${esc(r.name)}</text>`);
      if (r.sub) parts.push(`<text x="${M}" y="${nameY + subSize * 1.15}" font-family="Arial" font-size="${subSize}" fill="#b9bec4">${esc(r.sub)}</text>`);
      // price right-aligned, baseline aligned near name
      parts.push(`<text x="${W - M}" y="${nameY + priceSize * 0.12}" text-anchor="end" font-family="DIN Condensed" font-weight="bold" font-size="${priceSize}" fill="${ACCENT}" letter-spacing="0.5">${esc(r.price)}</text>`);
      const dy = y + rowH(r) - rowGap;
      parts.push(`<rect x="${M}" y="${dy}" width="${W - 2 * M}" height="1" fill="#ffffff" fill-opacity="0.14"/>`);
    }
    y += rowH(r);
  }

  // footer
  parts.push(`<text x="${M}" y="${footerY}" font-family="Arial" font-weight="bold" font-size="${footerSize}" fill="#e8eaed" letter-spacing="${footerSize * 0.05}">${esc(FOOTER)}</text>`);

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.28" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#050608" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#050608" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#050608" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#050608" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${Math.round(H * 0.16)}" fill="url(#top)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#scrim)"/>
  ${parts.join("\n  ")}
</svg>`;
}

function render(svgStr, W) {
  return new Resvg(svgStr, {
    fitTo: { mode: "width", value: W },
    font: { fontFiles: [FONT_DIN, FONT_ARIAL_B, FONT_ARIAL], loadSystemFonts: true, defaultFontFamily: "Arial" },
  }).render().asPng();
}

async function build(p, bgDir, outDir, tag) {
  const bgPath = path.join(bgDir, p.bg);
  const meta = await sharp(bgPath).metadata();
  const W = meta.width, H = meta.height;
  const overlay = render(svg(W, H, p), W);
  const logoW = Math.round(W * (tag === "story" ? 0.30 : 0.26));
  const lm = await sharp(LOGO).metadata();
  const logoH = Math.round((lm.height / lm.width) * logoW);
  const logoBuf = await sharp(LOGO).resize(logoW, logoH).png().toBuffer();
  const M = Math.round(W * 0.055);
  const out = await safePath(path.join(outDir, `${p.slug}.png`));
  await sharp(bgPath)
    .composite([{ input: overlay, left: 0, top: 0 }, { input: logoBuf, left: M, top: Math.round(H * 0.035) }])
    .png().toFile(out);
  console.log("saved", path.relative(ROOT, out));
}

async function main() {
  const feedOut = path.join(DIR, "posters-bigtext");
  const storyOut = path.join(DIR, "posters-story-bigtext");
  await fs.mkdir(feedOut, { recursive: true });
  await fs.mkdir(storyOut, { recursive: true });
  const which = process.argv[2]; // optional slug filter
  for (const p of POSTERS) {
    if (which && p.slug !== which) continue;
    await build(p, path.join(DIR, "bg"), feedOut, "feed");
    await build(p, path.join(DIR, "bg9x16"), storyOut, "story");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
