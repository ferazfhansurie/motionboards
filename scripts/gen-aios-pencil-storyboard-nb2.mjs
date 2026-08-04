import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const OUT = path.join(ROOT, "aios/outputs/aios-pencil-storyboard.png");
const PROMPT = `Create a production storyboard sheet for a vertical 9:16 founder-led launch video about AIOS. Generate 15 numbered storyboard panels arranged clearly on one portrait page. This is only a rough pencil storyboard: monochrome graphite pencil on white paper, loose hand-drawn thumbnails, visible construction lines, arrows for camera movement, simple handwritten shot notes, no colour, no polished illustration, no photorealism. Keep the same three distinct founders consistent in every panel: Faeez, Firaz and Putri, shown as young Malaysian startup teammates in a simple office.

STORY AND PANEL ORDER:
1. All three founders crowd into frame toward camera, urgent cold open: “Hey guys, we’ve got a problem.”
2. Cut to Faeez close-up, awkward expression, chaotic message bubbles and crossed communication lines: “I miscommunicate a lot.”
3. Cut to Firaz close-up, forgotten notes and reminders falling around him: “I forget things…”
4. Cut to Putri close-up, learning notes and a new-person feeling: “And I’m still new to this...”
5. Wide office shot with all three surrounded by messages, documents and sticky notes moving chaotically: “And people keep telling us to slow down.”
6. Everything freezes mid-air. A large pause symbol and slow-motion arrows: “But honestly… what if we didn’t need to slow down?”
7. The chaos reorganises into one clean shared AI workspace glowing on a laptop/tablet in the centre of the team: “What if our whole team had one shared AI workspace?”
8. Over-the-shoulder shot of the three founders inside one group channel, each contributing a question: “An AI you can talk to inside a group channel.”
9. Fast three-part thumbnail sequence: one founder bounces an idea, one asks a question, one receives a solution. Arrows connect them: “Bounce ideas. Ask questions. Solve problems together.”
10. A generic robot produces a pile of bland repeated answers. The team looks unimpressed and crosses them out: “Not generic AI answers…”
11. Camera dives into AIOS: secure folders, team documents and internal knowledge connect into one answer. Use a lock icon and linking arrows: “Answers based on your team, your documents and your secured business data.”
12. Hero reveal of the AIOS interface between the three founders: “That’s what we’re building with AIOS.”
13. AIOS sends different context-based solutions to the team: business problem, document, answer and action plan connected in one flow: “An AI operating system that gives your business and team context-based answers and solutions.”
14. A silly basic robot with a speech bubble saying “AI is stupid” glitches and breaks apart, replaced by a confident AIOS system diagram: “While everyone is still saying AI is stupid…”
15. Strong final low-angle group shot. Faeez, Firaz and Putri stand together facing camera with AIOS behind them and forward arrows: “Come watch how we change the game.”

Use varied storyboard camera language: handheld push-in, close-ups, match cuts, overhead office wide, freeze-frame, over-the-shoulder UI shot, insert details, top-down diagram and final hero shot. Clearly separate each panel with thin pencil borders. Keep the founders’ faces, hairstyles and clothing consistent. The exact dialogue may be represented as short handwritten notes, but prioritise readable panel order and visual storytelling. No extra people, no corporate stock-photo look, no colour, no 3D render, no finished ad artwork, no watermark.`;

async function loadEnv() {
  for (const file of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, file), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
}

async function main() {
  await loadEnv();
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  const base = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");
  if (!key) throw new Error("Missing Motionboards API key");
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemini-3.1-flash-image-preview", prompt: PROMPT, generationOptions: { aspect_ratio: "9:16", resolution: "2K" } }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== "completed" || !result.outputUrl) throw new Error(`generation failed HTTP ${response.status}: ${JSON.stringify(result).slice(0, 1200)}`);
  const image = await fetch(result.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, Buffer.from(await image.arrayBuffer()));
  console.log(`saved ${OUT}`);
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
