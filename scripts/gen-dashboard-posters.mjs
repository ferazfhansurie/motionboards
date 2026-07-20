// ADletic custom dashboard offer posters.
// Exact-text HTML/CSS render to PNG, with editorial object-staging style.
//   node scripts/gen-dashboard-posters.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "aios", "outputs", "2026-07-08-adletic-dashboard-posters");
const LOGO = path.join(ROOT, "public", "Freelance", "Adetic.png");

async function dataUri(file, type = "image/png") {
  const buf = await fs.readFile(file);
  return `data:${type};base64,${buf.toString("base64")}`;
}

const posters = [
  {
    slug: "01-kpi-leak-check",
    kicker: "FREE KPI LEAK CHECK",
    title: "Berapa revenue hilang dalam report yang tak pernah dibuka?",
    sub: "Hantar sheet, CRM export atau sales report. Kami cari KPI leak dan tunjuk dashboard yang bisnes you patut ada.",
    cta: "Audit free. Isi form.",
    scene: "autopsy",
  },
  {
    slug: "02-followup-leak",
    kicker: "FOLLOW-UP LEAK",
    title: "Lead masuk. Tapi siapa follow-up?",
    sub: "Kalau jawapan dia kena buka 4 file dulu, dashboard you belum cukup kerja.",
    cta: "Check leak free.",
    scene: "phoneScene",
  },
  {
    slug: "03-spreadsheet-maze",
    kicker: "BUSINESS DASHBOARD",
    title: "12 sheet. 0 jawapan.",
    sub: "Sales kat satu file. Cashflow kat satu file. Team update dalam WhatsApp. Kita satukan jadi dashboard yang boleh guna.",
    cta: "Dapatkan blueprint.",
    scene: "sheets",
  },
  {
    slug: "04-monday-meeting",
    kicker: "FOUNDER VIEW",
    title: "Masuk Monday meeting dah tahu number.",
    sub: "Revenue, ads spend, follow-up, fulfilment, cashflow. Semua depan mata sebelum orang tanya.",
    cta: "Build my dashboard.",
    scene: "meeting",
  },
  {
    slug: "05-command-center",
    kicker: "CUSTOM DASHBOARD DEV",
    title: "Satu dashboard. Semua nombor penting.",
    sub: "Untuk owner yang dah penat buat keputusan dari screenshot, export CSV dan rasa-rasa.",
    cta: "Free KPI Leak Check.",
    scene: "command",
  },
];

