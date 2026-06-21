// Edit push-v2-01: remove the MOHON SEKARANG bar; change salary badge to
// "MINIMUM BOLEH DAPAT RM6,000". Keep the rest identical.
//   node scripts/gen-push-edit.mjs [count]
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "public/fathopes/_gen/push-hiring/_base-f02.jpg";

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

const PROMPT = `Use the attached poster as the BASE and keep it almost ENTIRELY the same.
Preserve EXACTLY, do not redraw or re-interpret anything: the background photo of the
two men in black FatHopes tees with the green tanker truck, the two torn-paper
oil-pumping cutout photos, the headline "APPLY PROGRAM PUSH USAHAWAN", the sub-line
"JANA PENDAPATAN SENDIRI", the three keyword ticks ("LATIHAN PERCUMA", "TIADA
PENGALAMAN", "KERJA SENDIRI"), the FatHopes Energy / PROGRAM PUSH wordmarks, all real
faces, the colours, and the layout (there is NO bottom call-to-action bar — keep it that
way).

Change ONLY ONE thing: REMOVE the large standalone word "PUSH" that sits just below the
small "FatHopes Energy / PROGRAM PUSH" logo cluster in the upper-right area. Delete that
big "PUSH" word completely and cleanly fill the space with the surrounding background so
nothing is left there. Keep the small "FatHopes Energy / PROGRAM PUSH" logo itself.

Keep EVERYTHING else exactly the same: the headline "APPLY PROGRAM PUSH USAHAWAN", the
"MINIMUM BOLEH DAPAT RM6,000/BULAN" yellow badge, "JANA PENDAPATAN SENDIRI", the two
oil-pumping cutouts, the keyword ticks, all real faces, colours and layout. No bottom
CTA bar. No other text changes, no gibberish, correct spelling. Clean 4:5 poster.`;

async function generate(base, key, inputImages) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image-preview",
        prompt: PROMPT, inputImages,
        generationOptions: { aspect_ratio: "4:5", resolution: "2K" },
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
  const outDir = path.join(ROOT, "public", "fathopes", "_gen", "push-hiring");
  await fs.mkdir(outDir, { recursive: true });

  for (let i = 1; i <= N; i++) {
    const n = String(i).padStart(2, "0");
    process.stdout.write(`[${n}/${N}] ... `);
    try {
      const r = await generate(base, key, refs);
      if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0, 140)}`); continue; }
      const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
      const buf = Buffer.from(await img.arrayBuffer());
      const out = path.join(outDir, `push-clean-${n}.png`);
      await fs.writeFile(out, buf);
      console.log(`saved push-final-${n}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("Done. Output in public/fathopes/_gen/push-hiring/");
}

main().catch((e) => { console.error(e); process.exit(1); });
