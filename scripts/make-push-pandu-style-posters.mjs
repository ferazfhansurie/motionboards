// PUSH poster recreation in the exact pandu_team.png visual system:
// large black/green type, bright upper fade, divider, white info pill, green CTA.
// No image generation: the supplied hero photo pixels are used as-is.
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const REF = path.join(ROOT, "FatHopes IMG", "poster-refs");
const OUT = path.join(ROOT, "FatHopes IMG", "push-posters-pandu-style");
const W = 1536;
const H = 2752;

const jobs = [
  {
    src: "PUSH-2_hero_tanker.jpg", out: "01-pandu-kutip-untung.jpg",
    headline: ["MINYAK LAMA.", { text: " REZEKI BARU.", green: true }],
    sub: "Kutip dari premis, bina pendapatan ikut usaha.", earn: ["Satu laluan, ", { text: "banyak peluang", green: true }, "."],
  },
  {
    src: "PUSH-3_hero_worker-oil.jpg", out: "02-bos-menyampah.jpg",
    headline: ["MASA ANDA.", { text: " CARA ANDA.", green: true }],
    sub: "Rancang laluan sendiri, bergerak bila bersedia.", earn: ["Kerja ikut ", { text: "rentak sendiri", green: true }, "."],
  },
  {
    src: "PUSH-4_hero_newtanker.jpg", out: "03-gaji-tu-itu-je.jpg",
    headline: ["SATU TANGKI.", { text: " BANYAK PELUANG.", green: true }],
    sub: "Bawa perubahan hijau ke kawasan anda.", earn: ["Setiap kutipan ada ", { text: "nilainya", green: true }, "."],
  },
  {
    src: "PUSH-5_hero_team-newtanker.jpg", out: "04-takde-pengalaman.jpg",
    headline: ["JANGAN SIMPAN", { text: " IDEA.", green: true }],
    sub: "Jadikan rutin harian satu sumber pendapatan baru.", earn: ["Mula dengan ", { text: "satu langkah", green: true }, "."],
  },
];

function esc(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function rich(parts, x, y, size, weight = 600) {
  let cursor = x;
  return parts.map((part) => {
    const p = typeof part === "string" ? { text: part } : part;
    const width = p.text.length * size * (weight >= 700 ? 0.60 : 0.64);
    const out = `<text x="${cursor}" y="${y}" font-family="Helvetica Neue,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${p.green ? "#56BD4D" : "#101820"}">${esc(p.text)}</text>`;
    cursor += width;
    return out;
  }).join("");
}

function overlay(job) {
  const headlineSize = 96;
  const headLines = job.headline.map((line, i) => {
    const parts = Array.isArray(line) ? line : [line];
    return rich(parts, 120, 610 + i * 105, headlineSize, 760);
  }).join("");
  const subY = 610 + job.headline.length * 115 + 50;
  const dividerY = subY + 100;
  const earnY = dividerY + 92;
  const pillY = earnY + 70;
  const ctaY = pillY + 116;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F8FAFC" stop-opacity="0.96"/>
        <stop offset="0.62" stop-color="#F8FAFC" stop-opacity="0.90"/>
        <stop offset="1" stop-color="#F8FAFC" stop-opacity="0.12"/>
      </linearGradient>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000" flood-opacity="0.18"/></filter>
    </defs>
    <rect width="${W}" height="1260" fill="url(#wash)"/>
    <image href="data:image/png;base64,${logoB64}" x="120" y="105" width="116" height="106" preserveAspectRatio="xMidYMid meet"/>
    <text x="260" y="160" font-family="Helvetica Neue,Arial,sans-serif" font-size="48" font-weight="760" fill="#101820">FatHopes</text>
    <text x="260" y="210" font-family="Helvetica Neue,Arial,sans-serif" font-size="48" font-weight="760" fill="#101820">Energy</text>
    <text x="120" y="420" font-family="Helvetica Neue,Arial,sans-serif" font-size="40" font-weight="700" fill="#101820">PROGRAM PUSH</text>
    ${headLines}
    <text x="120" y="${subY}" font-family="Helvetica Neue,Arial,sans-serif" font-size="58" font-weight="600" fill="#101820">${esc(job.sub)}</text>
    <line x1="120" y1="${dividerY}" x2="1390" y2="${dividerY}" stroke="#8B9297" stroke-width="2"/>
    ${rich(job.earn, 120, earnY, 48, 600)}
    <rect x="120" y="${pillY}" width="1160" height="94" rx="47" fill="#FFFFFF" fill-opacity="0.88" stroke="#FFFFFF" stroke-width="3" filter="url(#soft)"/>
    <image href="data:image/png;base64,${oilIconB64}" x="148" y="${pillY + 8}" width="76" height="58" preserveAspectRatio="xMidYMid meet"/>
    <text x="250" y="${pillY + 62}" font-family="Helvetica Neue,Arial,sans-serif" font-size="38" font-weight="650" fill="#101820">Beli dan kutip minyak masak terpakai</text>
    <rect x="120" y="${ctaY}" width="425" height="112" rx="20" fill="#56BD4D" filter="url(#soft)"/>
    <text x="166" y="${ctaY + 72}" font-family="Helvetica Neue,Arial,sans-serif" font-size="46" font-weight="760" fill="#FFFFFF">Mohon Sekarang</text>
    <text x="120" y="${ctaY + 190}" font-family="Helvetica Neue,Arial,sans-serif" font-size="30" font-weight="500" fill="#101820">Waste to Wealth Conversion Experts</text>
  </svg>`;
}

const logoB64 = (await fs.readFile(path.join(REF, "LOGO-mark.png"))).toString("base64");
const oilIconB64 = (await sharp(path.join(ROOT, "FatHopes IMG", "push-posters-jobdesc", "pandu_team.png"))
  .extract({ left: 145, top: 930, width: 105, height: 80 }).png().toBuffer()).toString("base64");
await fs.mkdir(OUT, { recursive: true });
for (const job of jobs) {
  await sharp(path.join(REF, job.src))
    .resize(W, H, { fit: "cover", position: "attention" })
    .composite([{ input: Buffer.from(overlay(job)) }])
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toFile(path.join(OUT, job.out));
}
console.log(`Created ${jobs.length} pandu_team-style locked-photo posters in ${OUT}`);
