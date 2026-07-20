import { promises as fs } from "node:fs";
import path from "node:path";
const ROOT = "/Users/faeez/motionboards";
const MODEL = "gemini-3.1-flash-image-preview";
const OPTS = { aspect_ratio: "9:16", resolution: "2K" };
const OUT = path.join(ROOT, "FatHopes IMG", "depot-posters-nb2");
await fs.mkdir(OUT, { recursive: true });

// env
const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
for (const l of raw.split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
const key = process.env.MB_KEY || process.env.MB_API_KEY;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const LIST = [
 ["Nabihah","Kedah","Perlis, Kedah","012-649 7315","aor@fathopesenergy.com"],
 ["Amir","Kedah","Langkawi","012-649 7315","lgk@fathopesenergy.com"],
 ["Ikhwan","Pulau Pinang","Penang","012-219 7315","north@fathopesenergy.com"],
 ["Syamil","Perak","Perak","012-868 7315","prk@fathopesenergy.com"],
 ["Badri","Kelantan","Kelantan, Terengganu","012-920 7315","badri@fathopesenergy.com"],
 ["Amirul","Pahang","Pahang","012-363 7315","phg@fathopesenergy.com"],
 ["Siti Hajar","Johor","Johor","012-201 7315","jhb@fathopesenergy.com"],
 ["Iswadi","Selangor","Selangor, KL, N. Sembilan","012-791 7315","iswadi@fathopesenergy.com"],
 ["Ganesan","Selangor","Selangor, KL, N. Sembilan","012-623 7315","ganesan@fathopesenergy.com"],
 ["Hazriq","Selangor","Selangor, KL, N. Sembilan","012-562 7315","hazriq@fathopesenergy.com"],
 ["Zamri","Melaka","Melaka","012-326 7315","mkz@fathopesenergy.com"],
 ["Teresa","Sarawak","Sibu, Miri, Bintulu","012-607 7315","sibu@fathopesenergy.com"],
 ["Steffeni","Sarawak","Kuching","012-663 7315","sarawakdepot@fathopesenergy.com"],
 ["Noraini","Sabah","Kota Kinabalu","012-301 7315","bki@fathopesenergy.com"],
];
const ROWS = LIST.map((r,i)=>`${i+1}. ${r[0]} | flag: ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]}`).join("\n");
const TEXTRULE = `EXACT TEXT IS CRITICAL: render every name, phone number, email and state EXACTLY as written below, character-for-character, perfectly legible on a phone. Do NOT invent, drop, duplicate, misspell or scramble any digit, letter or word. Each of the 14 people appears exactly once, in order. Beside each person show that Malaysian STATE FLAG as a small correct official flag icon. No app-store buttons, no 'call now', no CTA, no extra footer. Only FatHopes branding, no other logos, no watermark.

THE 14 ROWS (name | state flag | coverage | phone | email):
${ROWS}

Header (announcement only): title 'DEPOT FATHOPES ENERGY' and subtitle 'Pegawai Bertugas Mengikut Negeri'. Reproduce the attached FatHopes Energy logo exactly in the header, do not recolour it.`;

const STYLES = [
 ["nb2_flags_light","Design a clean attractive 9:16 vertical Instagram-story poster, white and FatHopes forest-green (#12703A) palette with soft rounded white cards, one row per person, the state flag as a neat rounded icon on the LEFT of each row, name bold, coverage small grey, phone in green on the right. Modern, airy, premium."],
 ["nb2_flags_green","Design a bold 9:16 vertical Instagram-story poster with a FatHopes forest-green gradient background and white text, a tidy list, each row led by a small rounded state-flag chip on the left, orange (#F49B1B) accent for the phone numbers. Confident and vibrant."],
 ["nb2_flags_map","Design a modern 9:16 vertical Instagram-story poster themed around a subtle faded map of Malaysia in the background, FatHopes green, a clean directory list on top, each entry paired with its small correct state flag. Elegant, editorial."],
 ["nb2_flags_grid","Design a stylish 9:16 vertical Instagram-story poster laying the 14 depots out as a neat 2-column grid of small cards, each card showing the state flag at top, then name, coverage, phone and email. Balanced, contemporary, FatHopes green + white with orange accents."],
];

async function upload(p) {
  const buf = await fs.readFile(path.join(ROOT, p));
  const res = await fetch(`${base}/api/upload`, { method:"POST", headers:{ Authorization:`Bearer ${key}`, "Content-Type":"image/png", "x-filename":"logo.png" }, body: buf });
  const j = await res.json().catch(()=>({})); if(!res.ok||!j.url) throw new Error(`upload ${res.status}: ${JSON.stringify(j).slice(0,160)}`); return j.url;
}
const logo = await upload("FatHopes IMG/poster-refs/LOGO-mark.png");
console.log("logo uploaded");
for (const [name, style] of STYLES) {
  process.stdout.write(`${name} ... `);
  const prompt = `${style}\n\n${TEXTRULE}`;
  try {
    let r, attempt=0;
    for(;;){
      const res = await fetch(`${base}/api/generate`, { method:"POST", headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/json" }, body: JSON.stringify({ model:MODEL, prompt, inputImages:[logo], generationOptions:OPTS }) });
      r = await res.json().catch(()=>({}));
      if(res.ok) break;
      if((res.status===429||res.status===503||/rate.?limit|unavailable|high demand/i.test(JSON.stringify(r)))&&++attempt<=6){ process.stdout.write(`(retry ${attempt}) `); await sleep(20000); continue; }
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(r).slice(0,200)}`);
    }
    if(r.status!=="completed"||!r.outputUrl){ console.log(`unexpected: ${JSON.stringify(r).slice(0,140)}`); continue; }
    const img = await fetch(r.outputUrl, { headers:{ Authorization:`Bearer ${key}` } });
    await fs.writeFile(path.join(OUT, `${name}.png`), Buffer.from(await img.arrayBuffer()));
    console.log("saved");
  } catch(e){ console.log(`failed: ${e.message||e}`); }
}
console.log("DONE ->", OUT);
