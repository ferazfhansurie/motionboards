// ESP WRAPZ — 10 poster variations (9:16) via Nano Banana 2.
// Each poster: copy LAYOUT/style of a template ref, drop in an ESP car photo
// as hero + the ESP brand logo, replace all text with exact ESP copy.
//   node scripts/gen-esp-posters.mjs            (all)
//   node scripts/gen-esp-posters.mjs 1,6        (only those indices)
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const T = "public/ESP/templates";
const ESP = "public/ESP";
const MODEL = "gemini-3.1-flash-image-preview"; // Nano Banana 2
const OPTS = { aspect_ratio: "9:16", resolution: "2K" };

const BRAND = `${ESP}/esp-pricelist-poster.jpeg`; // gold ESP WRAPZ logo + brand colours
const WHITE = `${ESP}/ref-white-ev-suv-front.jpeg`;
const MAROON = `${ESP}/ref-maroon-merc-cla-front.jpeg`;
const BLACK = `${ESP}/ref-black-suv-front.jpeg`;

// Shared instruction prepended to every prompt.
const RULE = `Make a striking, ORIGINAL 9:16 vertical poster for a Malaysian car detailing shop called ESP WRAPZ AUTOSPA (Sungai Buloh). CREATIVE SPACE: treat the FIRST reference image as loose INSPIRATION only - borrow its general layout instinct, typography energy and colour mood, then create your own fresh composition. Do NOT trace, copy or recreate it. ORIGINALITY / RIGHTS: do NOT reproduce or imply ANY third-party brand, badge, model name, slogan or copyrighted text from the references (no Porsche, Nissan, Honda, Toyota, Brabus, no foreign-language slogans, no barcodes, no fake magazine names). The ONLY brand anywhere is ESP WRAPZ. Use the SECOND reference image as the hero car (you may restyle the angle/lighting but keep it a generic car - remove or blur any visible badge/numberplate). Use the THIRD reference image only for the ESP WRAPZ logo and brand colours (gold/yellow wordmark on dark). Replace ALL text with EXACTLY the ESP text below - spell every word and number perfectly, no gibberish, no duplicated text, no watermark. Keep text BIG, bold and perfectly legible on mobile.`;

