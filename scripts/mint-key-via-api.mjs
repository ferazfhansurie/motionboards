// Mint a MotionBoards API key the proper way: log in over HTTP, then call the
// app's own /api/api-keys endpoint. No direct DB access. Saves the key to
// .env.local (gitignored) as MB_API_KEY so it never enters the transcript.
//   MB_EMAIL=you@x.com MB_PASSWORD=... node scripts/mint-key-via-api.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const BASE = (process.env.MB_BASE || "https://motionboards.vercel.app").replace(/\/$/, "");

async function main() {
  const email = process.env.MB_EMAIL;
  const password = process.env.MB_PASSWORD;
  if (!email || !password) throw new Error("Set MB_EMAIL and MB_PASSWORD.");

  // 1. Login -> session cookie
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await login.json().catch(() => ({}));
  if (!login.ok) throw new Error(`Login failed (HTTP ${login.status}): ${JSON.stringify(loginJson).slice(0, 200)}`);
  const setCookie = login.headers.get("set-cookie") || "";
  const m = setCookie.match(/session=([^;]+)/);
  if (!m) throw new Error("Login succeeded but no session cookie returned.");
  const cookie = `session=${m[1]}`;
  console.log(`Logged in as ${loginJson.user?.email} (role=${loginJson.user?.role}, credits=${loginJson.user?.credits}).`);

  // 2. Create API key
  const res = await fetch(`${BASE}/api/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: "poster-gen (claude)" }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.fullKey) throw new Error(`Key creation failed (HTTP ${res.status}): ${JSON.stringify(json).slice(0, 200)}`);

  // 3. Persist to .env.local (gitignored)
  let raw = await fs.readFile(ENV_PATH, "utf8");
  if (/^\s*MB_API_KEY\s*=/m.test(raw)) raw = raw.replace(/^\s*MB_API_KEY\s*=.*$/m, `MB_API_KEY=${json.fullKey}`);
  else raw = raw.replace(/\s*$/, "") + `\nMB_API_KEY=${json.fullKey}\n`;
  await fs.writeFile(ENV_PATH, raw);

  console.log(`Created key ${json.apiKey?.prefix} and saved MB_API_KEY to .env.local`);
}

main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
