// Native Gemini Omni Flash reference_to_video: girl + studio + studio -> 1 clip.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

const ROOT = "/Users/faeez/motionboards";
const REFDIR = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-refs");
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
async function imgB64(file) {
  const buf = await sharp(file).resize({ width: 1080, height: 1920, fit: "inside" }).png().toBuffer();
  return buf.toString("base64");
}

async function main() {
  await loadEnv();
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const girl = await imgB64(path.join(REFDIR, "girl-01.png"));
  const s1 = await imgB64(path.join(REFDIR, "studio-01-wide.png"));
  const s2 = await imgB64(path.join(REFDIR, "studio-02-side.png"));

  const prompt = `The young Malaysian-Chinese woman from the reference image stands
in the real car-wrap detailing studio from the reference images, on the red-accent
floor path, smiling warmly and gesturing toward the colourful vinyl wrap rolls on
the wall as she presents to camera. Friendly upbeat female voice speaking casually
about a colour-change wrap service; quiet studio room tone, light music. Smooth
steady camera slowly pushing in. Photoreal, candid, no text overlays, no watermark.`;

  const input = [
    { type: "image", data: girl, mime_type: "image/png" },
    { type: "image", data: s1, mime_type: "image/png" },
    { type: "image", data: s2, mime_type: "image/png" },
    { type: "text", text: prompt },
  ];

  console.log("creating interaction (reference_to_video, 3 images)...");
  let interaction;
  try {
    interaction = await ai.interactions.create({
      model: "gemini-omni-flash-preview",
      input,
      background: true,
      store: true,
      response_format: { type: "video", delivery: "uri" },
      generation_config: {
        video_config: { task: "reference_to_video" },
      },
    });
  } catch (e) {
    console.error("CREATE ERROR:", e.message);
    process.exit(1);
  }
  console.log("interaction id:", interaction.id, "status:", interaction.status);

  let status = interaction.status;
  let tries = 0;
  while (status !== "completed" && status !== "failed" && tries < 60) {
    await new Promise((r) => setTimeout(r, 6000));
    process.stdout.write(".");
    const cur = await ai.interactions.get(interaction.id);
    status = cur.status;
    interaction = cur;
    tries++;
  }
  console.log("\nfinal status:", status);
  if (status !== "completed") {
    console.log("full:", JSON.stringify(interaction, null, 2).slice(0, 2000));
    process.exit(1);
  }

  console.log("FULL INTERACTION:", JSON.stringify(interaction, null, 2).slice(0, 3000));
  await fs.writeFile(path.join(OUT, "_debug-interaction.json"), JSON.stringify(interaction, null, 2));

  // best-effort search for a uri anywhere in the object
  function findUri(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (typeof obj.uri === "string") return obj.uri;
    for (const k of Object.keys(obj)) {
      const r = findUri(obj[k]);
      if (r) return r;
    }
    return null;
  }
  const uri = findUri(interaction);
  if (!uri) { console.log("no uri found anywhere. Saved full JSON to _debug-interaction.json"); process.exit(1); }
  console.log("found uri:", uri);

  const r = await fetch(uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${apiKey}`);
  if (!r.ok) { console.log("download failed", r.status, await r.text()); process.exit(1); }
  const buf = Buffer.from(await r.arrayBuffer());
  const outPath = path.join(OUT, "wrap-omni-ref2video.mp4");
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(outPath, buf);
  console.log("SAVED:", path.relative(ROOT, outPath));
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
