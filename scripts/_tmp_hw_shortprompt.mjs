// Ultra-short prompts (<50 chars), 1 reference image (real logo) each.
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const DIR = path.join(ROOT, "Hyperwrapz & Detailing");
const OUT_DIR = path.join(DIR, "_gen", "shortprompt");
const LOGO_RAW = path.join(DIR, "_gen", "HYPERWRAPZ LOGO.jpeg");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
async function toDataUri(p) {
  const buf = await fs.readFile(p);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}
async function safePath(p) {
  try { await fs.access(p); } catch { return p; }
  const ext = path.extname(p);
  const base = p.slice(0, -ext.length);
  for (let n = 2; ; n++) {
    const candidate = `${base}-v${n}${ext}`;
    try { await fs.access(candidate); } catch { return candidate; }
  }
}

const POSTERS = [
  { key: "colour-wrap", prompt: "Car colour wrap ad poster, HyperWrapz logo" },
  { key: "ppf-coating", prompt: "PPF coating ad poster, HyperWrapz logo" },
  { key: "tinting", prompt: "Car window tint ad poster, HyperWrapz logo" },
];

console.log(POSTERS.map((p) => `${p.key}: ${p.prompt.length} chars`).join("\n"));

async function generate(base, key, prompt, refDataUri) {
  const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-3.1-flash-image-preview",
      prompt,
      inputImages: [refDataUri],
      generationOptions: { aspect_ratio: "3:4", resolution: "2K" },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

async function main() {
  await loadEnv();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  await fs.mkdir(OUT_DIR, { recursive: true });
  const logoUri = await toDataUri(LOGO_RAW);

  for (const p of POSTERS) {
    process.stdout.write(`[${p.key}] ... `);
    const r = await generate(base, key, p.prompt, logoUri);
    if (r.status !== "completed" || !r.outputUrl) { console.log(`unexpected: ${JSON.stringify(r).slice(0,200)}`); continue; }
    const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    const out = await safePath(path.join(OUT_DIR, `${p.key}.png`));
    await fs.writeFile(out, Buffer.from(await img.arrayBuffer()));
    console.log(`saved ${path.relative(ROOT, out)}`);
  }
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
