// Recreate the Claude-era PUSH poster treatment without image generation.
// Real hero photos stay intact; only typography and the supplied logo are composited.
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const REF = path.join(ROOT, "FatHopes IMG", "poster-refs");
const OUT = path.join(ROOT, "FatHopes IMG", "push-posters-claude-exact");
const W = 1080;
const H = 1920;

const jobs = [
  {
    src: "PUSH-1_hero_faizull.jpg",
    out: "01-jadi-bos-diri-sendiri.jpg",
    headline: ["Jadi Bos", "Diri Sendiri."],
    sub: "Kerja sendiri, duit pun korang punya.",
    location: "Lembah Klang",
    lightText: false,
  },
  {
    src: "PUSH-2_hero_tanker.jpg",
    out: "02-pandu-kutip-untung.jpg",
    headline: ["Pandu. Kutip.", "Untung."],
    sub: "Join team yang tengah naik.",
    location: "Subang · Puchong · Putrajaya",
    lightText: false,
  },
  {
    src: "PUSH-3_hero_worker-oil.jpg",
    out: "03-bos-menyampah.jpg",
    headline: ["BOS MENYAMPAH?", "JADI BOS SENDIRI LA."],
    sub: "Takde meeting pagi Isnin. Korang dengan jalan je.",
    location: "Area Banting, Jenjarom & Sepang",
    lightText: true,
  },
  {
    src: "PUSH-4_hero_newtanker.jpg",
    out: "04-gaji-tu-itu-je.jpg",
    headline: ["GAJI TU ITU JE", "TIAP BULAN?"],
    sub: "Buat kerjaya hijau, duit pun lumayan kot.",
    location: "Khas untuk korang Seremban & N9",
    lightText: false,
  },
];

function esc(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function text(s, x, y, size, fill, weight = 600, extra = "") {
  return `<text x="${x}" y="${y}" font-family="Helvetica Neue,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(s)}</text>`;
}

function overlay(job) {
  const ink = job.lightText ? "#FFFFFF" : "#101820";
  const accent = "#4BAD51";
  const headlineSize = job.headline.some((s) => s.length > 23) ? 58 : 78;
  const headline = job.headline.map((line, i) => text(line, 72, 390 + i * (headlineSize + 8), headlineSize, ink, 750, 'letter-spacing="-1"')).join("");
  const subY = 390 + job.headline.length * (headlineSize + 8) + 40;
  const locY = subY + 108;
  const pillY = locY + 62;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${text("FatHopes", 132, 112, 37, ink, 750)}
    ${text("ENERGY", 134, 140, 16, accent, 750, 'letter-spacing="4"')}
    <image href="data:image/png;base64,${logoB64}" x="72" y="70" width="48" height="48" preserveAspectRatio="xMidYMid meet"/>
    ${text("PROGRAM PUSH", 72, 230, 28, accent, 750, 'letter-spacing="2"')}
    ${headline}
    ${text(job.sub, 72, subY, 32, ink, 520)}
    ${text(job.location, 72, locY, 25, ink, 650)}
    <rect x="72" y="${pillY}" width="610" height="64" rx="32" fill="${accent}"/>
    ${text("Beli dan kutip minyak masak terpakai", 102, pillY + 42, 23, "#FFFFFF", 700)}
    ${text("Mohon Sekarang", 72, pillY + 128, 27, accent, 750, 'letter-spacing="1"')}
  </svg>`;
}

const logoB64 = (await fs.readFile(path.join(REF, "LOGO-mark.png"))).toString("base64");
await fs.mkdir(OUT, { recursive: true });
for (const job of jobs) {
  const input = path.join(REF, job.src);
  await sharp(input)
    .resize(W, H, { fit: "cover", position: "attention" })
    .composite([{ input: Buffer.from(overlay(job)) }])
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toFile(path.join(OUT, job.out));
}
console.log(`Created ${jobs.length} locked-photo PUSH posters in ${OUT}`);
