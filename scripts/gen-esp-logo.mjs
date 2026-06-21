// Swap the AI logo on the 4K ESP posters for the real ESP WRAPZ logo.
// Feeds [base poster, real logo] to NB2, recreate identically at 4K but use
// the exact logo from the 2nd reference. Output -> posters/4k-logo/.
//   node scripts/gen-esp-logo.mjs                     (all 9)
//   node scripts/gen-esp-logo.mjs single-ppf,menu-anime
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "public/ESP/_gen/posters"; // 2K base (small enough to upload); output is 4K
const LOGO = "public/ESP/454675338_122168572178175756_4553183980657277920_n (2).jpg";
const MODEL = "gemini-3.1-flash-image-preview";
const OPTS = { aspect_ratio: "9:16", resolution: "4K" };

const LOGO_SWAP = `fully REMOVE the old ESP WRAPZ logo lockup - including any separate large "WRAPZ" wordmark or gold "ESP" mark next to it - and put in its place EXACTLY the single logo shown in the SECOND reference image: a clean boxed "ESP" monogram with "WRAPZ" and a thin tagline "WRAP . PPF . TINT . COATING" beneath it, in white and silver. There must be only ONE ESP WRAPZ logo on the poster, with NO duplicate, leftover or doubled wordmark. Reproduce that logo faithfully (same lettering and tagline), placed where the old logo sat and sized to fit neatly. Do NOT make it gold.`;

const PROMPT = `Recreate this exact poster (first reference) at 4K with maximum sharpness. Keep EVERYTHING identical - every word, number, RM price, the car, the layout, colours and composition. The ONLY change: ${LOGO_SWAP} Do NOT change any other text or element. No watermark, no extra text.`;

const PROMPT_FR = `Recreate this exact poster (first reference) at 4K with maximum sharpness, identical layout, car, colours and composition. TWO changes only: (1) ${LOGO_SWAP} (2) remove the small lowercase "fr" before the RM prices, so "PPF fr RM2500" becomes "PPF RM2500", "Tint fr RM500" becomes "Tint RM500", etc - keep the RM numbers and all other text the same. Nothing else changes. No watermark, no extra text.`;

const FILES = [
  { f: "single-ppf" }, { f: "single-wrap" }, { f: "single-tint" }, { f: "single-graphene" }, { f: "single-combo" },
  { f: "menu-spec" }, { f: "menu-table" }, { f: "menu-anime", fr: true }, { f: "menu-bold", fr: true },
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

const _cache = new Map();
async function upload(base, key, p, mime) {
  if (_cache.has(p)) return _cache.get(p);
  const buf = await fs.readFile(path.join(ROOT, p));
  const res = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": mime, "x-filename": path.basename(p) },
    body: buf,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) throw new Error(`upload ${p} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 160)}`);
  _cache.set(p, json.url);
  return json.url;
}

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("No API key (MB_API_KEY in .env.local).");

  const only = (process.argv[2] || "").split(",").filter(Boolean);
  const list = only.length ? FILES.filter((j) => only.includes(j.f)) : FILES;
  const outDir = path.join(ROOT, "public", "ESP", "_gen", "posters", "4k-logo");
  await fs.mkdir(outDir, { recursive: true });

  const logoUrl = await upload(base, key, LOGO, "image/jpeg");

  for (const job of list) {
    const file = job.f;
    process.stdout.write(`[logo] ${file} ... `);
    try {
      const posterUrl = await upload(base, key, `${SRC}/${file}.png`, "image/png");
      const prompt = job.fr ? PROMPT_FR : PROMPT;
      let r, attempt = 0;
      for (;;) {
        const res = await fetch(`${base}/api/generate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODEL, prompt, inputImages: [posterUrl, logoUrl], generationOptions: OPTS }),
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
      await fs.writeFile(path.join(outDir, `${file}.png`), buf);
      console.log(`saved 4k-logo/${file}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/ESP/_gen/posters/4k-logo/");
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
