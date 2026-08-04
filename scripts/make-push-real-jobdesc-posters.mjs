import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "FatHopes IMG", "push-posters-real-jobdesc");
const W = 1003;
const H = 1568;

const jobs = [
  {
    src: "PUSH-2_hero_tanker.jpg",
    out: "01-real-tanker-jobdesc.jpg",
    headline: ["Kerja yang bergerak."],
    subline: ["Jadi Usahawan Hijau."],
    desc: ["Kutip minyak masak terpakai", "Guna kenderaan sendiri", "Dibayar mengikut kutipan"],
  },
  {
    src: "PUSH-3_hero_worker-oil.jpg",
    out: "02-real-worker-jobdesc.jpg",
    headline: ["Bina kerja sendiri."],
    subline: ["Satu kutipan. Satu langkah."],
    desc: ["Kutip dari premis sekitar", "Urus laluan kutipan", "Bina pendapatan sendiri"],
  },
  {
    src: "PUSH-4_hero_newtanker.jpg",
    out: "03-real-newtanker-jobdesc.jpg",
    headline: ["Minyak terpakai."],
    subline: ["Nilai baharu untuk anda."],
    desc: ["Ambil minyak masak terpakai", "Gunakan kenderaan sendiri", "Sertai Program PUSH"],
  },
  {
    src: "PUSH-5_hero_team-newtanker.jpg",
    out: "04-real-team-jobdesc.jpg",
    headline: ["Jangan tunggu."],
    subline: ["Jadi Usahawan Hijau."],
    desc: ["Kutip. Kumpul. Hantar.", "Bekerja secara sendiri", "Team kami akan hubungi"],
  },
];

function esc(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function lines(items, x, y, size, color, weight = 500, gap = 1.18) {
  return items.map((line, i) => `<text x="${x}" y="${y + i * size * gap}" font-family="Helvetica Neue, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(line)}</text>`).join("");
}

function overlay(job) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.94"/><stop offset="0.7" stop-color="#ffffff" stop-opacity="0.82"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.08"/></linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity="0.18"/></filter>
    </defs>
    <rect width="${W}" height="720" fill="url(#fade)"/>
    <rect x="58" y="58" width="300" height="58" rx="29" fill="#ffffff" fill-opacity="0.78" filter="url(#shadow)"/>
    <text x="91" y="90" font-family="Helvetica Neue, Arial, sans-serif" font-size="34" font-weight="700" fill="#101820">FatHopes</text>
    <text x="93" y="111" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="4" fill="#4bad51">ENERGY</text>
    <text x="58" y="176" font-family="Helvetica Neue, Arial, sans-serif" font-size="27" font-weight="600" fill="#101820" letter-spacing="1">PROGRAM PUSH</text>
    ${lines(job.headline, 58, 260, 65, "#101820", 700, 1.05)}
    ${lines(job.subline, 58, 455, 36, "#101820", 500, 1.15)}
    <rect x="58" y="525" width="887" height="225" rx="32" fill="#ffffff" fill-opacity="0.90" filter="url(#shadow)"/>
    <text x="91" y="570" font-family="Helvetica Neue, Arial, sans-serif" font-size="27" font-weight="700" letter-spacing="3" fill="#4bad51">JOB DESC</text>
    ${lines(job.desc.map((d) => `•  ${d}`), 91, 626, 27, "#101820", 500, 1.55)}
    <rect x="58" y="1175" width="430" height="96" rx="48" fill="#56bd4d" filter="url(#shadow)"/>
    <text x="93" y="1235" font-family="Helvetica Neue, Arial, sans-serif" font-size="31" font-weight="700" fill="#ffffff">MOHON SEKARANG</text>
    <text x="58" y="1345" font-family="Helvetica Neue, Arial, sans-serif" font-size="21" font-weight="500" fill="#ffffff">Usahawan, bukan kerja bergaji tetap</text>
    <text x="58" y="1402" font-family="Helvetica Neue, Arial, sans-serif" font-size="31" font-weight="700" fill="#ffffff">Seluruh Malaysia</text>
    <rect x="0" y="1500" width="${W}" height="68" fill="#0d5b3c" fill-opacity="0.94"/>
    <text x="58" y="1543" font-family="Helvetica Neue, Arial, sans-serif" font-size="23" font-weight="600" fill="#ffffff">Kutip minyak masak terpakai. Bina nilai baharu.</text>
  </svg>`;
}

await fs.mkdir(OUT, { recursive: true });
for (const job of jobs) {
  const input = path.join(ROOT, "FatHopes IMG", "poster-refs", job.src);
  await sharp(input).resize(W, H, { fit: "cover", position: "attention" }).composite([{ input: Buffer.from(overlay(job)) }]).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toFile(path.join(OUT, job.out));
}
console.log(`Created ${jobs.length} real-background PUSH posters in ${OUT}`);
