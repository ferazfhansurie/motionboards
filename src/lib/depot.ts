import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

// Depot video bot: depot managers chat at /depot/<token>, a worker on Faeez's
// Mac edits the videos (captions/text, CapCut project + ffmpeg render), Faeez
// approves at /depot/admin?k=<key>, and the final MP4 lands in Google Drive.
// Tables are created by ~/aios/depot-video/migrate.mjs.

type Row = Record<string, unknown>;
const sql = (strings: TemplateStringsArray, ...values: unknown[]) =>
  neon(process.env.DATABASE_URL!)(strings, ...values) as Promise<Row[]>;
export { sql as depotSql };

export interface DepotSite { code: string; name: string; token: string; dailyLimit: number }

export async function siteByToken(token: string): Promise<DepotSite | null> {
  if (!/^[a-z]{3}-[0-9a-f]{10}$/.test(token)) return null;
  const r = await sql`SELECT * FROM depot_sites WHERE token = ${token}`;
  if (!r[0]) return null;
  return { code: r[0].code as string, name: r[0].name as string, token, dailyLimit: r[0].daily_limit as number };
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
async function keyOk(name: "admin_hash" | "worker_hash", key: string | null) {
  if (!key) return false;
  const r = await sql`SELECT value FROM depot_state WHERE key = ${name}`;
  return !!r[0] && r[0].value === sha(key);
}
export const adminOk = (k: string | null) => keyOk("admin_hash", k);
export const workerOk = (k: string | null) => keyOk("worker_hash", k);

export const newJobId = () => `dj_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;

// Messages belong to one manager's chat: pass userId, or a jobId and the job's owner is used.
export async function addMessage(depot: string, role: "user" | "bot", text: string, o: { jobId?: string | null; author?: string | null; mediaUrl?: string | null; userId?: number | null } = {}) {
  await sql`INSERT INTO depot_messages (depot, job_id, role, author, text, media_url, user_id)
    VALUES (${depot}, ${o.jobId ?? null}, ${role}, ${o.author ?? null}, ${text}, ${o.mediaUrl ?? null},
      COALESCE(${o.userId ?? null}::bigint, (SELECT user_id FROM depot_jobs WHERE id = ${o.jobId ?? null})))`;
}

// ---- manager accounts: register with name + phone + password on their depot link
export interface DepotUser { id: number; depot: string; name: string; phone: string }
const COOKIE = "depot_session";
const SESSION_DAYS = 90;

export function normPhone(p: string) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "6" + d;
  return /^60\d{8,10}$/.test(d) ? d : null;
}
export function hashPass(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}
export function checkPass(pw: string, stored: string) {
  const [salt, h] = stored.split(":");
  if (!salt || !h) return false;
  return timingSafeEqual(Buffer.from(h, "hex"), scryptSync(pw, salt, 32));
}
export async function startSession(res: NextResponse, userId: number) {
  const t = randomBytes(32).toString("base64url");
  await sql`INSERT INTO depot_sessions (token_hash, user_id, expires_at) VALUES (${sha(t)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  res.cookies.set(COOKIE, t, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
}
export async function endSession(req: NextRequest, res: NextResponse) {
  const t = req.cookies.get(COOKIE)?.value;
  if (t) await sql`DELETE FROM depot_sessions WHERE token_hash = ${sha(t)}`;
  res.cookies.delete(COOKIE);
}
export const SESSION_COOKIE = COOKIE;
// The signed-in manager from a raw cookie value, any depot (for the shared /depot link).
export async function sessionUser(t: string | undefined): Promise<(DepotUser & { token: string }) | null> {
  if (!t) return null;
  const r = await sql`SELECT u.id, u.depot, u.name, u.phone, d.token FROM depot_sessions s
    JOIN depot_users u ON u.id = s.user_id JOIN depot_sites d ON d.code = u.depot
    WHERE s.token_hash = ${sha(t)} AND s.expires_at > now() AND NOT u.disabled`;
  return r[0] ? { id: Number(r[0].id), depot: r[0].depot as string, name: r[0].name as string, phone: r[0].phone as string, token: r[0].token as string } : null;
}
export async function listSites() {
  const r = await sql`SELECT code, name FROM depot_sites ORDER BY name`;
  return r.map((x) => ({ code: x.code as string, name: x.name as string }));
}
// The signed-in manager, only if their account belongs to this depot.
export async function currentUser(req: NextRequest, depot: string): Promise<DepotUser | null> {
  const t = req.cookies.get(COOKIE)?.value;
  if (!t) return null;
  const r = await sql`UPDATE depot_users u SET last_seen = now() FROM depot_sessions s
    WHERE s.token_hash = ${sha(t)} AND s.expires_at > now() AND u.id = s.user_id AND NOT u.disabled AND u.depot = ${depot}
    RETURNING u.id, u.depot, u.name, u.phone`;
  return r[0] ? { id: Number(r[0].id), depot: r[0].depot as string, name: r[0].name as string, phone: r[0].phone as string } : null;
}

export async function workerSeen(): Promise<number> {
  const r = await sql`SELECT value FROM depot_state WHERE key = 'worker_seen'`;
  return r[0] ? Number(r[0].value) : 0;
}

export function publicJob(r: Row) {
  return {
    id: r.id as string, depot: r.depot as string, manager: r.manager as string | null, status: r.status as string,
    videoUrl: r.video_url as string | null, previewUrl: r.preview_url as string | null, driveUrl: r.drive_url as string | null,
    instructions: r.instructions as { text: string; at: string }[], capcutName: r.capcut_name as string | null,
    note: r.note as string | null, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
