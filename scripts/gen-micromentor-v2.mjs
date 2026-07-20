// Extra unique spot images for the MicroMentor deck (livelier pass).
// Apple-style, palette-matched, NO text baked in. Nano Banana 2 via MotionBoards.
//   node scripts/gen-micromentor-v2.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "GFP009-assignment", "assets");

async function loadEnv() {
  for (const f of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}

const STYLE = `Apple-style product still-life photography, seamless soft periwinkle lavender
(#ECEEF7) gradient studio backdrop, gentle diffuse lighting, long soft shadows, generous
empty negative space, premium and minimalist, photorealistic, sophisticated muted palette
with coral (#FF5A47), indigo (#4B4FA6) and warm yellow (#FFD23F) accents. CRITICAL: no
text, no words, no letters, no numbers, no logos, no readable UI text anywhere. No people,
no hands, no faces, no watermark.`;

const JOBS = [
  { name: "spot-problem", ar: "4:5",
    prompt: `A calm single modern smartphone resting on top of a large messy pile of
scattered pastel paper note cards and sticky notes that spill outward, symbolising
information overload versus one simple tool. The phone screen is off or softly glowing.
Tidy hero composition. ${STYLE}` },
  { name: "spot-why", ar: "4:3",
    prompt: `A clean flat lay shot from directly above: one modern smartphone, a small
closed notebook, a cup of coffee, and a single pen, arranged with lots of space between
them on the periwinkle surface. Warm, calm, aspirational student desk. ${STYLE}` },
  { name: "spot-thennow", ar: "16:9",
    prompt: `On the left, a tall stack of thick old textbooks. On the right, a single
sleek modern smartphone floating upright and glowing softly. Clear visual contrast
between old and new learning, wide balanced composition. ${STYLE}` },
  { name: "spot-amplify", ar: "3:4",
    prompt: `Seven small rounded 3D app-tile shapes, like soft glossy squircle icons in
coral, indigo and warm yellow, floating and arranged in a gentle vertical arc, each
casting a soft shadow, clean and playful but minimal. ${STYLE}` },
  { name: "spot-future", ar: "3:4",
    prompt: `A single modern smartphone floating upright with a soft warm sunrise glow
behind it and a subtle upward arc of tiny light particles rising from the top, optimistic
and forward looking, the backdrop blending periwinkle into a soft warm peach at the
horizon. ${STYLE}` },
];

async function generate(base, key, prompt, ar) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image-preview",
        prompt,
        generationOptions: { aspect_ratio: ar, resolution: "2K" },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    if ((res.status === 429 || /rate.?limit/i.test(JSON.stringify(json))) && attempt <= 8) {
      process.stdout.write(`(429 #${attempt}, 40s) `); await sleep(40000); continue;
    }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 240)}`);
  }
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  if (!key) throw new Error("No API key (MB_API_KEY in env.local).");
  await fs.mkdir(OUT, { recursive: true });
  for (const job of JOBS) {
    process.stdout.write(`[${job.name}] (${job.ar}) ... `);
    try {
      const r = await generate(base, key, job.prompt, job.ar);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0,160)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      await fs.writeFile(path.join(OUT, `${job.name}.png`), buf);
      console.log(`saved ${job.name}.png (${(buf.length/1024).toFixed(0)} KB)`);
    } catch (e) { console.log(`failed: ${e instanceof Error ? e.message : e}`); }
  }
  console.log(`Done. Output in ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
