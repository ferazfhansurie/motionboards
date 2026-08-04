import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const [requestId, generationId, model = "dreamina-seedance-2-0-260128/omni", resolution = "1080p", outputPath] = process.argv.slice(2);
const MODEL = model;

if (!requestId || !generationId) throw new Error("Usage: node scripts/poll-seedance-generation.mjs <requestId> <generationId>");

const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
const env = {};
for (const line of raw.split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const base = (env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
const qs = new URLSearchParams({ requestId, modelId: MODEL, generationId, byteplusVideo: "true", durationSec: "15", resolution });
const response = await fetch(`${base}/api/generate/status?${qs}`, { headers: { Authorization: `Bearer ${env.MB_KEY || env.MB_API_KEY}` } });
const body = await response.json().catch(() => ({}));
if (outputPath && body.status === "completed" && body.outputUrl) {
  const video = await fetch(body.outputUrl, { headers: { Authorization: `Bearer ${env.MB_KEY || env.MB_API_KEY}` } });
  if (!video.ok) throw new Error(`Download failed: HTTP ${video.status}`);
  const destination = path.join(ROOT, outputPath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, Buffer.from(await video.arrayBuffer()));
  body.savedTo = destination;
}
console.log(JSON.stringify({ http: response.status, status: body.status, hasOutput: Boolean(body.outputUrl), outputUrl: body.outputUrl || null, error: body.error || null }));
