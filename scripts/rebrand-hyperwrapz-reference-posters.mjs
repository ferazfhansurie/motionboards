// Rebrand the supplied Atmos Shield layouts for Hyperwrapz & Detailing while
// preserving their pricing grids, vehicle art, and editorial composition.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const DIR = path.join(ROOT, "Hyperwrapz & Detailing");
const OUT = path.join(DIR, "_gen", "reference-rebrand");
const LOGO = path.join(DIR, "_gen", "HYPERWRAPZ-LOGO-cutout.png");

const files = [
  ["Color Wrapping.jpeg", "colour-wrapping-hyperwrapz.jpeg", "colour"],
  ["PPF and Coating.jpeg", "ppf-coating-hyperwrapz.jpeg", "ppf"],
  ["Tinting.jpeg", "tinting-hyperwrapz.jpeg", "tint"],
];

function svg(w, h, kind) {
  const header = kind === "ppf"
    ? `<rect x="0" y="0" width="830" height="300" fill="#05080d" fill-opacity="0.98"/>`
    : `<rect x="0" y="0" width="560" height="270" fill="#05080d" fill-opacity="0.98"/>`;
  const footerSize = Math.min(27, Math.floor(w / 34));
  const footer = `<rect x="0" y="${h - 112}" width="${w}" height="112" fill="#05080d" fill-opacity="0.96"/><text x="${w / 2}" y="${h - 58}" fill="#f6f8fa" font-family="Arial, sans-serif" font-size="${footerSize}px" font-weight="800" text-anchor="middle" letter-spacing="1">HYPERWRAPZ &amp; DETAILING  |  KLANG  |  011-6188 4476</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${header}${footer}</svg>`;
}

await fs.mkdir(OUT, { recursive: true });
for (const [inputName, outputName, kind] of files) {
  const input = path.join(DIR, inputName);
  const meta = await sharp(input).metadata();
  const w = meta.width;
  const h = meta.height;
  const logoWidth = kind === "ppf" ? 420 : 360;
  const logo = await sharp(LOGO).resize({ width: logoWidth, height: 230, fit: "contain" }).png().toBuffer();
  const logoLeft = kind === "ppf" ? 70 : 40;
  const logoTop = 22;
  const output = path.join(OUT, outputName);
  await sharp(input)
    .composite([
      { input: Buffer.from(svg(w, h, kind)) },
      { input: logo, left: logoLeft, top: logoTop },
    ])
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toFile(output);
  console.log(`saved ${path.relative(ROOT, output)}`);
}
