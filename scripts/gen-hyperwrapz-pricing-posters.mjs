// Rebuild the pricing creatives using the existing Hyperwrapz dark automotive
// poster backgrounds, with exact copy composited as crisp vector text.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const DIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen");
const OUT = path.join(DIR, "pricing");
const W = 1792;
const H = 2400;
const WHITE = "#f7fafb";
const CYAN = "#18b9ff";
const PANEL = "#071116";

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function text(x, y, value, size, opts = {}) {
  const { fill = WHITE, weight = 700, anchor = "start", family = "Arial", letter = 0 } = opts;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}px" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letter}px">${esc(value)}</text>`;
}
function rect(x, y, w, h, fill = PANEL, radius = 22, stroke = "none", sw = 0, opacity = 0.94) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${sw}"/>`;
}
function bar(x, y, w) { return `<rect x="${x}" y="${y}" width="${w}" height="10" rx="5" fill="${CYAN}"/>`; }
function card(x, y, w, h, lines, priceLines = []) {
  let s = rect(x, y, w, h, PANEL, 24, "#1b3743", 3, 0.94);
  lines.forEach((line, i) => { s += text(x + 24, y + 48 + i * 38, line, i === 0 ? 30 : 25, { weight: i === 0 ? 900 : 600 }); });
  priceLines.forEach((line, i) => { s += text(x + 24, y + h - 32 - (priceLines.length - 1 - i) * 38, line, 32, { fill: CYAN, weight: 900 }); });
  return s;
}
function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`;
}

async function make(name, baseName, body) {
  const base = await sharp(path.join(DIR, baseName)).resize(W, H).modulate({ brightness: 0.78, saturation: 0.95 }).png().toBuffer();
  const overlay = Buffer.from(svg(body));
  await sharp(base).composite([{ input: overlay }]).png().toFile(path.join(OUT, name));
  console.log(`saved ${path.relative(ROOT, path.join(OUT, name))}`);
}

await fs.mkdir(OUT, { recursive: true });

await make("colour-wrap-pricing.png", "bg/bg-04-wide-studio.png", [
  rect(28, 28, 1736, 420, "#061016", 0, "none", 0, 0.96),
  bar(90, 370, 190),
  text(90, 470, "COLOUR CHANGE WRAP", 54, { fill: CYAN, weight: 900, letter: 3 }),
  text(90, 555, "TUKAR WARNA KERETA, TANPA CAT SEMULA", 58, { weight: 900 }),
  text(90, 610, "Protect original paint | Scratch resistant | UV protection | Easy maintenance", 25, { weight: 600 }),
  text(90, 650, "Enhance look | Remove without damaging paint", 25, { weight: 600 }),
  rect(70, 700, 1652, 520, "#061016", 28, "#214654", 3, 0.96),
  text(100, 770, "VINYL BRAND PRICING", 38, { fill: CYAN, weight: 900, letter: 2 }),
  card(100, 805, 760, 170, ["NEXTFEEL"], ["RM 2900"]),
  card(900, 805, 720, 170, ["ATMOS SHIELD"], ["RM 3500"]),
  card(100, 1000, 760, 170, ["NAKA"], ["RM 3800"]),
  card(900, 1000, 720, 170, ["TECKWRAP"], ["RM 3800"]),
  text(100, 1315, "OPTIONS & FEATURES", 38, { fill: CYAN, weight: 900, letter: 2 }),
  rect(70, 1350, 1652, 470, "#061016", 28, "#214654", 3, 0.96),
  text(105, 1425, "3000+ COLOURS AVAILABLE", 42, { weight: 900 }),
  text(105, 1495, "Finishes: Matte | Satin | Satin Metallic | Ultra Gloss", 28, { weight: 700 }),
  text(105, 1540, "Gloss Metallic | Chrome Colours", 28, { weight: 700 }),
  text(105, 1625, "Full Design and Inject Printing available", 32, { weight: 800 }),
  text(105, 1715, "Experienced team | Premium quality vinyl | Professional installation", 24, { weight: 600 }),
  text(105, 1755, "Long lasting durability | After sales support", 24, { weight: 600 }),
  text(896, 1945, "TUKAR LOOK. STYLE TERJAGA.", 42, { weight: 900, anchor: "middle" }),
  text(896, 2025, "KLANG  |  WHATSAPP 011-6188 4476  |  @HYPERWRAPZ", 26, { weight: 800, anchor: "middle", fill: CYAN }),
].join(""));

await make("ppf-coating-pricing.png", "bg/bg-03-sport-black.png", [
  rect(28, 28, 1736, 420, "#061016", 0, "none", 0, 0.96),
  bar(90, 370, 190),
  text(90, 470, "PPF | COATING | COMBOS", 52, { fill: CYAN, weight: 900, letter: 3 }),
  text(90, 555, "PROTECT WHAT MATTERS", 68, { weight: 900 }),
  text(90, 615, "Premium protection | Advanced technology | Lasting excellence", 29, { weight: 700 }),
  text(90, 665, "Premium quality | Professional installation | Warranty assured", 29, { weight: 700 }),
  text(100, 745, "INDIVIDUAL SERVICES", 38, { fill: CYAN, weight: 900, letter: 2 }),
  card(80, 780, 790, 180, ["TINTED", "Sputtering HD"], ["RM 1200"]),
  card(920, 780, 790, 180, ["COATING", "Graphene 10H"], ["RM 1200"]),
  card(80, 990, 790, 180, ["FULL FRONT PPF", "8.5MIL"], ["RM 1900"]),
  card(920, 990, 790, 180, ["FULL CAR PPF", "8.5MIL"], ["RM 3800"]),
  text(100, 1260, "COMBO PACKAGES", 38, { fill: CYAN, weight: 900, letter: 2 }),
  rect(70, 1295, 1652, 540, "#061016", 28, "#214654", 3, 0.96),
  text(105, 1375, "3 IN 1 COMBO LITE", 44, { weight: 900 }),
  text(1620, 1375, "RM 4800", 42, { fill: CYAN, weight: 900, anchor: "end" }),
  text(125, 1435, "Full Front PPF (8.5MIL)", 28, { weight: 700 }),
  text(125, 1478, "Full Car Tinted (Sputtering HD)", 28, { weight: 700 }),
  text(125, 1521, "Full Car Coating (Graphene 10H)", 28, { weight: 700 }),
  `<line x1="105" y1="1570" x2="1685" y2="1570" stroke="#214654" stroke-width="3"/>`,
  text(105, 1645, "3 IN 1 COMBO ULTRA", 44, { weight: 900 }),
  text(1620, 1645, "RM 5800", 42, { fill: CYAN, weight: 900, anchor: "end" }),
  text(125, 1705, "Full Car PPF (8.5MIL)", 28, { weight: 700 }),
  text(125, 1748, "Full Car Tinted (Royal Titanium HD)", 28, { weight: 700 }),
  text(125, 1791, "Full Car Coating (Graphene 10H)", 28, { weight: 700 }),
  text(896, 1945, "JAGA KERETA KAU. SETIAP DRIVE JADI PUAS.", 36, { weight: 900, anchor: "middle" }),
  text(896, 2025, "KLANG  |  WHATSAPP 011-6188 4476  |  @HYPERWRAPZ", 26, { weight: 800, anchor: "middle", fill: CYAN }),
].join(""));

await make("window-film-pricing.png", "bg/bg-02-sedan-grey.png", [
  rect(28, 28, 1736, 420, "#061016", 0, "none", 0, 0.96),
  bar(90, 370, 190),
  text(90, 470, "PREMIUM WINDOW FILM", 52, { fill: CYAN, weight: 900, letter: 3 }),
  text(90, 555, "TINT KERETA - TAK PANAS, TAK SILAU", 58, { weight: 900 }),
  text(90, 620, "High heat rejection | Excellent UV protection | Enhanced privacy", 28, { weight: 700 }),
  text(90, 665, "Crystal clear visibility | Durable and long lasting", 28, { weight: 700 }),
  text(100, 745, "TINT PACKAGE TIERS & PRICING", 38, { fill: CYAN, weight: 900, letter: 2 }),
  card(70, 780, 1652, 330, ["NANO CARBON CERAMIC HD", "IRR 95% | UVR 97% | VLT 30% / 50% / 80% / 95%", "Thickness 2Mil | Warranty 5 years workmanship + 5 years colour"], ["SMALL RM 850   |   MEDIUM RM 1000   |   LARGE RM 1150"]),
  card(70, 1140, 1652, 330, ["ULTRA SPUTTERING HD", "IRR 97% | UVR 99% | VLT 30% / 50% / 80% / 95%", "Thickness 4Mil | Warranty 5 years workmanship + 5 years colour"], ["SMALL RM 1300   |   MEDIUM RM 1500   |   LARGE RM 1700"]),
  card(70, 1500, 1652, 330, ["ROYAL TITANIUM HD+", "IRR 99% | UVR 99% | VLT 30% / 50% / 80% / 95%", "Thickness 4Mil+ | Warranty 10 years workmanship + 10 years colour"], ["SMALL RM 1500   |   MEDIUM RM 1700   |   LARGE RM 2000"]),
  text(896, 1930, "Blocks extreme heat | Protects skin & interior | Comfort & privacy", 27, { weight: 800, anchor: "middle" }),
  text(896, 1980, "Fade resistant & durable | Premium quality window film", 27, { weight: 800, anchor: "middle" }),
  text(896, 2070, "DRIVE SEJUK. HATI PUN TENANG.", 42, { weight: 900, anchor: "middle" }),
  text(896, 2145, "KLANG  |  WHATSAPP 011-6188 4476  |  @HYPERWRAPZ", 26, { weight: 800, anchor: "middle", fill: CYAN }),
].join(""));

// Apply the real logo last so it is not redrawn or corrupted by the poster art.
const logoPath = path.join(DIR, "HYPERWRAPZ-LOGO-cutout.png");
for (const name of ["colour-wrap-pricing.png", "ppf-coating-pricing.png", "window-film-pricing.png"]) {
  const output = path.join(OUT, name);
  const logo = await sharp(logoPath).resize({ width: 330, height: 330, fit: "contain" }).png().toBuffer();
  const base = await sharp(output);
  await base.composite([{ input: logo, left: Math.round((W - 330) / 2), top: 68 }]).png().toFile(`${output}.tmp.png`);
  await fs.rename(`${output}.tmp.png`, output);
}