const POSTERS = [
  // ---- 5 single-service ----
  { n: 1, file: "single-ppf", tmpl: "af6064cbe03ea09ebea3943d1ba0f1b4.jpg", car: WHITE,
    text: `EXACT TEXT: big headline "PAINT PROTECTION" then huge "FILM"; subline "8.5mil PPF + Graphene 10H Coating"; a price chip "Full Car from RM2700"; a badge "7 YEARS WARRANTY"; bottom bar with the ESP WRAPZ logo and "WhatsApp 011 1166 2117". Sleek premium green-to-dark mood.` },
  { n: 2, file: "single-wrap", tmpl: "2b4d865ead0dbc81a47746ee5d29f0ec.jpg", car: MAROON,
    text: `EXACT TEXT: neon-style headline "COLOUR WRAP"; subline "Tukar look, cat asal selamat"; price chip "RM2500"; small "2-in-1 Colour PPF - 8 Years Warranty"; bottom: ESP WRAPZ logo + "011 1166 2117". Neon night street mood.` },
  { n: 3, file: "single-tint", tmpl: "daf5b09da99f248079305a73e37d6583.jpg", car: BLACK,
    text: `EXACT TEXT: bold headline "SPUTTER TINT"; subline "Block heat + UV, tak fade"; price chip "from RM500"; badge "10 YEARS WARRANTY"; bottom: ESP WRAPZ logo + "WhatsApp 011 1166 2117". Dark, dramatic, premium mood.` },
  { n: 4, file: "single-graphene", tmpl: "20ae4e652a11fcb9e315dfb9c364d9e0.jpg", car: WHITE,
    text: `EXACT TEXT: headline "GRAPHENE 10H COATING"; subline "Deep gloss, senang basuh"; price chip "Car Pro Coating RM888"; bottom: ESP WRAPZ logo + "011 1166 2117". Futuristic dark HUD / tech mood with glowing accents.` },
  { n: 5, file: "single-combo", tmpl: "007697ff885aa286f81a77dea4ea7db4.jpg", car: BLACK,
    text: `EXACT TEXT: huge magazine headline "3-IN-1 COMBO"; smaller "ULTRA"; subline "Tint + PPF + Graphene Coating"; price chip "RM3500"; badge "7 YEARS WARRANTY"; bottom: ESP WRAPZ logo + "011 1166 2117". Bold magazine-cover mood.` },

  // ---- 5 full menu (all services + prices) ----
  { n: 6, file: "menu-spec", tmpl: "2eabd260988297c0eff19bc8a3aecef1.jpg", car: BLACK,
    text: `EXACT TEXT: top centered ESP WRAPZ logo with "AUTOSPA - SUNGAI BULOH". A clean PRICE LIST laid out as neat rows: "Full Front PPF + Graphene - RM1200"; "Full Car PPF + Graphene - Small RM2500 / SUV RM2700 / MPV RM2900"; "3-in-1 Combo Lite - RM2000"; "3-in-1 Combo Ultra - RM3500"; "Colour Wrap (Vinyl) - RM2500"; "Sputter Tint - from RM500"; "Car Pro Coating - RM888". Footer "7 Year Warranty - WhatsApp 011 1166 2117". Clean white luxury spec-sheet mood.` },
  { n: 7, file: "menu-table", tmpl: "d12f7a2aa64c57945d6ab90799e6716d.jpg", car: WHITE,
    text: `EXACT TEXT: ESP WRAPZ logo top-left; a tidy SERVICES + PRICE table on the right: "Full Car PPF - from RM2500"; "Combo Ultra - RM3500"; "Colour Wrap - RM2500"; "Sputter Tint - from RM500"; "Car Pro Coating - RM888". Footer "7 Year Warranty | 011 1166 2117". Magazine spec-table mood.` },
  { n: 8, file: "menu-grid", tmpl: "bf97074714357c143059ca6ea2bc0084.jpg", car: MAROON,
    text: `EXACT TEXT: top ESP WRAPZ logo. Three service cards in a row: "PPF" / "COLOUR WRAP" / "SPUTTER TINT". Below, short price lines: "Full Car PPF from RM2500", "Colour Wrap RM2500", "Tint from RM500", "Combo Ultra RM3500", "Car Pro Coating RM888". Footer "7 Year Warranty - WhatsApp 011 1166 2117". Dark elegant catalog mood.` },
  { n: 9, file: "menu-anime", tmpl: "60e4574309a4871a23d3074377064628.jpg", car: WHITE,
    text: `EXACT TEXT: fun comic headline "ESP WRAPZ"; speech-bubble style service tags "PPF", "WRAP", "TINT", "COATING"; small price chips "PPF fr RM2500", "Wrap RM2500", "Tint fr RM500", "Combo RM3500", "Coating RM888"; bottom "011 1166 2117". Bright fun anime / comic mood, keep it playful.` },
  { n: 10, file: "menu-bold", tmpl: "2787d4f46adf8c2002477df47ba8ade2.jpg", car: BLACK,
    text: `EXACT TEXT: bold repeated headline "ESP WRAPZ"; a clear list "Full Car PPF - fr RM2500", "Colour Wrap - RM2500", "Sputter Tint - fr RM500", "Combo Ultra - RM3500", "Car Pro Coating - RM888"; sticker label "7 YEAR WARRANTY"; bottom "WhatsApp 011 1166 2117". Bold sporty social mood with cartoon smoke accents.` },
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
async function upload(base, key, p) {
  if (_cache.has(p)) return _cache.get(p);
  const buf = await fs.readFile(path.join(ROOT, p));
  const res = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-filename": path.basename(p) },
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

  const only = (process.argv[2] || "").split(",").filter(Boolean).map(Number);
  const list = only.length ? POSTERS.filter((p) => only.includes(p.n)) : POSTERS;
  const outDir = path.join(ROOT, "public", "ESP", "_gen", "posters");
  await fs.mkdir(outDir, { recursive: true });

  for (const p of list) {
    process.stdout.write(`[${p.n}] ${p.file} ... `);
    try {
      const [tmpl, car, brand] = await Promise.all([
        upload(base, key, `${T}/${p.tmpl}`), upload(base, key, p.car), upload(base, key, BRAND),
      ]);
      const prompt = `${RULE}\n\n${p.text}`;
      let r, attempt = 0;
      for (;;) {
        const res = await fetch(`${base}/api/generate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODEL, prompt, inputImages: [tmpl, car, brand], generationOptions: OPTS }),
        });
        r = await res.json().catch(() => ({}));
        if (res.ok) break;
        if ((res.status === 429 || /rate.?limit/i.test(JSON.stringify(r))) && ++attempt <= 8) { process.stdout.write(`(429 #${attempt}) `); await sleep(45000); continue; }
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(r).slice(0, 200)}`);
      }
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 140)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      await fs.writeFile(path.join(outDir, `${p.file}.png`), buf);
      console.log(`saved ${p.file}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/ESP/_gen/posters/");
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
