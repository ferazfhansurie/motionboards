// FatHopes Energy Singapore — 5 "We Buy Used Cooking Oil" poster variations.
// 9:16, NB2 @ 2K. Uses the REAL Singapore team photos (faces kept exact).
//   node scripts/gen-fathopes-sg.mjs            (all)
//   node scripts/gen-fathopes-sg.mjs 1,2        (only those)
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SG = "public/Fathopes-singapore";
const MODEL = "gemini-3.1-flash-image-preview";
const OPTS = { aspect_ratio: "9:16", resolution: "2K" };

const THUMBS = `${SG}/2bbe6517-a72e-43fe-bd8d-13a25ca1a949.jpg`;     // thumbs-up team
const THUMBS2 = `${SG}/376cd214-5068-4961-b95e-f58f0c520a29.jpg`;    // thumbs-up team (alt)
const ARMS = `${SG}/391494d3-94b7-4b13-bf60-a91b6f1fd3fc.jpg`;       // arms-crossed group
const OPS = `${SG}/c08b2c24-a2d4-45dd-bdc0-62609882548a.jpg`;        // loading IBC totes on green lorry

const CONTACT = `WhatsApp / Call: +65 9711 1785. Address line: FatHopes Energy (S) Pte Ltd, 111 N Bridge Rd, #24-02 Peninsula Plaza, Singapore 179098.`;

const RULE = `Design a bold, high-energy 9:16 vertical advertising poster for FatHopes Energy (Singapore) that BUYS used cooking oil from food businesses. STYLE: loud "cash for used cooking oil" flyer - black background, huge bold YELLOW and white headlines, grunge torn-paper banners, golden oil accents, small clean line icons, red callout badges, plus FatHopes forest-green (#15703A) accents and a small "FatHopes Energy" green leaf wordmark. REAL TEAM PHOTO: the attached reference image is the REAL FatHopes Singapore team in front of their green collection lorry - feature it as a genuine photograph on the poster. KEEP ALL REAL FACES EXACT - never redraw, beautify, swap, age or invent a face; keep their black FatHopes uniforms and the green lorry. TEXT RULES (critical): spell every word and number EXACTLY as written, large and perfectly legible, NO gibberish, NO misspellings, NO duplicated text, NO random extra letters or characters. Only FatHopes branding, no other logos, no watermark.`;

const POSTERS = [
  { n: 1, file: "fh-cash-first", ref: THUMBS,
    text: `EXACT TEXT: small top tag "WE BUY"; giant headline "USED COOKING OIL"; outlined badge "IN ANY QUANTITY!"; red torn banner top-right "WE PAY HIGHER PRICES THAN OTHER COLLECTORS!"; sub-headline "Don't throw it away - sell it today!"; five icons with labels "HIGHER PRICES", "INSTANT PAYMENT", "FREE COLLECTION", "TRUSTED & RELIABLE", "ECO-FRIENDLY"; a "WE BUY FROM:" checklist "Restaurants, Hotels, Catering Services, Food Stalls, Food Factories, Any F&B Business"; red CTA bar "DON'T KEEP IT - CASH IT!"; big contact "+65 9711 1785" with a WhatsApp icon; "Islandwide Singapore"; footer "Recycle today, better tomorrow". ${CONTACT} Feature the real team photo as a prominent block in the lower half.` },
  { n: 2, file: "fh-fuel-future", ref: ARMS,
    text: `EXACT TEXT: top tag "YOUR USED OIL = CLEAN ENERGY"; headline "WE TURN USED COOKING OIL INTO BIOFUEL"; badge "POWERING A GREENER SINGAPORE"; sub-headline "Get paid and go green."; five icons with labels "COMPETITIVE RATES", "CERTIFIED COLLECTION", "FREE PICKUP", "FULL TRACEABILITY", "LOWER CARBON FOOTPRINT"; a "WE COLLECT FROM:" list "Hotels, Restaurant Groups, Central Kitchens, Catering, Food Manufacturers"; green CTA bar "PARTNER WITH FATHOPES"; contact "+65 9711 1785"; "Islandwide Singapore"; footer "Let's work together for a cleaner tomorrow". ${CONTACT} Feature the real arms-crossed team photo as a confident hero band across the middle.` },
  { n: 3, file: "fh-trusted-team", ref: THUMBS2,
    text: `EXACT TEXT: top tag "SINGAPORE'S TRUSTED"; headline "USED COOKING OIL COLLECTORS"; badge "REAL TEAM, REAL SERVICE"; sub-headline "Friendly, professional and always on schedule."; five icons with labels "BEST PRICE", "PAY ON COLLECTION", "FREE PICKUP", "HONEST WEIGHING", "ECO-FRIENDLY"; a "WE BUY FROM:" list "Restaurants, Food Stalls, Hotels, Catering, Factories"; red CTA bar "BOOK YOUR COLLECTION"; contact "+65 9711 1785"; "Islandwide Singapore". ${CONTACT} Make the REAL team photo the large hero image in the top half - it is the main focus.` },
  { n: 4, file: "fh-compliant", ref: OPS,
    text: `EXACT TEXT: top tag "STAY COMPLIANT"; headline "GET PAID FOR YOUR USED COOKING OIL"; badge "PROPER, LICENSED, DOCUMENTED"; sub-headline "Responsible used-oil disposal that pays you back."; five icons with labels "HIGHER PAYOUT", "INSTANT PAYMENT", "FREE COLLECTION", "DISPOSAL RECORDS", "ECO-FRIENDLY"; a "WE COLLECT FROM:" list "Restaurants, Central Kitchens, Hotels, Catering, Food Factories"; red CTA bar "SCHEDULE A PICKUP TODAY"; contact "+65 9711 1785"; "Islandwide Singapore"; footer "Recycle today, better tomorrow". ${CONTACT} Feature the real photo of the worker loading oil totes onto the green FatHopes lorry as the main proof image.` },
  { n: 5, file: "fh-cash-today", ref: THUMBS,
    text: `EXACT TEXT: bold red top tag "STOP!"; giant headline "DON'T POUR IT AWAY"; badge "GET PAID TODAY!"; red banner "BEST PRICE IN SG - GUARANTEED!"; sub-headline "That waste oil is money down the drain."; five icons with labels "TOP DOLLAR", "INSTANT CASH", "FREE PICKUP", "TRUSTED TEAM", "ECO-FRIENDLY"; a "WE BUY FROM:" list "Restaurants, Hawkers, Hotels, Catering, Factories"; bright CTA bar "CALL OR WHATSAPP NOW!"; big contact "+65 9711 1785"; "Islandwide Singapore"; footer "Turn your waste into cash today". ${CONTACT} Feature the energetic real thumbs-up team photo near the bottom with a megaphone graphic.` },
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
  const outDir = path.join(ROOT, "public", "Fathopes-singapore", "_gen");
  await fs.mkdir(outDir, { recursive: true });

  for (const p of list) {
    process.stdout.write(`[${p.n}] ${p.file} ... `);
    try {
      const ref = await upload(base, key, p.ref);
      const prompt = `${RULE}\n\n${p.text}`;
      let r, attempt = 0;
      for (;;) {
        const res = await fetch(`${base}/api/generate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODEL, prompt, inputImages: [ref], generationOptions: OPTS }),
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
      await fs.writeFile(path.join(outDir, `${p.file}.png`), buf);
      console.log(`saved ${p.file}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/Fathopes-singapore/_gen/");
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
