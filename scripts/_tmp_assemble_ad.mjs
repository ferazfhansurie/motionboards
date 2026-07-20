// Final assembly: A-roll (kid talking) for beats 1,2,5,6 + B-roll cutaways for
// beats 3,4 with the kid's narration audio from those beats mixed ON TOP of the
// b-roll's own ambient sound (ducked low), so the voice never stops.
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const pexec = promisify(execFile);

const ROOT = "/Users/faeez/motionboards";
const CLIPS = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");
const BROLL = path.join(CLIPS, "broll");

async function safePath(p) {
  try { await fs.access(p); } catch { return p; }
  const ext = path.extname(p);
  const base = p.slice(0, -ext.length);
  for (let n = 2; ; n++) {
    const candidate = `${base}-v${n}${ext}`;
    try { await fs.access(candidate); } catch { return candidate; }
  }
}

// Replace a b-roll clip's audio with: narration (from the matching A-roll clip)
// at full volume + the b-roll's own ambient audio ducked to ~18% underneath.
async function mixBrollWithNarration(brollMp4, narrationMp4, outMp4) {
  await pexec("ffmpeg", [
    "-y",
    "-i", brollMp4,
    "-i", narrationMp4,
    "-filter_complex",
    "[0:a]volume=0.18[amb];[1:a]volume=1.0[voice];[amb][voice]amix=inputs=2:duration=shortest:dropout_transition=0[aout]",
    "-map", "0:v:0",
    "-map", "[aout]",
    "-c:v", "copy",
    "-shortest",
    outMp4,
  ]);
  return outMp4;
}

async function concat(mp4s, outFile) {
  const listFile = path.join(CLIPS, "_assemble-concat-list.txt");
  await fs.writeFile(listFile, mp4s.map((f) => `file '${f}'`).join("\n"));
  await pexec("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outFile]);
  return outFile;
}

async function main() {
  await fs.mkdir(BROLL, { recursive: true });

  const c1 = path.join(CLIPS, "omni-kid-wrap-c1.mp4");
  const c2 = path.join(CLIPS, "omni-kid-wrap-c2.mp4");
  const c3 = path.join(CLIPS, "omni-kid-wrap-c3.mp4"); // narration source for broll A
  const c4 = path.join(CLIPS, "omni-kid-wrap-c4.mp4"); // narration source for broll B
  const c5 = path.join(CLIPS, "omni-kid-wrap-c5.mp4");
  const c6 = path.join(CLIPS, "omni-kid-wrap-c6.mp4");

  const brollA = path.join(BROLL, "wrap-broll-lowangle-c3.mp4");
  const brollB = path.join(BROLL, "wrap-broll-overhead-c4.mp4");

  console.log("mixing broll A (c3 narration over low-angle wrap shot)...");
  const mixedA = await mixBrollWithNarration(brollA, c3, await safePath(path.join(CLIPS, "mixed-broll-c3.mp4")));
  console.log(" ->", path.relative(ROOT, mixedA));

  console.log("mixing broll B (c4 narration over overhead wrap shot)...");
  const mixedB = await mixBrollWithNarration(brollB, c4, await safePath(path.join(CLIPS, "mixed-broll-c4.mp4")));
  console.log(" ->", path.relative(ROOT, mixedB));

  console.log("assembling final ad: c1 -> c2 -> broll(c3 voice) -> broll(c4 voice) -> c5 -> c6 ...");
  const finalOut = await safePath(path.join(CLIPS, "HYPERWRAPZ-WRAP-AD-FINAL.mp4"));
  const full = await concat([c1, c2, mixedA, mixedB, c5, c6], finalOut);
  console.log("FINAL AD:", path.relative(ROOT, full));
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
