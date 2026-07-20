import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEXT = "Singapore businesses, manage waste smarter with Fathopes Energy. We provide professional on-site collection and conversion services across Singapore. Call plus six five, eight one two six, two three seven nine — or plus six five, nine eight six nine, three seven six eight. Fathopes Energy — waste to wealth.";

async function loadEnv() {
  for (const f of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
}

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  if (!key) throw new Error("Missing MB_API_KEY/MB_KEY");
  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", prompt: TEXT, generationOptions: { aspect_ratio: "nova" } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.outputUrl) throw new Error(`TTS failed HTTP ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  const audio = await fetch(json.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  const buf = Buffer.from(await audio.arrayBuffer());
  const out = path.join(ROOT, "FatHopes IMG", "sg-video", "fathopes-sg-voiceover.mp3");
  await fs.writeFile(out, buf);
  console.log(`Saved ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
