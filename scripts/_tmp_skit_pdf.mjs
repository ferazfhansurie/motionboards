// Render the skit one-pager to a minimalist A4 PDF.
//   node scripts/_tmp_skit_pdf.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "aios", "outputs", "2026-07-13-skit-one-pager");

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 210mm; height: 297mm; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #141414; background: #fff;
    padding: 16mm 15mm 12mm;
    font-size: 8.6pt; line-height: 1.42;
  }
  .rule { border: 0; border-top: 1.4pt solid #141414; margin: 4.5mm 0 5mm; }
  .micro { font-size: 6.4pt; letter-spacing: 1.8pt; text-transform: uppercase; color: #8a8a8a; }
  .micro b { color: #f4711c; font-weight: 700; }
  h1 { font-size: 21pt; letter-spacing: -0.4pt; font-weight: 800; margin-top: 2.2mm; }
  h1 span { color: #f4711c; }
  .concept { margin-top: 2.8mm; max-width: 165mm; color: #333; font-size: 8.8pt; }
  .concept em { font-style: normal; font-weight: 700; color: #141414; }

  .grid { display: grid; grid-template-columns: 1.42fr 1fr; gap: 9mm; margin-top: 5mm; }

  h2 { font-size: 7pt; letter-spacing: 1.6pt; text-transform: uppercase; color: #172346;
       border-bottom: 0.6pt solid #d9d9d9; padding-bottom: 1.6mm; margin-bottom: 2.6mm; }
  h2:not(:first-child) { margin-top: 5mm; }

  ol.shots { list-style: none; counter-reset: s; }
  ol.shots li { counter-increment: s; display: flex; gap: 2.6mm; padding: 1.15mm 0; }
  ol.shots li::before {
    content: counter(s, decimal-leading-zero);
    font-weight: 800; font-size: 7.2pt; color: #f4711c; min-width: 5.4mm; padding-top: 0.4mm;
  }
  ol.shots li.freeze { background: #fff4ec; margin: 0 -2mm; padding-left: 2mm; padding-right: 2mm; border-radius: 1.2mm; }
  ol.shots .q { color: #555; }

  ul.plain { list-style: none; }
  ul.plain li { padding: 0.9mm 0 0.9mm 4mm; position: relative; }
  ul.plain li::before { content: ""; position: absolute; left: 0; top: 2.55mm; width: 1.7mm; height: 1.7mm; background: #141414; }
  ul.plain.orange li::before { background: #f4711c; }

  .cast { margin-top: 5mm; background: #141414; color: #fff; border-radius: 1.6mm; padding: 3mm 3.6mm; font-size: 8.2pt; }
  .cast b { color: #f4711c; }

  .foot { margin-top: 5.5mm; border-top: 1.4pt solid #141414; padding-top: 3mm;
          display: flex; align-items: baseline; justify-content: space-between; }
  .foot .end { font-size: 9.6pt; font-weight: 800; }
  .foot .end span { color: #f4711c; }
  .foot .cta { font-size: 7pt; letter-spacing: 1.4pt; text-transform: uppercase; color: #8a8a8a; }
</style></head>
<body>

  <div class="micro"><b>ADletic</b> &nbsp;·&nbsp; Skit one-pager &nbsp;·&nbsp; 30–40s vertical ad &nbsp;·&nbsp; Custom AI Dashboard</div>
  <h1>3 Minit Sebelum <span>Bos</span> Sampai</h1>
  <hr class="rule">

  <p class="concept">Staff pulls an all-nighter and oversleeps at his desk. Boss voice-notes that he is on his way for the numbers. Staff tears the room apart while the boss walks the corridor — and just as the door handle turns, <em>time freezes</em>. One notification from the AI dashboard he built delivers the answer. Door opens, boss starts shouting, staff calmly cuts him off with the exact revenue.</p>

  <div class="grid">
    <div>
      <h2>Shot + Action</h2>
      <ol class="shots">
        <li>Close-up hand on desk, phone lights up — boss voice note: <span class="q">"otw ke bilik kau, aku nak untung bulan ni"</span></li>
        <li>Close-up face asleep on desk, post-it on cheek — eyes snap open, sits up</li>
        <li>Medium — office is a mess, he realises he overslept the meeting</li>
        <li>Panic montage — folders flip, papers fly, 12 Excel tabs, corrupt FINAL_v7, checks watch</li>
        <li>Slow-mo intercut — boss's shoes walking the corridor, no face</li>
        <li>Cross-cut — panic vs shoes, shadow grows under the door</li>
        <li class="freeze">Boss's hand grips the handle — everything freezes mid-air</li>
        <li class="freeze">Phone ding — his AI: <span class="q">"Profit RM128,540 ▲12%. Report dah email kat bos"</span></li>
        <li class="freeze">Frozen panic-face turns into a grin — time resumes, papers drop</li>
        <li>Door bursts open, boss shouts off-screen — staff cuts him off: <span class="q">"Revenue RM128,540, naik 12%, report dalam email bos"</span></li>
        <li>Boss: <span class="q">"…oh. Bagus."</span> Door closes, staff collapses into chair</li>
        <li>End card over slumped staff — phone drops on desk, mirrors shot 01</li>
      </ol>
    </div>

    <div>
      <h2>Prop List</h2>
      <ul class="plain">
        <li>Phone ×2 (hero + screen inserts)</li>
        <li>Laptop, 12 Excel tabs open</li>
        <li>Paper stacks, folders, post-its</li>
        <li>Cold coffee cup</li>
        <li>Desk + office chair</li>
        <li>Blazer + office shoes (boss stand-in)</li>
        <li>Fishing line + 2 sheets (freeze, optional)</li>
        <li>AI notification mock screen</li>
      </ul>

      <h2>Shot List</h2>
      <ul class="plain orange">
        <li>Macro — hand + phone on desk</li>
        <li>Close-up — face: asleep / wake / grin</li>
        <li>Medium — desk + room chaos</li>
        <li>Wide — full office reveal</li>
        <li>Slow-mo low angle — shoes, corridor</li>
        <li>Close-up — door handle + shadow</li>
        <li>Insert — phone screen ×2</li>
        <li>Insert — laptop screen</li>
        <li>Static medium — end card</li>
      </ul>

      <h2>Set List</h2>
      <ul class="plain">
        <li>Office room with desk (90% of skit)</li>
        <li>Corridor outside the room</li>
        <li>The door, both sides</li>
      </ul>

      <div class="cast"><b>Cast:</b> 1 actor. Boss = shoes, hand + voice only.</div>
    </div>
  </div>

  <div class="foot">
    <div class="end">"Dia bina AI dia sendiri. You tak payah — <span>kami buatkan.</span>"</div>
    <div class="cta">ADletic · Free KPI Leak Check</div>
  </div>

</body></html>`;

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const htmlPath = path.join(OUT_DIR, "skit-one-pager.html");
  const pdfPath = path.join(OUT_DIR, "skit-3-minit-one-pager.pdf");
  await fs.writeFile(htmlPath, html, "utf8");

  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const launchOptions = await fs.access(chromePath).then(
    () => ({ headless: true, executablePath: chromePath }),
    () => ({ headless: true }),
  );
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
  await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
  await browser.close();
  console.log("saved", pdfPath);
}
main().catch((e) => { console.error(e); process.exit(1); });
