// Composites exact, readable PUSH copy over the AI-generated visual plates.
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const DIR = path.join(ROOT, "FatHopes IMG", "push-chip-tier-infographics");
const BG = path.join(DIR, "backgrounds");
const W = 1080, H = 1920, GREEN = "#B6D941", AQUA = "#7FD6CE", WHITE = "#F8FAFC", MUTED = "#C8D1D0";
const TYPE_SCALE = 1.3;
const SMALL_TEXT_SCALE = 1.3;
const logoB64 = (await fs.readFile(path.join(ROOT, "FatHopes IMG", "poster-refs", "LOGO-mark.png"))).toString("base64");

function esc(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function text(value, x, y, size, weight = 600, fill = WHITE, extra = "") {
  const scale = size <= 31 ? TYPE_SCALE * SMALL_TEXT_SCALE : TYPE_SCALE;
  return `<text x="${x}" y="${y}" font-family="Helvetica Neue,Arial,sans-serif" font-size="${Math.round(size * scale)}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(value)}</text>`;
}
function brand() {
  return `<image href="data:image/png;base64,${logoB64}" x="64" y="82" width="56" height="52" preserveAspectRatio="xMidYMid meet"/>
  ${text("FatHopes", 132, 115, 30, 800)}${text("ENERGY", 134, 141, 13, 800, GREEN, 'letter-spacing="4"')}`;
}
function svgOverview() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${brand()}
  ${text("PROGRAM PUSH", 64, 250, 28, 800, GREEN, 'letter-spacing="3"')}
  ${text("JADIKAN ROUTE", 64, 370, 72, 800)}${text("SATU PELUANG.", 64, 454, 72, 800, AQUA)}
  ${text("Kutip minyak masak terpakai.", 64, 544, 34, 600, MUTED)}${text("Urus laluan sendiri.", 64, 600, 34, 600, MUTED)}
  <rect x="64" y="640" width="840" height="150" rx="44" fill="#FFFFFF" fill-opacity="0.12" stroke="#B6D941" stroke-opacity="0.6"/>
  ${text("Beli dan kutip", 96, 700, 27, 700)}
  ${text("minyak masak terpakai", 96, 755, 27, 700)}
  </svg>`;
}
function svgJob() {
  const card = (y, n, title, sub, detail = "") => {
    const lines = Array.isArray(sub) ? sub : [sub];
    return `<circle cx="190" cy="${y - 26}" r="31" fill="#B6D941"/>${text(n, 179, y - 14, 26, 800, "#122022")}${text(title, 270, y - 18, 38, 800)}${lines.map((line, index) => text(line, 270, y + 34 + index * 54, 27, 600, MUTED)).join("")}${detail ? text(detail, 270, y + 34 + lines.length * 54, 23, 800, GREEN, 'letter-spacing="1"') : ""}`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${brand()}
  ${text("PROGRAM PUSH", 64, 250, 28, 800, GREEN, 'letter-spacing="3"')}${text("APA YANG", 64, 362, 72, 800)}${text("KORANG BUAT?", 64, 447, 72, 800, AQUA)}
  ${text("Bina laluan kutipan sendiri", 64, 522, 29, 600, MUTED)}
  ${text("dengan sokongan operasi FatHopes.", 64, 570, 29, 600, MUTED)}
  ${card(900, "1", "KUTIP", ["Ambil minyak masak", "terpakai dari premis."])}
  ${card(1220, "2", "URUS LALUAN", ["Susun kawasan dan jadual", "kutipan sendiri."])}
  ${card(1532, "3", "HANTAR", ["Hantar kutipan ke point", "yang ditetapkan."], "GUNA KENDERAAN SENDIRI")}</svg>`;
}
function tier(y, name, range, rate, commission, accent) {
  const last = name === "TIER 3";
  const rateY = last ? y + 110 : y + 58;
  const commissionY = last ? y + 153 : y + 102;
  const exampleY = last ? y + 196 : y + 145;
  return `${text(name, 112, y, 28, 800, accent, 'letter-spacing="2"')}${text(range, 112, y + 58, 36, 700)}${text(rate, 790, rateY, 36, 800, accent, 'text-anchor="end"')}${text("+ KOMISEN", 112, commissionY, 23, 800, MUTED, 'letter-spacing="1"')}${text(commission, 112, exampleY, 34, 700, WHITE)}`;
}
function svgTier() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${brand()}
  ${text("OPTION 4", 64, 220, 28, 800, GREEN, 'letter-spacing="3"')}${text("COLLECTION", 64, 315, 64, 800)}${text("CHIP TIER", 64, 390, 64, 800, AQUA)}
  ${text("Lagi banyak chip, lagi tinggi", 64, 455, 29, 600, MUTED)}
  ${text("nilai setiap chip.", 64, 510, 29, 600, MUTED)}
  ${tier(725, "TIER 1", "1 - 10 CHIP", "RM5 / CHIP", "100 kg per round x RM0.10 = RM10", "#8CE3D7")}
  ${tier(1080, "TIER 2", "11 - 20 CHIP", "RM8 / CHIP", "100 kg per round x RM0.15 = RM15", "#A9D957")}
  ${tier(1480, "TIER 3", "21 CHIP KE ATAS", "RM10 / CHIP", "100 kg per round x RM0.20 = RM20", "#D6E848")}
  ${text("KOMISEN IKUT BERAT KUTIPAN", 64, 1850, 31, 800, WHITE)}</svg>`;
}
function svgCta() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${brand()}
  ${text("PROGRAM PUSH", 64, 250, 28, 800, GREEN, 'letter-spacing="3"')}${text("NAK BINA", 64, 370, 70, 800)}${text("INCOME", 64, 453, 70, 800)}${text("SENDIRI?", 64, 536, 70, 800, AQUA)}
  ${text("Mulakan dengan laluan kutipan", 112, 685, 29, 600, MUTED)}
  ${text("yang korang urus sendiri.", 112, 735, 29, 600, MUTED)}
  <rect x="112" y="800" width="820" height="124" rx="26" fill="#B6D941"/>${text("DAFTAR MINAT SEKARANG", 148, 880, 34, 800, "#122022")}
  ${text("Latihan dan sokongan", 112, 1015, 28, 650)}
  ${text("operasi disediakan.", 112, 1070, 28, 650)}
  ${text("Usahawan, bukan kerja gaji tetap.", 112, 1140, 26, 600, MUTED)}
  </svg>`;
}

const files = [
  ["01-program-push-overview.png", "01-overview-bg.png", svgOverview],
  ["02-job-description.png", "02-job-desc-bg.png", svgJob],
  ["03-collection-chip-tier.png", "03-tier-bg.png", svgTier],
  ["04-register-interest.png", "04-cta-bg.png", svgCta],
];
for (const [out, bg, make] of files) {
  await sharp(path.join(BG, bg)).resize(W, H, { fit: "cover" }).composite([{ input: Buffer.from(make()) }]).png().toFile(path.join(DIR, out));
}
console.log(`Created ${files.length} PUSH chip-tier infographics in ${DIR}`);