function html(p, logoUri) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1080, initial-scale=1">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #111; font-family: Helvetica Neue, Helvetica, Arial, sans-serif; }
  .poster {
    position: relative;
    width: 1080px;
    height: 1920px;
    overflow: hidden;
    background:
      radial-gradient(circle at 25% 18%, rgba(237, 104, 28, .18), transparent 28%),
      radial-gradient(circle at 82% 6%, rgba(255, 255, 255, .08), transparent 26%),
      linear-gradient(160deg, #15171a 0%, #0d0f11 54%, #171411 100%);
    color: #f5f1ea;
  }
  .grain {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px);
    background-size: 7px 7px, 11px 11px;
    opacity: .34;
    mix-blend-mode: soft-light;
  }
  .stage { position: absolute; inset: 0; padding: 92px 76px 72px; }
  .kicker {
    display: inline-flex; align-items: center; gap: 12px;
    color: #f47a20; font-weight: 800; letter-spacing: 2.4px;
    font-size: 25px; text-transform: uppercase;
  }
  .kicker:before { content: ""; width: 34px; height: 6px; background: #f47a20; border-radius: 99px; }
  h1 {
    margin: 34px 0 0;
    max-width: 920px;
    font-size: 88px;
    line-height: .99;
    letter-spacing: 0;
    font-weight: 820;
  }
  .sub {
    position: absolute;
    left: 76px; right: 76px; bottom: 226px;
    font-size: 38px; line-height: 1.18; font-weight: 650;
    color: rgba(245,241,234,.92);
  }
  .cta {
    position: absolute;
    left: 76px; bottom: 118px;
    font-size: 45px; line-height: 1; font-weight: 850;
    color: #fff;
  }
  .cta span { color: #f47a20; }
  .brand {
    position: absolute; right: 76px; bottom: 68px;
    width: 128px; height: 128px; border-radius: 999px;
    filter: drop-shadow(0 12px 22px rgba(0,0,0,.45));
  }
  .scene { position: absolute; left: 76px; right: 76px; top: 560px; height: 880px; }
  .paper {
    position: absolute;
    background: #f4efe4;
    color: #171717;
    box-shadow: 0 30px 70px rgba(0,0,0,.38);
    border-radius: 8px;
  }
  .report { width: 610px; height: 720px; left: 20px; top: 70px; transform: rotate(-4deg); padding: 44px; }
  .report h2 { margin: 0 0 30px; font-size: 34px; line-height: 1; }
  .line { height: 18px; background: #222; opacity: .12; border-radius: 99px; margin: 18px 0; }
  .line.short { width: 62%; }
  .chart { position: absolute; left: 44px; right: 44px; bottom: 44px; height: 180px; border-left: 5px solid #222; border-bottom: 5px solid #222; opacity: .84; }
  .bar { position: absolute; bottom: 0; width: 52px; background: #f47a20; border-radius: 8px 8px 0 0; }
  .bar:nth-child(1){ left: 42px; height: 62px; } .bar:nth-child(2){ left: 142px; height: 126px; background:#172346; }
  .bar:nth-child(3){ left: 242px; height: 92px; } .bar:nth-child(4){ left: 342px; height: 158px; background:#172346; }
  .screen {
    position: absolute; right: 0; top: 0; width: 500px; height: 610px;
    border-radius: 34px; background: linear-gradient(150deg,#f7f3ea,#dfe6ef);
    box-shadow: 0 36px 92px rgba(0,0,0,.46); padding: 34px;
    transform: rotate(5deg);
  }
  .screen:before { content: ""; position: absolute; inset: 18px; border-radius: 24px; border: 1px solid rgba(0,0,0,.08); }
  .dash-title { height: 22px; width: 180px; background: #172346; border-radius: 99px; margin-bottom: 34px; }
  .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .kpi { height: 116px; border-radius: 20px; background: #fff; box-shadow: inset 0 0 0 1px rgba(0,0,0,.05); padding: 18px; }
  .kpi b { display: block; width: 70px; height: 18px; background: #f47a20; border-radius: 99px; margin-bottom: 18px; }
  .kpi i { display: block; width: 118px; height: 30px; background: #172346; border-radius: 99px; }
  .tag {
    position: absolute; background: #f47a20; color: white; font-size: 28px; line-height: 1;
    font-weight: 850; padding: 18px 22px; border-radius: 8px;
    box-shadow: 0 20px 45px rgba(0,0,0,.32);
    transform: rotate(-7deg);
  }
  .tag.one { left: 430px; top: 380px; } .tag.two { left: 90px; top: 710px; transform: rotate(4deg); background: #172346; }
  .mock-phone {
    position: absolute; left: 270px; top: 70px; width: 430px; height: 820px;
    background: #0b0c0f; border-radius: 56px; padding: 28px;
    box-shadow: 0 42px 100px rgba(0,0,0,.55); transform: rotate(-5deg);
  }
  .phone-inner { height: 100%; border-radius: 38px; background: #f6f2eb; padding: 42px 30px; color: #1a1a1a; }
  .bubble { background: #ddf7c8; border-radius: 28px 28px 8px 28px; padding: 26px; font-size: 32px; line-height: 1.13; font-weight: 750; margin-top: 220px; }
  .time { text-align: right; color: rgba(0,0,0,.45); font-size: 24px; margin-top: 12px; font-weight: 700; }
  .sheetstack .paper { width: 680px; height: 520px; padding: 34px; }
  .sheetstack .p1 { left: 50px; top: 180px; transform: rotate(-8deg); }
  .sheetstack .p2 { left: 160px; top: 120px; transform: rotate(4deg); background:#fbfaf7; }
  .sheetstack .p3 { left: 260px; top: 250px; transform: rotate(10deg); background:#f0efe8; }
  .cellgrid { display: grid; grid-template-columns: repeat(5,1fr); gap: 9px; margin-top: 18px; }
  .cell { height: 42px; background: rgba(23,35,70,.12); border-radius: 5px; }
  .cell.hot { background: #f47a20; }
  .meeting-card {
    position:absolute; left: 38px; top: 120px; right: 38px; height: 620px;
    border-radius: 30px; background: #f5f1ea; color:#171717; box-shadow:0 40px 100px rgba(0,0,0,.5);
    padding: 46px;
  }
  .meeting-row { display:flex; align-items:center; justify-content:space-between; padding: 24px 0; border-bottom: 2px solid rgba(0,0,0,.08); font-size:34px; font-weight:800; }
  .meeting-row span:last-child { color:#f47a20; }
  .command-screen {
    position:absolute; left: 30px; right: 30px; top: 80px; height: 690px;
    border-radius: 40px; background: linear-gradient(155deg,#f7f2e9,#e6edf1); color:#151515;
    box-shadow:0 50px 110px rgba(0,0,0,.55); padding:42px;
  }
  .command-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:24px; height:520px; }
  .panel { background:#fff; border-radius:24px; padding:24px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
  .big-num { font-size:76px; font-weight:900; color:#172346; line-height:1; margin-top:36px; }
  .spark { height:160px; margin-top:60px; border-radius:20px; background: linear-gradient(135deg, rgba(244,122,32,.22), rgba(23,35,70,.18)); position:relative; }
  .spark:after { content:""; position:absolute; left:32px; right:32px; top:70px; height:8px; background:#f47a20; transform:skewY(-12deg); border-radius:99px; }
</style>
</head>
<body>
<main class="poster">
  <div class="grain"></div>
  <section class="stage">
    <div class="kicker">${p.kicker}</div>
    <h1>${p.title}</h1>
    <div class="scene ${p.scene}">
      ${scene(p.scene)}
    </div>
    <div class="sub">${p.sub}</div>
    <div class="cta">${p.cta.replace(/\.$/, "")}<span>.</span></div>
    <img class="brand" src="${logoUri}" />
  </section>
</main>
</body>
</html>`;
}

function scene(name) {
  if (name === "autopsy") return `
    <div class="paper report"><h2>MONTHLY SALES REPORT</h2><div class="line"></div><div class="line short"></div><div class="line"></div><div class="chart"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div></div>
    <div class="screen"><div class="dash-title"></div><div class="kpis"><div class="kpi"><b></b><i></i></div><div class="kpi"><b></b><i></i></div><div class="kpi"><b></b><i></i></div><div class="kpi"><b></b><i></i></div></div></div>
    <div class="tag one">UNTRACKED</div><div class="tag two">LEAK FOUND</div>`;
  if (name === "phoneScene") return `
    <div class="mock-phone"><div class="phone-inner"><div class="bubble">Bos, sales masuk tapi follow-up tak track. Nak saya build dashboard?</div><div class="time">8.47 PM</div></div></div>
    <div class="tag one">MISSED FOLLOW-UP</div>`;
  if (name === "sheets") return `
    <div class="sheetstack"><div class="paper p1"><div class="cellgrid">${cells()}</div></div><div class="paper p2"><div class="cellgrid">${cells()}</div></div><div class="paper p3"><div class="cellgrid">${cells()}</div></div></div>
    <div class="tag one">FILE FINAL v7</div><div class="tag two">WHERE SALES?</div>`;
  if (name === "meeting") return `
    <div class="meeting-card"><div class="meeting-row"><span>Revenue</span><span>LIVE</span></div><div class="meeting-row"><span>Cashflow</span><span>OK</span></div><div class="meeting-row"><span>Follow-up</span><span>12 OPEN</span></div><div class="meeting-row"><span>Ads spend</span><span>RM</span></div><div class="meeting-row"><span>Team output</span><span>TRACKED</span></div></div>`;
  return `
    <div class="command-screen"><div class="dash-title"></div><div class="command-grid"><div class="panel"><div class="line short"></div><div class="big-num">LIVE</div><div class="spark"></div></div><div class="panel"><div class="kpi"><b></b><i></i></div><br><div class="kpi"><b></b><i></i></div><br><div class="kpi"><b></b><i></i></div></div></div></div>`;
}

function cells() {
  return Array.from({ length: 45 }, (_, i) => `<div class="cell${i % 13 === 0 || i % 17 === 0 ? " hot" : ""}"></div>`).join("");
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const logoUri = await dataUri(LOGO);
  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const launchOptions = await fs.access(chromePath).then(
    () => ({ headless: true, executablePath: chromePath }),
    () => ({ headless: true }),
  );
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (const p of posters) {
    const file = path.join(OUT, `${p.slug}.html`);
    const png = path.join(OUT, `${p.slug}.png`);
    await fs.writeFile(file, html(p, logoUri), "utf8");
    await page.goto(`file://${file}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: png, fullPage: true });
    console.log(`saved ${png}`);
  }
  await browser.close();
  await fs.writeFile(path.join(OUT, "README.md"), `# ADletic custom dashboard posters

Lead magnet: Free KPI Leak Check
Offer: custom business dashboard development for Malaysian SMB owners.

The text is rendered in HTML/CSS for accuracy. Open any .html file to edit copy, then rerun:

\`\`\`
node scripts/gen-dashboard-posters.mjs
\`\`\`
`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
