import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const MODEL = "gemini-3.1-flash-image-preview"; // Nano Banana 2
const TEMPLATE = path.join(ROOT, "FatHopes IMG", "push-posters-v2", "01-program-push-usahawan.png");
const LOGO = path.join(ROOT, "pushlife", "logo fathopes.png");
const jobs = [
  { bg: "PUSH-2_hero_tanker.jpg", out: "01-nb2-real-tanker.png", copy: `EXACT TEXT, spell perfectly and show only once:\nHeadline: "Ada kenderaan dan nak jadi Usahawan Hijau?"\nSubline: "Program PUSH FatHopes buka peluang untuk kutip minyak masak terpakai dan jana pendapatan sendiri."\nRounded information pill: "Beli dan kutip minyak masak terpakai"\nCTA: "Mohon sekarang."` },
  { bg: "PUSH-3_hero_worker-oil.jpg", out: "02-nb2-real-worker.png", copy: `EXACT TEXT, spell perfectly and show only once:\nHeadline: "Kopivosian tompinai Sabah."\nSubline: "Kamurang mau tukar minyak masak terpakai pigi duit?"\nRounded information pill: "Beli dan kutip minyak masak terpakai"\nCTA: "Mohon sekarang."` },
  { bg: "PUSH-4_hero_newtanker.jpg", out: "03-nb2-real-tanker-team.png", copy: `EXACT TEXT, spell perfectly and show only once:\nHeadline: "Korang tahu tak?"\nSubline: "Minyak masak terpakai pun boleh jadi duit."\nRounded information pill: "Beli dan kutip minyak masak terpakai"\nCTA: "Mohon sekarang."` },
  { bg: "PUSH-5_hero_team-newtanker.jpg", out: "04-nb2-real-team.png", copy: `EXACT TEXT, spell perfectly and show only once:\nHeadline: "Ada minyak masak terpakai?"\nSubline: "Jom jadi Usahawan Hijau bersama FatHopes."\nRounded information pill: "Beli dan kutip minyak masak terpakai"\nCTA: "Mohon sekarang."` },
];

async function loadEnv() {
  for (const name of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, name), "utf8");
      for (const line of raw.split("\n")) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
}

async function upload(base, key, file) {
  const ext = path.extname(file).toLowerCase();
  const type = ext === ".png" ? "image/png" : "image/jpeg";
  const response = await fetch(`${base}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": type, "x-filename": path.basename(file) }, body: await fs.readFile(file) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.url) throw new Error(`Upload failed ${path.basename(file)}: ${JSON.stringify(json).slice(0, 240)}`);
  return json.url;
}

async function main() {
  await loadEnv();
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  const key = process.env.MB_KEY || process.env.MB_API_KEY;
  if (!key) throw new Error("Missing MB_KEY or MB_API_KEY");
  const outDir = path.join(ROOT, "FatHopes IMG", "push-posters-nb2-real");
  await fs.mkdir(outDir, { recursive: true });
  const template = await upload(base, key, TEMPLATE);
  const logo = await upload(base, key, LOGO);
  for (const job of jobs) {
    process.stdout.write(`${job.out} ... `);
    const background = await upload(base, key, path.join(ROOT, "FatHopes IMG", "poster-refs", job.bg));
    const prompt = `Create one polished 4:5 vertical Facebook/Instagram hiring poster for FatHopes Energy Program PUSH.\n\nUse Image1 as the exact current multi-location PUSH poster layout and typography reference: preserve the same clean Apple-style hierarchy, generous white translucent upper area, large black headline, green accent, rounded CTA, and real-photo-led lower half. Preserve the same rounded translucent information-pill element from the poster, but do not write the label JOB DESC anywhere. Use that pill for the localized quote specified below. Do not copy the old text.\nUse Image2 as the exact real photographic background. Keep the real truck, workers, faces, uniforms, setting, and photographic texture unchanged. Do not generate an AI background, do not invent people, and do not replace any real face.\nUse Image3 only as the official FatHopes logo reference and preserve the logo accurately.\n\nDo not include the words JOB DESC, any job-desc heading, salary claim, fake phone number, address, or extra logos. Keep the copy conversational and localized, short and natural, like the existing state-specific PUSH ads. Add only the exact text below, with no spelling errors, no duplicated words, no gibberish, and no other text:\n\n${job.copy}\n\nSmall supporting line: "Usahawan, bukan kerja bergaji tetap"\nLocation line: "Seluruh Malaysia"\nFooter line: "Kutip minyak masak terpakai. Bina nilai baharu."\n\nKeep all text large, readable on mobile, and arranged like Image1. Use only the real background from Image2; no AI-generated scenery, no illustration, no watermark.`;
    const response = await fetch(`${base}/api/generate`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt, inputImages: [template, background, logo], generationOptions: { aspect_ratio: "4:5", resolution: "2K" } }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== "completed" || !result.outputUrl) throw new Error(`Generation failed: HTTP ${response.status} ${JSON.stringify(result).slice(0, 300)}`);
    const image = await fetch(result.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    await fs.writeFile(path.join(outDir, job.out), Buffer.from(await image.arrayBuffer()));
    console.log("saved");
  }
  console.log(`Done: ${outDir}`);
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
