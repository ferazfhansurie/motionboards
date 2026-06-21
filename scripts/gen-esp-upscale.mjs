// ESP WRAPZ posters -> recreate at 4K via Nano Banana 2 (feed the existing
// poster as the reference, ask NB2 to reproduce it identically at 4K).
// menu-anime + menu-bold also get the "fr" stripped from prices.
// menu-grid is intentionally skipped.
//   node scripts/gen-esp-upscale.mjs            (all configured)
//   node scripts/gen-esp-upscale.mjs single-ppf,menu-bold
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "public/ESP/_gen/posters";
const MODEL = "gemini-3.1-flash-image-preview";
const OPTS = { aspect_ratio: "9:16", resolution: "4K" };

const IDENTICAL = `Reproduce this exact poster at maximum quality and sharpness. Keep EVERYTHING identical - every word, number, RM price, the ESP WRAPZ logo, the car, the layout, colours and composition must stay exactly the same. Do NOT add, remove, move, restyle or change any text or element. Only render it crisper and at higher resolution. No new content, no watermark, no extra text.`;

const EDIT_FR = `Recreate this exact poster at maximum quality and sharpness, identical layout, car, logo, colours and composition. ONE change only: remove the small lowercase "fr" that appears before the RM prices, so "PPF fr RM2500" becomes "PPF RM2500", "Tint fr RM500" becomes "Tint RM500", and so on for every price. Keep the RM numbers and all other text exactly the same. Everything else must stay identical. No watermark, no extra text.`;

const JOBS = [
  { file: "single-ppf", prompt: IDENTICAL },
  { file: "single-wrap", prompt: IDENTICAL },
  { file: "single-tint", prompt: IDENTICAL },
  { file: "single-graphene", prompt: IDENTICAL },
  { file: "single-combo", prompt: IDENTICAL },
  { file: "menu-spec", prompt: IDENTICAL },
  { file: "menu-table", prompt: IDENTICAL },
  { file: "menu-anime", prompt: EDIT_FR },
  { file: "menu-bold", prompt: EDIT_FR },
  // menu-grid: intentionally skipped
];

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function upload(base, key, p) {
  const buf = await fs.readFile(path.join(ROOT, p));
  const res = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/png", "x-filename": path.basename(p) },
    body: buf,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) throw new Error(`upload ${p} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 160)}`);
  return json.url;
}

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("No API key (MB_API_KEY in .env.local).");

  const only = (process.argv[2] || "").split(",").filter(Boolean);
  const list = only.length ? JOBS.filter((j) => only.includes(j.file)) : JOBS;
  const outDir = path.join(ROOT, "public", "ESP", "_gen", "posters", "4k");
  await fs.mkdir(outDir, { recursive: true });

  for (const j of list) {
    process.stdout.write(`[4K] ${j.file} ... `);
    try {
      const ref = await upload(base, key, `${SRC}/${j.file}.png`);
      let r, attempt = 0;
      for (;;) {
        const res = await fetch(`${base}/api/generate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODEL, prompt: j.prompt, inputImages: [ref], generationOptions: OPTS }),
        });
        r = await res.json().catch(() => ({}));
        if (res.ok) break;
        if ((res.status === 429 || res.status === 503 || /rate.?limit|unavailable|high demand/i.test(JSON.stringify(r))) && ++attempt <= 8) {
          process.stdout.write(`(retry #${attempt}) `); await sleep(30000); continue;
        }
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(r).slice(0, 200)}`);
      }
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 140)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      await fs.writeFile(path.join(outDir, `${j.file}.png`), buf);
      console.log(`saved 4k/${j.file}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/ESP/_gen/posters/4k/");
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
