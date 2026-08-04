import path from "node:path";
import sharp from "sharp";

const root = "/Users/faeez/motionboards/FatHopes IMG/push-carousel-identify-collector-nb2";
const tag = process.env.TAG || "flow";
const tags = (process.env.TAGS || "").split(",").map((value) => value.trim()).filter(Boolean);
const names = [
  "01-01-cover",
  "02-02-uniform-front",
  "03-03-uniform-back",
  "04-04-vendor-app",
  "05-05-mini-tanker",
  "06-06-verified",
  "07-07-case-closed",
].map((name, index) => `${name}-${tags[index] || tag}.png`);
const width = 432;
const images = await Promise.all(names.map(async (name) => {
  const image = await sharp(path.join(root, name)).resize({ width }).png().toBuffer();
  return { input: image };
}));
const metadata = await sharp(images[0].input).metadata();
const output = path.join(root, `PUSH-collector-${tags.length ? "final-system" : tag}-mural.png`);
await sharp({
  create: {
    width: width * images.length,
    height: metadata.height,
    channels: 4,
    background: "#071d16",
  },
}).composite(images.map((image, index) => ({ ...image, left: index * width, top: 0 }))).png().toFile(output);
console.log(output);
