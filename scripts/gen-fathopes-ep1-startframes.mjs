import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "aios", "outputs", "fathopes-heroes-ep1-startframes");
const MANIFEST = path.join(ROOT, "aios", "outputs", "fathopes-heroes-ep1-manifest");
const MONSTER = path.join(ROOT, "fathopes-heroes-series-bible", "Generated image 1.png");
const KIT = path.join(ROOT, "public", "Fathopes_heroes_animated", "kit-3.png");
const SINK = path.join(MANIFEST, "fh-ep1-sinki-backplate.png");
const OILKIT = path.join(MANIFEST, "fh-ep1-oil-collection-kit.png");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
async function dataUri(file) {
  const buf = await sharp(file).resize({ width: 640, height: 960, fit: "inside" }).jpeg({ quality: 62, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}
async function generate(base, key, prompt, refs) {
  const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt, inputImages: refs, generationOptions: { aspect_ratio: "9:16", resolution: "2K" } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status !== "completed" || !json.outputUrl) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  const image = await fetch(json.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  return Buffer.from(await image.arrayBuffer());
}

const STYLE = `Mixed-media animation reference frame: bold 2D hand-drawn cel-shaded cartoon characters with thick confident outlines composited into a richly detailed photoreal Malaysian environment. Characters stay flat 2D; the environment stays real, textured and practical. Playful creepy comedy, not gore and not realistic horror. Cold dark used cooking oil only, no steam or heat. No text, logos or watermark.`;
const jobs = [
  { file: "01-sink-pov-auntie-pan.png", refs: [SINK], prompt: `${STYLE} Use the attached image as the exact exterior sink environment and high-angle camera view. Looking down from outside above the counter, show only an auntie's hands and forearms entering from the top edge, holding a metal pan of last night's cold dark used cooking oil just above the round drain. The stainless basin fills the lower frame; faucet, hose, window and counter remain visible in the upper frame. Preserve the drain geometry and warm kitchen light. No monster visible yet.` },
  { file: "02-eyes-in-drain.png", refs: [SINK, MONSTER], prompt: `${STYLE} Use the first image as the exact exterior high-angle sink view. Use the second image as Glinciro's exact monster identity, including dark olive oily colors, wide eyes, teeth and dripping grin. From above the real sink, stage only Glinciro's enormous face poking through the small round drain opening. His body is far too big to fit through the pipe: show no torso, arms, hands, belly, legs or tail. Preserve the faucet, basin, drain and practical kitchen light. No auntie, no extra characters.` },
  { file: "03-glinciro-feeding.png", refs: [SINK, MONSTER], prompt: `${STYLE} Use the first image as the exact exterior high-angle sink environment and the second as Glinciro's exact identity. From above the sink, show only Glinciro's oversized face filling the small round drain opening as a few drops of cold dark oil fall toward his grin. His enormous body remains hidden below the pipe; absolutely no torso, arms, hands, belly, legs, tail or full body visible. Preserve the stainless basin, faucet, drain geometry and warm practical light. Playful creepy comedy, no gore, no text.` },
  { file: "04-kit-stops-pour.png", refs: [KIT, SINK], prompt: `${STYLE} Use the first image as Kit's exact character identity and body shape: chubby, broad-bodied, round belly, thick torso, black bucket hat, dark teal coveralls with silver reflective bands and black gloves. Use the second image as the exact exterior sink environment. Stage chubby Kit leaning over the sink from outside in a medium-wide high-angle shot, his black-gloved hand firmly placing the drain cover over the round opening, annoyed but friendly. Preserve his chubby proportions, outfit, basin, faucet and kitchen light. No monster visible, no text.` },
  { file: "05-proper-collection.png", refs: [KIT, OILKIT], prompt: `${STYLE} Use the first image as Kit's exact identity and the second image as the exact bottle and lidded collection tong objects. Stage Kit at a bright kitchen counter carefully pouring cold dark used cooking oil from a pan into the transparent bottle, with the lidded tong beside it ready for collection. Preserve Kit's outfit, the bottle shape, the tong shape and the realistic oil color. Clear readable action, no text or labels.` },
  { file: "06-hungry-monster-button.png", refs: [SINK, MONSTER], prompt: `${STYLE} Use the first image as the exact exterior high-angle sink environment and the second image as Glinciro's exact identity. From above the closed sink, show only a small glimpse of Glinciro's enormous face pressed behind the round drain cover, eyes looking upward and oily grin disappointed. His body remains completely hidden below the pipe; show no torso, arms, hands, belly, legs or tail. Preserve the basin, drain cover, faucet and warm kitchen light. Playful comedy, no gore, no text.` },
];

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  if (!key) throw new Error("Missing MB_API_KEY or MB_KEY in env.local");
  await fs.mkdir(OUT, { recursive: true });
  for (const job of jobs) {
    process.stdout.write(`[${job.file}] generating... `);
    const refs = await Promise.all(job.refs.map(dataUri));
    const image = await generate(base, key, job.prompt, refs);
    await fs.writeFile(path.join(OUT, job.file), image);
    console.log(`saved ${(image.length / 1024).toFixed(0)} KB`);
  }
}
main().catch((e) => { console.error(e.stack || e.message); process.exitCode = 1; });
