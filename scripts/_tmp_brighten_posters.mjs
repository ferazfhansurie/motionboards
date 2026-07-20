// Brighten the 8 final posters (feed + story) without touching the originals.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = "/Users/faeez/motionboards/Hyperwrapz & Detailing/_gen";
const SETS = ["posters", "posters-story"];
const FILES = ["01-wrap.png", "02-ppf.png", "03-tint.png", "04-coating.png"];

async function safePath(p) {
  try { await fs.access(p); } catch { return p; }
  const ext = path.extname(p);
  const base = p.slice(0, -ext.length);
  for (let n = 2; ; n++) {
    const candidate = `${base}-v${n}${ext}`;
    try { await fs.access(candidate); } catch { return candidate; }
  }
}

async function main() {
  for (const set of SETS) {
    const outDir = path.join(DIR, `${set}-bright`);
    await fs.mkdir(outDir, { recursive: true });
    for (const file of FILES) {
      const inPath = path.join(DIR, set, file);
      const outPath = await safePath(path.join(outDir, file));
      await sharp(inPath)
        // lift shadows (linear a*x+b) then a mild overall brightness/gamma boost
        .linear(1.18, 22)
        .modulate({ brightness: 1.12 })
        .gamma(1.05)
        .toFile(outPath);
      console.log(`brightened ${set}/${file} -> ${path.relative(DIR, outPath)}`);
    }
  }
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
