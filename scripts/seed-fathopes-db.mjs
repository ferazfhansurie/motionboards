// One-time (idempotent) seed: copy the generated manifest into the
// mb_fathopes_media table so the live, DB-backed gallery starts populated.
//
//   node scripts/seed-fathopes-db.mjs
//
// Safe to re-run — existing rows (matched by src) are left untouched.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "uncategorised";
}

async function main() {
  await loadEnv();
  if (!process.env.DATABASE_URL) { console.error("DATABASE_URL missing"); process.exit(1); }

  const text = await fs.readFile(path.join(ROOT, "src", "lib", "fathopes-media.ts"), "utf8");
  const part = text.split("FATHOPES_MEDIA: FathopesMediaItem[] = ")[1];
  const json = part.slice(0, part.lastIndexOf("]") + 1);
  const items = JSON.parse(json);

  const sql = neon(process.env.DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS mb_fathopes_media (
      id TEXT PRIMARY KEY,
      src TEXT NOT NULL,
      thumb TEXT NOT NULL,
      ratio REAL NOT NULL DEFAULT 1,
      category TEXT NOT NULL DEFAULT 'Uncategorised',
      cat_slug TEXT NOT NULL DEFAULT 'uncategorised',
      type TEXT NOT NULL DEFAULT 'image',
      name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mb_fathopes_src_idx ON mb_fathopes_media (src)`;
  await sql`CREATE INDEX IF NOT EXISTS mb_fathopes_cat_idx ON mb_fathopes_media (cat_slug)`;

  let inserted = 0, i = 0;
  for (const it of items) {
    const id = `fh_seed_${i++}`;
    const cat = it.category || "Uncategorised";
    const res = await sql`
      INSERT INTO mb_fathopes_media (id, src, thumb, ratio, category, cat_slug, type, name)
      VALUES (${id}, ${it.src}, ${it.thumb}, ${it.ratio || 1}, ${cat}, ${it.catSlug || slug(cat)}, ${it.type}, ${it.name || ""})
      ON CONFLICT (src) DO NOTHING
      RETURNING id`;
    if (res.length) inserted++;
  }
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM mb_fathopes_media`;
  console.log(`Seed done. inserted=${inserted}, total rows=${count}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
