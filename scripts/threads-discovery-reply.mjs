#!/usr/bin/env node
// Run the same outbound-discovery route used by the daily Vercel cron.
// It never replies to inbound messages. Use --dry first; omit it only when
// THREADS_DISCOVERY_ENABLED=true and you intentionally want today's one reply.
//
// Usage:
//   npm run dev
//   node scripts/threads-discovery-reply.mjs --dry
//   node scripts/threads-discovery-reply.mjs

import { readFileSync } from "node:fs";

try {
  const raw = readFileSync(new URL("../env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // No local file: use the shell environment instead.
}

const dry = process.argv.includes("--dry");
const base = process.env.THREADS_BASE_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET not set (env.local or shell). Aborting.");
  process.exit(1);
}

const url = `${base}/api/threads-discovery-reply?secret=${encodeURIComponent(secret)}${dry ? "&dry=1" : ""}`;
console.log(`${dry ? "DRY RUN" : "PUBLISHING"} → ${base}/api/threads-discovery-reply`);

try {
  const response = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    console.error("Failed:", result.error || response.status);
    process.exit(1);
  }
  if (result.skipped) {
    console.log(`Skipped: ${result.skipped}`);
    process.exit(0);
  }
  const candidate = result.candidate;
  const draft = result.draft;
  console.log(`\nTarget: @${candidate?.username || "unknown"}`);
  if (candidate?.text) console.log(`Post: ${candidate.text}`);
  if (draft?.reply) console.log(`\nReply: ${draft.reply}`);
  if (draft?.why) console.log(`Why: ${draft.why}`);
  if (!dry && result.published?.permalink) console.log(`\nPublished: ${result.published.permalink}`);
} catch (error) {
  console.error("Request error:", error instanceof Error ? error.message : error);
  console.error("Is the dev server running? (npm run dev)");
  process.exit(1);
}
