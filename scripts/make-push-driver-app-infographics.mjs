import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = '/Users/faeez/motionboards';
const assets = path.join(root, 'FatHopes IMG/push-driver-app-infographics');
const backgrounds = path.join(assets, 'backgrounds');
const logoPath = path.join(root, 'FatHopes IMG/push-posters-real-jobdesc/1784620818511_zryfts_image.png');
const teamCutoutPath = path.join(assets, 'sources/PUX09161-team-cutout-white.png');
const W = 1080;
const H = 1920;

const svg = (body) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>
    .eyebrow { font-family: Arial, Helvetica, sans-serif; font-size: 36px; font-weight: 700; letter-spacing: 4px; fill: #98bd1e; }
    .hero { font-family: Arial, Helvetica, sans-serif; font-size: 88px; font-weight: 800; letter-spacing: -2px; fill: #15191d; }
    .hero-aqua { font-family: Arial, Helvetica, sans-serif; font-size: 88px; font-weight: 800; letter-spacing: -2px; fill: #48bdb8; }
    .support { font-family: Arial, Helvetica, sans-serif; font-size: 42px; font-weight: 500; letter-spacing: -0.5px; fill: #4f5a60; }
    .cta { font-family: Arial, Helvetica, sans-serif; font-size: 40px; font-weight: 800; letter-spacing: -0.7px; fill: #172017; }
  </style>
  ${body}
</svg>`);

const centerText = (klass, y, text) => `<text class="${klass}" x="540" y="${y}" text-anchor="middle">${text}</text>`;
const leftText = (klass, y, text) => `<text class="${klass}" x="64" y="${y}">${text}</text>`;

// The supplied team cutout has a clean, near-white backdrop. Remove only the
// border-connected white area so white shirt details inside the group stay intact.
async function removeWhiteBackdrop(filePath) {
  const { data, info } = await sharp(filePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixels = width * height;
  const visited = new Uint8Array(pixels);
  const queue = new Uint32Array(pixels);
  let head = 0;
  let tail = 0;

  const isBackdrop = (pixel) => {
    const offset = pixel * 3;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return Math.min(r, g, b) > 238 && Math.max(r, g, b) - Math.min(r, g, b) < 15;
  };
  const enqueue = (pixel) => {
    if (!visited[pixel] && isBackdrop(pixel)) {
      visited[pixel] = 1;
      queue[tail++] = pixel;
    }
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x < width - 1) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y < height - 1) enqueue(pixel + width);
  }

  const alpha = Buffer.allocUnsafe(pixels);
  for (let pixel = 0; pixel < pixels; pixel++) alpha[pixel] = visited[pixel] ? 0 : 255;
  const softenedAlpha = await sharp(alpha, { raw: { width, height, channels: 1 } }).blur(0.7).raw().toBuffer();

  return sharp(data, { raw: { width, height, channels: 3 } })
    .joinChannel(softenedAlpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

const cards = [
  {
    background: '01-driver-callout-bg.png',
    output: '01-program-push-driver-callout.png',
    overlay: svg(`
      ${centerText('eyebrow', 570, 'PROGRAM PUSH')}
      ${centerText('hero', 720, 'DRIVER, ADA LORI?')}
      ${centerText('hero-aqua', 840, 'JOM JANA INCOME.')}
    `),
  },
  {
    background: '02-ai-routing-app-bg.png',
    output: '02-ai-auto-routing.png',
    overlay: svg(`
      ${leftText('eyebrow', 500, 'CARA KERJA')}
      ${leftText('hero', 650, 'DOWNLOAD APP.')}
      ${leftText('hero-aqua', 765, 'AI ROUTE KAN TRIP.')}
      ${leftText('hero', 880, 'TERUS JALAN.')}
    `),
  },
  {
    background: '03-collection-commission-bg.png',
    output: '03-collection-whatsapp-cta.png',
    team: true,
    overlay: svg(`
      ${leftText('eyebrow', 485, 'PROGRAM PUSH')}
      ${leftText('hero', 640, 'LAGI BANYAK')}
      ${leftText('hero-aqua', 750, 'COLLECTION,')}
      ${leftText('hero', 890, 'LAGI BANYAK')}
      ${leftText('hero-aqua', 1000, 'KOMISEN.')}
      <rect x="64" y="1115" width="610" height="126" rx="30" fill="#b6dc39"/>
      <text class="cta" x="369" y="1194" text-anchor="middle">WHATSAPP SEKARANG</text>
    `),
  },
];

await fs.mkdir(assets, { recursive: true });
const logo = await sharp(logoPath).resize({ width: 280 }).png().toBuffer();
const teamCutout = await sharp(teamCutoutPath).resize({ width: 980 }).png().toBuffer();
const collectionCard = cards.find((card) => card.output === '03-collection-whatsapp-cta.png');
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: logo, left: 64, top: 60 }, { input: collectionCard.overlay, left: 0, top: 0 }])
  .png()
  .toFile(path.join(assets, '03-collection-text-overlay.png'));

for (const card of cards) {
  const background = await sharp(path.join(backgrounds, card.background))
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  const composites = [
    ...(card.team ? [{ input: teamCutout, left: 50, top: 1290, blend: 'multiply' }] : []),
    { input: logo, left: 64, top: 60 },
    { input: card.overlay, left: 0, top: 0 },
  ];

  await sharp(background)
    .composite(composites)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(assets, card.output));
}

console.log(`Created ${cards.length} driver-focused Program PUSH infographics in ${assets}`);
