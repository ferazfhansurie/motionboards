// MicroMentor (GFP 0009) deck imagery via MotionBoards + Nano Banana 2.
// Apple-style product renders. No text baked into the images (Nano Banana
// garbles lettering), so every screen is abstract coloured UI only.
//   node scripts/gen-micromentor.mjs
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

const STYLE = `Apple-style high-end product photography. Seamless soft gradient studio
backdrop, gentle diffuse top lighting, a long soft realistic drop shadow, lots of empty
negative space, premium minimalist tech render, photorealistic, subtle depth of field,
sophisticated muted palette. CRITICAL: absolutely NO text, NO words, NO letters, NO
numbers, NO logos anywhere. The phone screens show ONLY abstract rounded UI shapes:
rounded cards, pill buttons, a circular progress ring, small colour blocks. Colour
accents are coral (#FF5A47), indigo (#4B4FA6) and warm highlighter yellow (#FFD23F).
No people, no hands, no watermark, no reflections of faces, no brand marks.`;

const JOBS = [
  {
    name: "hero-light",
    ar: "3:4",
    prompt: `A single modern all-screen smartphone standing upright, floating slightly,
centered, on a seamless gradient backdrop that blends soft periwinkle lavender (#ECEEF7)
into pale off-white. The glowing screen shows an abstract minimalist learning-app home:
two or three rounded lesson cards, a small circular progress ring, a coral pill button.
Clean, calm, spacious. ${STYLE}`,
  },
  {
    name: "hero-dark",
    ar: "16:9",
    prompt: `A single modern all-screen smartphone floating at a slight three-quarter
angle on the right side of the frame, on a seamless deep indigo-to-near-black gradient
backdrop (#15182B). The screen glows softly with abstract rounded UI cards in coral and
warm yellow and a circular progress ring, casting a subtle coloured glow. Wide cinematic
composition with generous empty dark space on the left for a title. ${STYLE}`,
  },
  {
    name: "phones-trio",
    ar: "16:9",
    prompt: `Three modern all-screen smartphones standing in a row, evenly spaced, each
turned at a gentle angle, floating on a seamless soft periwinkle (#ECEEF7) gradient
backdrop. Each screen glows with a DIFFERENT abstract minimalist app screen made only of
rounded coloured shapes: the left phone a lesson card layout, the middle phone a big
circular progress ring with a coral accent, the right phone a stacked list with small
indigo and yellow pills. Cohesive, premium, spacious. ${STYLE}`,
  },
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
      process.stdout.write(`(429 #${attempt}, 40s) `);
      await sleep(40000);
      continue;
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
      if (r.status !== "completed" || !r.outputUrl) {
        console.log(`unexpected: ${JSON.stringify(r).slice(0, 160)}`);
        continue;
      }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(OUT, `${job.name}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved ${job.name}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`Done. Output in ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
