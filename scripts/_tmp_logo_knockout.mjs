// Knock out the dark baked background of the HyperWrapz JPEG logo -> transparent
// PNG cutout, so it composites seamlessly (no visible rectangle) onto a dark band.
import sharp from "sharp";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const DIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen");
const LOGO = path.join(DIR, "HYPERWRAPZ LOGO.jpeg");
const CUTOUT = path.join(DIR, "HYPERWRAPZ-LOGO-cutout.png");

// smoothstep
const ss = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

async function makeCutout() {
  const { data, info } = await sharp(LOGO).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0, o = 0; i < data.length; i += c, o += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // dark bg -> transparent, logo (bright/glow) -> opaque, soft feather between
    const a = ss(16, 62, lum);
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = Math.round(a * 255);
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 2 }) // crop fully-transparent border
    .png()
    .toFile(CUTOUT);
  const m = await sharp(CUTOUT).metadata();
  console.log(`cutout: ${CUTOUT} (${m.width}x${m.height})`);
}

// test composite onto the colour-wrap-ms raw, centered in the dark top band
async function testComposite() {
  const raw = path.join(DIR, "colour-wrap-ms-v2-raw.png");
  const bg = sharp(raw);
  const meta = await bg.metadata();
  const W = meta.width, H = meta.height;
  const bandH = Math.round(H * 0.14);
  const cut = sharp(CUTOUT);
  const cm = await cut.metadata();
  const scaleByH = (bandH * 0.82) / cm.height;
  const scaleByW = (W * 0.5) / cm.width;
  const scale = Math.min(scaleByH, scaleByW);
  const tw = Math.round(cm.width * scale), th = Math.round(cm.height * scale);
  const buf = await cut.resize(tw, th).png().toBuffer();
  const left = Math.round((W - tw) / 2);
  const top = Math.max(10, Math.round((bandH - th) / 2));
  await bg.composite([{ input: buf, left, top }]).toFile(path.join(DIR, "_test-seamless.png"));
  console.log("test written: _test-seamless.png");
}

await makeCutout();
await testComposite();
