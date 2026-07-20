// FatHopes Energy Singapore — 15s Seedance 2.0 Fast Omni advert (multi-ref I2V).
// Uses the REAL Singapore photos as @Image1..@Image4. Async Ark task via
// MotionBoards /api/generate (byteplus) + poll /api/generate/status.
//   node scripts/gen-fathopes-sg-video.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATES = "FatHopes IMG/sg-video/plates";
const MODEL = "dreamina-seedance-2-0-fast-260128/omni";
const OPTS = { aspect_ratio: "9:16", resolution: "720p", duration: "15s", generate_audio: false };

// Order defines @Image1..@Image4 (people-free plates + FatHopes logo)
const REFS = [
  `${PLATES}/lorry_plate.png`,                    // @Image1 green FatHopes lorry + oil totes
  `${PLATES}/totes_plate.png`,                    // @Image2 warehouse stacked totes
  `${PLATES}/tanker_plate.png`,                   // @Image3 tanker "CONTENTS: USED COOKING OIL"
  `FatHopes IMG/poster-refs/LOGO-mark.png`,       // @Image4 FatHopes Energy logo
];

const PROMPT = `15-second premium sustainability advert for FatHopes Energy Singapore, a licensed company that buys used cooking oil and recycles it into cleaner aviation fuel. Treat the attached photos as real depot footage; keep the green FatHopes lorry, white oil totes, tanker and signage exactly as shown, natural daylight, realistic cinematic motion, no people in frame.
Beat 1 (0-4s): Use @Image1, the green FatHopes lorry loaded with white oil totes in the depot bay. Slow dolly-in, shallow focus settling on the totes. Clean bold caption fades in: YOUR USED COOKING OIL IS WORTH MONEY.
Beat 2 (4-8s): Cut to @Image2, the warehouse stacked full of oil totes; slow tilt up revealing the scale. Caption: WE COLLECT ACROSS SINGAPORE.
Beat 3 (8-11s): Cut to @Image3, the tanker marked USED COOKING OIL; slow glide across the sign. Caption: RECYCLED INTO CLEANER AVIATION FUEL.
Beat 4 (11-15s): End plate on a clean dark panel. Place the FatHopes Energy logo from @Image4 at the top exactly as given, do not recolour or redraw it. Below it: FATHOPES ENERGY SINGAPORE, a small line 33 PENJURU LANE BLOCK C 03-04, a phone line +65 9711 1785, and a green button SELL YOUR UCO.
Style: Apple-keynote minimal, one idea on screen at a time, crisp white type with a single green accent, smooth eased transitions, no flicker. Keep captions short, correctly spelled, each shown once.
Do not distort truck or sign lettering, no extra logos beyond @Image4, no watermark, no gibberish text, no duplicated captions, no people.`;

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function upload(base, key, p, i) {
  const buf = await fs.readFile(path.join(ROOT, p));
  const isPng = p.toLowerCase().endsWith(".png");
  const ct = isPng ? "image/png" : "image/jpeg";
  const ext = isPng ? "png" : "jpg";
  const res = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": ct, "x-filename": `sg-ref-${i + 1}.${ext}` },
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
  if (!key) throw new Error("No API key (MB_API_KEY).");
  console.log(`prompt length: ${PROMPT.length} chars`);

  console.log("uploading 4 refs...");
  const refUrls = [];
  for (let i = 0; i < REFS.length; i++) { refUrls.push(await upload(base, key, REFS[i], i)); console.log(`  @Image${i + 1} ok`); }

  console.log("submitting Seedance 2.0 Fast Omni (15s, 9:16, 720p)...");
  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: PROMPT, inputImages: refUrls, generationOptions: OPTS }),
  });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`generate HTTP ${res.status}: ${JSON.stringify(r).slice(0, 300)}`);
  if (!r.requestId || !r.generationId) throw new Error(`unexpected submit response: ${JSON.stringify(r).slice(0, 300)}`);
  console.log(`  task ${r.requestId} (gen ${r.generationId})`);

  const qs = new URLSearchParams({ requestId: r.requestId, modelId: MODEL, generationId: r.generationId, byteplusVideo: "true", durationSec: "15", resolution: "720p" });
  let outputUrl = null, cost = "";
  for (let t = 0; t < 120; t++) {
    await sleep(5000);
    const sres = await fetch(`${base}/api/generate/status?${qs}`, { headers: { Authorization: `Bearer ${key}` } });
    const s = await sres.json().catch(() => ({}));
    if (s.status === "completed" && s.outputUrl) { outputUrl = s.outputUrl; cost = s.actualCost || ""; break; }
    if (s.status === "failed") throw new Error(`generation failed: ${s.error || "unknown"}`);
    process.stdout.write(`  [${(t + 1) * 5}s] ${s.log || s.status || "processing"}\r`);
  }
  if (!outputUrl) throw new Error("timed out waiting for video (10 min)");

  console.log(`\ncompleted${cost ? ` (${cost})` : ""}. downloading...`);
  const outDir = path.join(ROOT, "FatHopes IMG", "sg-video");
  await fs.mkdir(outDir, { recursive: true });
  const vid = await fetch(outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  const buf = Buffer.from(await vid.arrayBuffer());
  const outPath = path.join(outDir, "fathopes-sg-15s.mp4");
  await fs.writeFile(outPath, buf);
  console.log(`saved ${outPath} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`source URL: ${outputUrl}`);
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
