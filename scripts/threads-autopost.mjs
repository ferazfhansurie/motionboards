#!/usr/bin/env node
// Fire the Threads auto-poster and print the result. This calls the same
// /api/threads-autopost endpoint the Vercel cron hits, so it tests the exact
// production path — no duplicated logic.
//
// Usage:
//   node scripts/threads-autopost.mjs --dry     # generate + preview, DON'T publish
//   node scripts/threads-autopost.mjs           # generate + PUBLISH for real
//
// Env (reads env.local automatically if present):
//   CRON_SECRET        required — must match the deployed/env value
//   THREADS_BASE_URL   optional — defaults to http://localhost:3000
//                      set to your prod URL to trigger the live site
//
// Local run needs the dev server up first:  npm run dev

import { readFileSync } from "node:fs";

// Minimal env.local loader (no dotenv dep). Only sets keys not already in env.
try {
  const raw = readFileSync(new URL("../env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* no env.local — rely on real env */
}

const dry = process.argv.includes("--dry");
const base = process.env.THREADS_BASE_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET not set (env.local or shell). Aborting.");
  process.exit(1);
}

const url = `${base}/api/threads-autopost?secret=${encodeURIComponent(secret)}${dry ? "&dry=1" : ""}`;
console.log(`${dry ? "DRY RUN" : "PUBLISHING"} → ${base}/api/threads-autopost`);

try {
  const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    console.error("Failed:", json.error || res.status);
    process.exit(1);
  }
  const tag = json.topicTag ? ` tag=${json.topicTag}` : "";
  const stage = `phase=${json.phase} day=${json.day} mood=${json.mood}${tag}`;
  if (json.dry) {
    console.log(`\nWould post (${json.model}, ${stage}, saw ${json.sawRecent} recent):\n\n${json.wouldPost}\n`);
  } else {
    console.log(`\nPosted (${json.model}, ${stage}):\n\n${json.posted}\n`);
    if (json.permalink) console.log(`→ ${json.permalink}`);
  }
} catch (e) {
  console.error("Request error:", e.message);
  console.error("Is the dev server running? (npm run dev)");
  process.exit(1);
}
