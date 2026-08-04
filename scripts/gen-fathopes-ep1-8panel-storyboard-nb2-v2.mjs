import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/fathopes-ep1-8panel-storyboard-nb2-v4-no-captions.png");
const REFS = [
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard-frames/clip2-next15-last-frame.jpg"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Kit-Action.png"),
  path.join(ROOT, "FatHopes IMG/drive-download-20260627T093124Z-3-001/Sparron-Action.png"),
  path.join(ROOT, "fathopes-heroes-series-bible/Generated image 1.png"),
  path.join(ROOT, "aios/outputs/fathopes-heroes-ep1-next-storyboard/aunty-reference-from-clip1.jpg"),
  path.join(ROOT, "public/Fathopes_heroes_animated/superheroes-group.png"),
];

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

async function toDataUri(file) {
  const b = await sharp(file).resize({ width: 900, height: 1200, fit: "inside" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${b.toString("base64")}`;
}

const prompt = `Create a pure visual 8-panel storyboard sheet on a true vertical 9:16 canvas. Arrange exactly 8 separate portrait-oriented panels in a 2-column by 4-row vertical storyboard layout. Each panel must be portrait-oriented with a 9:16 composition inside its cell; never stretch, rotate or make any panel landscape. Use clean gutters between panels. Pure visuals only: absolutely no captions, speech bubbles, text, labels, numbers, arrows or subtitles.

Reference roles: Image 1 is the exact opening catch frame and kitchen composition. Image 2 locks Kit’s exact identity: same face, black wide-brim hat, teal workwear jumpsuit, reflective silver bands, black gloves and black boots in every panel. Image 3 locks Sparron’s exact identity: same blonde hair, green visor, black long-sleeve top, green pants, utility belt, black gloves and black boots in every panel. Image 4 locks the separate oily worm monster design. Image 5 is the exact aunty from the previous clip: preserve her face, hair, beige top, brown pants, body shape and kitchen continuity. Image 6 locks the three-superhero lab lineup and hero identities. The worm monster is not Glinciro.

Keep the same 2D animated character style over the realistic kitchen, with identical faces, outfits, colours, linework and proportions across all panels. Show clear cause-and-effect and realistic gravity.

Panel 1: same Malaysian kitchen, Kit and Sparron carefully lower the oily worm into the open black bag. The worm is physically supported by Kit and the bag is below it.
Panel 2: medium close-up of the worm halfway inside the bag, Kit’s gloved hands holding it and Sparron pulling the bag open. Keep gravity and hand contact correct.
Panel 3: top-down close-up as the worm is fully inside; Sparron ties or closes the bag only after the worm has entered. Kit holds the bag steady.
Panel 4: close-up of the exact aunty from Image 5, smiling gratefully toward Kit and Sparron in the kitchen. Show her natural thankful expression and hand gesture; no text or speech bubble. Her spoken line is “Thank you geng FatHopes” but represent it only through acting.
Panel 5: hard cut to an establishing wide shot of a clean FatHopes laboratory. Three superheroes stand around a worktable, with the sealed clear specimen tube and the worm visible in the background. Match Image 6 for the three-hero lineup and outfits.
Panel 6: POV from the worm’s eyes inside the clear tube, looking up through glass at the three superheroes. Sparron appears to be asking, “Hmm macam mana boleh wujud benda ni” through facial expression and gesture; no text.
Panel 7: reverse medium shot of the three heroes investigating the tube. Kit appears to reply, “Taktahula tapi aku tahu dia buruk” through facial expression and gesture; no text. Keep the other hero present and consistent.
Panel 8: extreme close-up of the worm’s sad face behind the glass, oily drips and defeated eyes, with the three heroes softly blurred in the background. End on a funny sympathetic expression.

Use distinct cinematic angles: medium-wide kitchen, close-up, top-down bag shot, aunty close-up, laboratory establishing shot, tube POV, reverse dialogue shot and worm close-up. Keep every character’s hands, grip, object positions and gravity physically consistent from panel to panel. No teleportation, morphing, floating objects, extra characters beyond the three heroes, alternate faces, changed clothing, warped anatomy, duplicate limbs, photorealistic humans, horror, gore or watermarks.`;

async function main() {
  await loadEnv();
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  if (!key) throw new Error("Missing MB_API_KEY or MB_KEY");
  const r = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt, inputImages: await Promise.all(REFS.map(toDataUri)), generationOptions: { aspect_ratio: "9:16", resolution: "2K" } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status !== "completed" || !j.outputUrl) throw new Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0, 800)}`);
  const img = await fetch(j.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, Buffer.from(await img.arrayBuffer()));
  console.log(`saved ${OUT}`);
}
main().catch((e) => { console.error(e.stack || e.message); process.exitCode = 1; });
