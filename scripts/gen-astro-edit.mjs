// Edit hero-02 story: straighten the astro logo + change caption to a thank-you.
//   node scripts/gen-astro-edit.mjs [count]
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "public/fathopes/_gen/story-hero/_base-hero02.jpg";

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
async function dataUri(p) {
  const buf = await fs.readFile(path.join(ROOT, p));
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const PROMPT = `Use the attached Instagram STORY image as the BASE and keep it almost entirely
the same: the full-frame background photo, the cut-out event photos around it, all real
people and their faces, the colours, and the overall layout.

Make this a CLEAN PLATE for later editing. Change these things:
1) REMOVE the big "astro" logo sticker completely. Fill that area naturally with the
   surrounding background so nothing is left there.
2) REMOVE all caption text at the bottom completely (the "TERIMA KASIH"/program lines).
   Leave that lower area as clean empty background.
3) Leave clear, uncluttered EMPTY SPACE in the lower third and in the area where the logo
   was, so a logo and caption can be added later in post.

Keep EVERYTHING else exactly: the full-frame background photo, the cut-out event photos
around it, all real people and faces, colours and layout. NO text anywhere, NO astro
logo, no other logos, no watermark. Clean 9:16 Instagram-story plate.

Do NOT alter, redraw or invent any human face. No gibberish, no duplicated text. Keep it
a clean 9:16 Instagram story.`;

async function generate(base, key, inputImages) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image-preview",
        prompt: PROMPT, inputImages,
        generationOptions: { aspect_ratio: "9:16", resolution: "2K" },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    if ((res.status === 429 || /rate-limit/i.test(JSON.stringify(json))) && attempt <= 10) {
      process.stdout.write(`(429 #${attempt}, 45s) `); await sleep(45000); continue;
    }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 240)}`);
  }
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("No API key (MB_API_KEY in .env.local).");
  const N = parseInt(process.argv[2] || "3", 10);

  const refs = [await dataUri(BASE)];
  const outDir = path.join(ROOT, "public", "fathopes", "_gen", "story-hero");
  await fs.mkdir(outDir, { recursive: true });

  for (let i = 1; i <= N; i++) {
    const n = String(i).padStart(2, "0");
    process.stdout.write(`[${n}/${N}] ... `);
    try {
      const r = await generate(base, key, refs);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 140)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(outDir, `hero-plate-${n}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved hero-thanks-${n}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/fathopes/_gen/story-hero/");
}

main().catch((e) => { console.error(e); process.exit(1); });
