// 15s PUSH recruitment infographic: real FatHopes photos + motion-graphic copy.
// AIDOCAC flow: Attention → Interest → Desire → Offer → Credential → Action → Close.
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const ROOT = "/Users/faeez/motionboards";
const REF = path.join(ROOT, "FatHopes IMG", "poster-refs");
const OUT = path.join(ROOT, "FatHopes IMG", "push-recruitment-infographic");
const W = 1080, H = 1920, GREEN = "#56BD4D", INK = "#101820";
const DURATION = 3.24, FADE = 0.3;

const scenes = [
  {
    image: "PUSH-2_hero_tanker.jpg", file: "01-attention.png",
    tag: "PROGRAM PUSH", kicker: "KENDERAAN BOLEH", accent: "JADI PELUANG.",
    body: "Bukan sekadar bawa dari A ke B.", stage: "A · ATTENTION",
  },
  {
    image: "PUSH-3_hero_worker-oil.jpg", file: "02-interest.png",
    tag: "MINYAK TERPAKAI", kicker: "ADA NILAI", accent: "BILA DIURUS BETUL.",
    body: "Kutip dari premis. Urus laluan sendiri.", stage: "I · INTEREST",
  },
  {
    image: "PUSH-4_hero_newtanker.jpg", file: "03-desire.png",
    tag: "USAHA SENDIRI", kicker: "BINA PENDAPATAN", accent: "IKUT USAHA.",
    body: "Kerja aktif dengan masa yang lebih fleksibel.", stage: "D · DESIRE",
  },
  {
    image: "PUSH-5_hero_team-newtanker.jpg", file: "04-offer-proof.png",
    tag: "PROGRAM PUSH", kicker: "LATIHAN + SOKONGAN", accent: "UNTUK MULAKAN.",
    body: "Dari langkah pertama sampai operasi harian.", stage: "O + C · OFFER + CREDENTIAL",
  },
  {
    image: "PUSH-1_hero_faizull.jpg", file: "05-action.png",
    tag: "PERMOHONAN KINI DIBUKA", kicker: "MULA DENGAN", accent: "SATU LANGKAH.",
    body: "Usahawan, bukan kerja bergaji tetap.", stage: "A + C · ACTION + CLOSE",
    cta: "MOHON SEKARANG",
  },
];

function esc(v) { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function text(v, x, y, size, weight = 700, fill = INK, attrs = "") {
  return `<text x="${x}" y="${y}" font-family="Helvetica Neue,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" ${attrs}>${esc(v)}</text>`;
}

function overlay(scene) {
  const cta = scene.cta ? `<rect x="72" y="1415" width="554" height="120" rx="22" fill="${GREEN}"/><text x="112" y="1494" font-family="Helvetica Neue,Arial,sans-serif" font-size="45" font-weight="800" fill="#fff">${scene.cta}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F8FAFC" stop-opacity="0.98"/>
        <stop offset="0.58" stop-color="#F8FAFC" stop-opacity="0.91"/>
        <stop offset="0.78" stop-color="#F8FAFC" stop-opacity="0.30"/>
        <stop offset="1" stop-color="#101820" stop-opacity="0.06"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#fade)"/>
    <image href="data:image/png;base64,${logoB64}" x="72" y="68" width="66" height="61" preserveAspectRatio="xMidYMid meet"/>
    ${text("FatHopes", 151, 106, 35, 800)}
    ${text("ENERGY", 153, 136, 15, 800, GREEN, 'letter-spacing="4"')}
    ${text(scene.tag, 72, 260, 27, 800, GREEN, 'letter-spacing="2"')}
    ${text(scene.kicker, 72, 434, 72, 800, INK, 'letter-spacing="-1"')}
    ${text(scene.accent, 72, 522, 72, 800, GREEN, 'letter-spacing="-1"')}
    ${text(scene.body, 72, 642, 37, 650, INK)}
    <line x1="72" y1="714" x2="1008" y2="714" stroke="#7E878E" stroke-width="2"/>
    <rect x="72" y="760" width="836" height="82" rx="41" fill="#fff" fill-opacity="0.90"/>
    <image href="data:image/png;base64,${oilIconB64}" x="91" y="773" width="66" height="50" preserveAspectRatio="xMidYMid meet"/>
    ${text("Beli dan kutip minyak masak terpakai", 174, 814, 29, 700, INK)}
    ${cta}
  </svg>`;
}

const logoB64 = (await fs.readFile(path.join(REF, "LOGO-mark.png"))).toString("base64");
const oilIconB64 = (await sharp(path.join(ROOT, "FatHopes IMG", "push-posters-jobdesc", "pandu_team.png"))
  .extract({ left: 145, top: 930, width: 105, height: 80 }).png().toBuffer()).toString("base64");

await fs.mkdir(OUT, { recursive: true });
for (const scene of scenes) {
  await sharp(path.join(REF, scene.image))
    .resize(W, H, { fit: "cover", position: "attention" })
    .composite([{ input: Buffer.from(overlay(scene)) }])
    .png()
    .toFile(path.join(OUT, scene.file));
}

const frameInputs = scenes.flatMap((s) => ["-loop", "1", "-t", String(DURATION), "-i", path.join(OUT, s.file)]);
const labels = scenes.map((_, i) => `[${i}:v]fps=30,format=yuv420p,settb=AVTB[v${i}]`).join(";");
let current = "[v0]";
let offset = DURATION - FADE;
const xfade = [];
for (let i = 1; i < scenes.length; i++) {
  const next = i === scenes.length - 1 ? "[outv]" : `[x${i}]`;
  xfade.push(`${current}[v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}${next}`);
  current = next;
  offset += DURATION - FADE;
}
const video = path.join(OUT, "push-recruitment-aidocac-15s.mp4");
await execFile("ffmpeg", ["-y", ...frameInputs, "-filter_complex", `${labels};${xfade.join(";")}`, "-map", "[outv]", "-t", "15", "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video], { maxBuffer: 1024 * 1024 * 2 });
console.log(`Created ${video}`);
