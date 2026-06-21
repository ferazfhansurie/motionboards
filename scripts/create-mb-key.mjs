// Mint a MotionBoards API key directly in the app's Neon DB and save it to
// .env.local (gitignored) as MB_API_KEY. Matches src/lib/db.ts createApiKey():
// token = mb_<32 hex>, store sha256(token) + a display prefix.
//   node scripts/create-mb-key.mjs [email]
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT, ".env.local");

async function loadEnv() {
  const raw = await fs.readFile(ENV_PATH, "utf8");
  const map = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) { map[m[1]] = m[2].replace(/^["']|["']$/g, ""); if (!(m[1] in process.env)) process.env[m[1]] = map[m[1]]; }
  }
  return map;
}

async function main() {
  const env = await loadEnv();
  const email = (process.argv[2] || "firaz@fathopesenergy.com").trim();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL missing in .env.local");
  const sql = neon(dbUrl);

  const users = await sql`SELECT id, name, email, credits, role FROM mb_users WHERE LOWER(email) = LOWER(${email})`;
  if (!users.length) throw new Error(`No user with email ${email}. Existing accounts must be created via the app first.`);
  const u = users[0];
  console.log(`User: ${u.name} <${u.email}>  role=${u.role}  credits=${u.credits} (RM${(u.credits / 100).toFixed(2)})`);

  const fullKey = `mb_${randomBytes(16).toString("hex")}`;
  const prefix = `${fullKey.slice(0, 9)}…`;
  const keyHash = createHash("sha256").update(fullKey).digest("hex");
  const id = `apikey_${Date.now()}_${randomBytes(4).toString("hex")}`;
  await sql`INSERT INTO mb_api_keys (id, user_id, name, prefix, key_hash)
            VALUES (${id}, ${u.id}, ${"poster-gen (claude)"}, ${prefix}, ${keyHash})`;

  // Persist to .env.local (gitignored) so it never enters the transcript.
  let raw = await fs.readFile(ENV_PATH, "utf8");
  if (/^\s*MB_API_KEY\s*=/m.test(raw)) raw = raw.replace(/^\s*MB_API_KEY\s*=.*$/m, `MB_API_KEY=${fullKey}`);
  else raw = raw.replace(/\s*$/, "") + `\nMB_API_KEY=${fullKey}\n`;
  await fs.writeFile(ENV_PATH, raw);

  console.log(`Created key ${prefix} (name "poster-gen (claude)") and saved MB_API_KEY to .env.local`);
}

main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
