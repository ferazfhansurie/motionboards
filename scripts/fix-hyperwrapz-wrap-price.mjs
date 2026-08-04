import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const src = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "posters-story-bigtext", "01-wrap.png");
const out = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "posters-story-bigtext", "01-wrap-rm2200.png");
const svg = `<svg width="1536" height="2752" xmlns="http://www.w3.org/2000/svg">
  <rect x="1080" y="1935" width="400" height="165" fill="#0a1115" fill-opacity="0.96"/>
  <text x="1450" y="2060" fill="#18b9ff" font-family="Arial Narrow, Arial, sans-serif" font-size="112px" font-weight="900" text-anchor="end">RM2200</text>
</svg>`;
await fs.mkdir(path.dirname(out), { recursive: true });
await sharp(src).composite([{ input: Buffer.from(svg) }]).png().toFile(out);
console.log(out);
