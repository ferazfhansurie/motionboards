// aios.agency IG-DM outreach generator for ADletic.
// Reads a prospects CSV, writes ONE personalized, value-first DM per prospect
// (aios.agency voice), plus a tracker. Sending is MANUAL from the IG account
// (Instagram API cannot cold-DM). Re-run any time after adding prospects.
//   node scripts/gen-outreach-dms.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "aios", "outputs", "2026-07-13-adletic-detailing-outreach");
const CSV = path.join(DIR, "prospects.csv");
const MODEL = "claude-sonnet-4-6";

async function loadEnv() {
  for (const f of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      for (const l of raw.split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
    } catch {}
  }
}

function parseCSV(text) {
  const [head, ...rows] = text.trim().split("\n");
  const cols = head.split(",");
  return rows.filter(Boolean).map((r) => {
    const cells = r.split(","); const o = {};
    cols.forEach((c, i) => (o[c.trim()] = (cells[i] || "").trim()));
    return o;
  });
}

const SYSTEM = `You write ONE Instagram cold-outreach DM from "aios.agency" (a Malaysian marketing/ads agency run by Faeez) to the owner of a car detailing / coating studio. Goal: open a real conversation, NOT close a sale.

VOICE: Kuala Lumpur casual Manglish, warm, humble, peer-to-peer. Like one business owner texting another. NOT corporate, NOT a template, NOT hypey. Lowercase mostly. Max ONE emoji. NEVER use em-dashes.

THE MOST IMPORTANT RULE — MAKE ZERO CLAIMS OR ASSUMPTIONS:
You do NOT know anything about how their business, marketing, sales, bookings, or systems actually work. So do NOT diagnose them, do NOT imply they have a problem, and do NOT assert anything you cannot see. BANNED: "you're leaking", "stuck at berapa harga", "no system", "not enough reach", "relying on walk-ins", "losing customers/leads", "the marketing side leaks", or any guess about their numbers or operations. If you catch yourself describing their situation, delete it. Only ever reference what is PUBLICLY VISIBLE: their posted work, their niche, their area.

STRUCTURE (4-6 short lines, IG-DM length):
1. A genuine, specific compliment on their actual visible work (niche + area, so it's clearly not mass-sent).
2. One honest line on who you are / what you do: you run aios.agency, you help car detailing studios get more bookings through ads + content.
3. Offer value WITHOUT diagnosing: a free, no-obligation set of ideas / mini audit tailored to their studio, OR ask ONE genuine question (e.g. "you running any paid ads now or mostly organic?"). Frame it as giving, not fixing.
4. Soft, low-pressure ask to send it or chat.

HARD RULES:
- No link or URL (IG flags links in cold DMs). No phone number.
- No invented numbers or facts about them.
- No "Dear", no handle used as a form field. Talk like a human.
- No "we are a leading agency" corporate speak, no "game-changer/next-level".
- Output ONLY the DM text.`;

async function genDM(p) {
  const user = `Prospect: ${p.name} (@${p.handle}), ${p.area}. Niche: ${p.niche}. Note: ${p.note}.\nWrite the DM.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, temperature: 0.9, system: SYSTEM, messages: [{ role: "user", content: user }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(j.error || j));
  let t = j.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  t = t.replace(/\s*[—–]\s*/g, ", ").replace(/^["'“](.*)["'”]$/s, "$1").trim();
  return t;
}

async function main() {
  await loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
  const prospects = parseCSV(await fs.readFile(CSV, "utf8"));
  let md = `# ADletic x aios.agency — detailing studio outreach DMs\n\nSend MANUALLY from @aios.agency (IG API can't cold-DM). ~15/day, space them out, glance at their profile and tweak 1 line before sending. Log replies in tracker.csv.\n\n`;
  const track = ["handle,name,area,status,date_sent,replied,notes"];
  for (const p of prospects) {
    process.stdout.write(`@${p.handle} ... `);
    const dm = await genDM(p);
    md += `## @${p.handle} — ${p.name}\n_${p.area} · ${p.niche}_\n\n> ${dm.replace(/\n/g, "\n> ")}\n\n---\n\n`;
    track.push(`${p.handle},${p.name},${p.area},not_sent,,,`);
    console.log("ok");
  }
  await fs.writeFile(path.join(DIR, "detailing-dms.md"), md, "utf8");
  await fs.writeFile(path.join(DIR, "tracker.csv"), track.join("\n") + "\n", "utf8");
  console.log(`\nDone. ${prospects.length} DMs -> ${path.join(DIR, "detailing-dms.md")}`);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
