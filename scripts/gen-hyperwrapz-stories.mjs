// Create Instagram/Story 9:16 versions from the approved 4:5 poster set.
// The poster itself stays pixel-accurate; the surrounding canvas is a subtle,
// blurred extension of that same artwork for a cohesive story composition.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const POSTER_DIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "posters");
const OUT_DIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "stories");
const W = 1080;
const H = 1920;
const posters = [
  ["01-wrap", "01-wrap-story"],
  ["02-ppf", "02-ppf-story"],
  ["03-tint", "03-tint-story"],
  ["04-coating", "04-coating-story"],
];

await fs.mkdir(OUT_DIR, { recursive: true });

for (const [inputName, outputName] of posters) {
  const input = path.join(POSTER_DIR, `${inputName}.png`);
  const output = path.join(OUT_DIR, `${outputName}.png`);
  const poster = sharp(input);
  const meta = await poster.metadata();
  const posterW = W;
  const posterH = Math.round((meta.height / meta.width) * posterW);
  const top = Math.round((H - posterH) / 2);

  // Full-bleed, blurred backdrop derived from the same poster.
  const backdrop = await sharp(input)
    .resize(W, H, { fit: "cover" })
    .blur(28)
    .modulate({ brightness: 0.43, saturation: 0.82 })
    .png()
    .toBuffer();

  // A restrained dark veil improves contrast at the story edges while keeping
  // the poster's original colors and logo untouched.
  const veil = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#05090b" fill-opacity="0.22"/></svg>`
  );

  await sharp(backdrop)
    .composite([
      { input: veil },
      { input: await poster.resize(posterW, posterH).png().toBuffer(), top, left: 0 },
    ])
    .png()
    .toFile(output);

  console.log(`saved ${path.relative(ROOT, output)} (${W}x${H})`);
}
