import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "aios", "outputs", "fathopes-heroes-ep1-manifest");
const MODEL = "gemini-3.1-flash-image-preview";

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

async function generate(base, key, prompt) {
  const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, inputImages: [], generationOptions: { aspect_ratio: "9:16", resolution: "2K" } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status !== "completed" || !json.outputUrl) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  const image = await fetch(json.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  return Buffer.from(await image.arrayBuffer());
}

const refs = [
  {
    file: "fh-ep1-sinki-backplate.png",
    prompt: `Create a clean vertical 9:16 photoreal reference backplate for a Malaysian kitchen sink scene. Camera position is INSIDE the dark sink drain, looking upward toward the underside of a stainless-steel kitchen sink and the counter above, low POV, wide enough to see the drain opening in the foreground and the kitchen rim above. Real wet metal, ceramic, rubber drain seal, small water droplets, realistic grime, warm practical kitchen light from above, shallow darkness inside the pipe. Leave the upper center area clear so an auntie's hands and a cooking pan can appear later. This is an empty environment reference: no people, no cartoon characters, no monster, no oil pouring, no logos, no text, no signage, no watermark. The background must stay photoreal and physically coherent, suitable for mixed-media 2D cartoon compositing.`,
  },
  {
    file: "fh-ep1-oil-collection-kit.png",
    prompt: `Create a clean vertical 9:16 photoreal product reference for proper used-cooking-oil collection in Malaysia. On a clean neutral kitchen counter, place one transparent recycled plastic bottle filled halfway with cold dark thick used cooking oil, tightly capped, beside one sturdy lidded collection tong with a simple blank surface. Keep the bottle and tong upright, fully visible, separated clearly left and right, with realistic oil weight, reflections and fingerprints. Bright practical kitchen light, soft natural shadow, documentary product photography. No people, no hands, no cartoon characters, no monster, no labels, no brand marks, no readable text, no logos, no watermark. This is a clean object reference for later animation, not an advertisement poster.`
  },
];

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  if (!key) throw new Error("Missing MB_API_KEY or MB_KEY in env.local");
  await fs.mkdir(OUT, { recursive: true });
  for (const ref of refs) {
    process.stdout.write(`[${ref.file}] generating... `);
    const image = await generate(base, key, ref.prompt);
    await fs.writeFile(path.join(OUT, ref.file), image);
    console.log(`saved ${(image.length / 1024).toFixed(0)} KB`);
  }
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
