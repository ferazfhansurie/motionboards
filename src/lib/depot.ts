import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "crypto";

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

export async function addMessage(depot: string, role: "user" | "bot", text: string, o: { jobId?: string | null; author?: string | null; mediaUrl?: string | null } = {}) {
  await sql`INSERT INTO depot_messages (depot, job_id, role, author, text, media_url)
    VALUES (${depot}, ${o.jobId ?? null}, ${role}, ${o.author ?? null}, ${text}, ${o.mediaUrl ?? null})`;
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
