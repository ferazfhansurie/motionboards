import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

type SqlRow = Record<string, unknown>;
type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<SqlRow[]>;

const sql: SqlFn = (strings, ...values) => {
  const fn = neon(process.env.DATABASE_URL!);
  return fn(strings, ...values) as Promise<SqlRow[]>;
};

// --- Settings (still JSON — admin-only, no need for DB) ---

const DATA_DIR = join(process.cwd(), "data");
const SETTINGS_FILE = join(DATA_DIR, "settings.json");

export interface Settings {
  replicateApiKey: string;
  segmindApiKey: string;
  geminiApiKey: string;
  fishApiKey: string;
}

export function getSettings(): Settings {
  let settings: Settings = { replicateApiKey: "", segmindApiKey: "", geminiApiKey: "", fishApiKey: "" };
  if (existsSync(SETTINGS_FILE)) {
    try {
      settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
    } catch {}
  }
  // Fall back to environment variables (works on Vercel)
  if (!settings.replicateApiKey) settings.replicateApiKey = process.env.REPLICATE_API_TOKEN || "";
  if (!settings.segmindApiKey) settings.segmindApiKey = process.env.SEGMIND_API_KEY || "";
  if (!settings.geminiApiKey) settings.geminiApiKey = process.env.GEMINI_API_KEY || "";
  if (!settings.fishApiKey) settings.fishApiKey = process.env.FISH_API_KEY || "";
  return settings;
}

// --- Users ---

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  credits: number;
  role: "user" | "admin";
  createdAt: string;
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    credits: row.credits as number,
    role: row.role as "user" | "admin",
    createdAt: (row.created_at as Date).toISOString(),
  };
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function createUser(name: string, email: string, password: string): Promise<User | null> {
  const existing = await sql`SELECT id FROM mb_users WHERE LOWER(email) = LOWER(${email})`;
  if (existing.length > 0) return null;

  const id = `user_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const hash = hashPassword(password);
  const rows = await sql`
    INSERT INTO mb_users (id, name, email, password_hash, credits, role)
    VALUES (${id}, ${name}, ${email.toLowerCase()}, ${hash}, 0, 'user')
    RETURNING *
  `;
  return rowToUser(rows[0]);
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM mb_users WHERE LOWER(email) = LOWER(${email})`;
  if (rows.length === 0) return null;
  const user = rowToUser(rows[0]);
  if (user.passwordHash !== hashPassword(password)) return null;
  return user;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const rows = await sql`SELECT * FROM mb_users WHERE id = ${id}`;
  return rows.length > 0 ? rowToUser(rows[0]) : undefined;
}

export async function addCredits(userId: string, amount: number): Promise<User | undefined> {
  const rows = await sql`
    UPDATE mb_users SET credits = credits + ${amount} WHERE id = ${userId} RETURNING *
  `;
  return rows.length > 0 ? rowToUser(rows[0]) : undefined;
}

export async function deductCredits(userId: string, amount: number): Promise<boolean> {
  const rows = await sql`
    UPDATE mb_users SET credits = credits - ${amount}
    WHERE id = ${userId} AND credits >= ${amount}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getUserCredits(userId: string): Promise<number> {
  const rows = await sql`SELECT credits FROM mb_users WHERE id = ${userId}`;
  return rows.length > 0 ? (rows[0].credits as number) : 0;
}

// --- Sessions ---

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export async function createSession(userId: string): Promise<Session> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await sql`
    INSERT INTO mb_sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()})
  `;
  return {
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getSessionByToken(token: string): Promise<Session | undefined> {
  const rows = await sql`
    SELECT * FROM mb_sessions WHERE token = ${token} AND expires_at > NOW()
  `;
  if (rows.length === 0) return undefined;
  const r = rows[0];
  return {
    token: r.token as string,
    userId: r.user_id as string,
    createdAt: (r.created_at as Date).toISOString(),
    expiresAt: (r.expires_at as Date).toISOString(),
  };
}

export async function deleteSession(token: string): Promise<void> {
  await sql`DELETE FROM mb_sessions WHERE token = ${token}`;
}

export async function getUserFromToken(token: string): Promise<User | undefined> {
  const session = await getSessionByToken(token);
  if (!session) return undefined;
  return getUserById(session.userId);
}

// --- Generations ---

export interface Generation {
  id: string;
  userId?: string | null;
  prompt: string;
  model: string;
  provider: string;
  mode: string;
  status: string;
  inputImage?: string | null;
  outputUrl?: string | null;
  thumbnail?: string | null;
  duration?: number | null;
  template?: string | null;
  params?: string | null;
  error?: string | null;
  creditCost?: number;
  createdAt: string;
  updatedAt: string;
}

function rowToGeneration(row: Record<string, unknown>): Generation {
  return {
    id: row.id as string,
    userId: row.user_id as string | null,
    prompt: row.prompt as string,
    model: row.model as string,
    provider: row.provider as string,
    mode: row.mode as string,
    status: row.status as string,
    inputImage: row.input_image as string | null,
    outputUrl: row.output_url as string | null,
    thumbnail: row.thumbnail as string | null,
    duration: row.duration as number | null,
    template: row.template as string | null,
    params: row.params as string | null,
    error: row.error as string | null,
    creditCost: row.credit_cost as number,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function createGeneration(
  data: Omit<Generation, "id" | "createdAt" | "updatedAt"> & { userId?: string }
): Promise<Generation> {
  const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const rows = await sql`
    INSERT INTO mb_generations (id, user_id, prompt, model, provider, mode, status, input_image, credit_cost)
    VALUES (${id}, ${data.userId || null}, ${data.prompt}, ${data.model}, ${data.provider}, ${data.mode}, ${data.status}, ${data.inputImage || null}, ${data.creditCost || 0})
    RETURNING *
  `;
  return rowToGeneration(rows[0]);
}

export async function updateGeneration(
  id: string,
  data: Partial<Generation>
): Promise<Generation | undefined> {
  const rows = await sql`
    UPDATE mb_generations SET
      status = COALESCE(${data.status ?? null}, status),
      output_url = COALESCE(${data.outputUrl ?? null}, output_url),
      error = ${data.error ?? null},
      duration = COALESCE(${data.duration ?? null}, duration),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows.length > 0 ? rowToGeneration(rows[0]) : undefined;
}

export async function getAllGenerations(userId?: string, limit = 50): Promise<Generation[]> {
  const rows = userId
    ? await sql`SELECT * FROM mb_generations WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`
    : await sql`SELECT * FROM mb_generations ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(rowToGeneration);
}

export async function getGeneration(id: string): Promise<Generation | undefined> {
  const rows = await sql`SELECT * FROM mb_generations WHERE id = ${id}`;
  return rows.length > 0 ? rowToGeneration(rows[0]) : undefined;
}

export async function deleteGeneration(id: string): Promise<boolean> {
  const rows = await sql`DELETE FROM mb_generations WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// --- File storage (Neon bytea) ---
//
// User uploads and AI-generated outputs are stored as bytea rows in mb_files,
// then served back via GET /api/files/:id. This replaced fal.ai storage so the
// app has no external storage dependency — everything lives in Neon.
//
// Files are NOT permanent: rows older than FILE_TTL_DAYS are swept on a
// throttled background pass triggered by every putFile call. This keeps Neon
// storage costs bounded since bytea in Postgres has no native expiry.

export const FILE_TTL_DAYS = 14;
const CLEANUP_THROTTLE_MS = 60 * 60 * 1000; // run sweep at most once per hour per server instance
let lastCleanupAt = 0;

let filesTableInitialized = false;

async function ensureFilesTable(): Promise<void> {
  if (filesTableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_files (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // Index for fast TTL sweeps
  await sql`CREATE INDEX IF NOT EXISTS mb_files_created_at_idx ON mb_files (created_at)`;
  filesTableInitialized = true;
}

export interface StoredFile {
  id: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
}

// Delete files older than FILE_TTL_DAYS. Throttled to once per hour to avoid
// running on every upload. Fire-and-forget; failures are swallowed.
async function sweepExpiredFiles(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_THROTTLE_MS) return;
  lastCleanupAt = now;
  try {
    await sql`
      DELETE FROM mb_files
      WHERE created_at < NOW() - (${FILE_TTL_DAYS}::int * INTERVAL '1 day')
    `;
  } catch (err) {
    console.error("File TTL sweep failed:", err);
  }
}

export async function putFile(
  data: Buffer,
  mimeType: string,
  userId?: string | null
): Promise<{ id: string }> {
  await ensureFilesTable();
  const id = `file_${Date.now()}_${randomBytes(6).toString("hex")}`;
  // Neon's tagged-template driver passes Buffer through as bytea
  await sql`
    INSERT INTO mb_files (id, user_id, mime_type, size_bytes, data)
    VALUES (${id}, ${userId || null}, ${mimeType}, ${data.length}, ${data})
  `;
  // Background sweep — don't await, don't block the upload response
  sweepExpiredFiles().catch(() => {});
  return { id };
}

export async function getFile(id: string): Promise<StoredFile | null> {
  await ensureFilesTable();
  const rows = await sql`
    SELECT id, mime_type, size_bytes, data FROM mb_files WHERE id = ${id}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  // Neon returns bytea as a Node Buffer (or Uint8Array). Normalize to Buffer.
  const raw = r.data as Buffer | Uint8Array;
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  return {
    id: r.id as string,
    mimeType: r.mime_type as string,
    sizeBytes: r.size_bytes as number,
    data: buf,
  };
}

export async function deleteFile(id: string): Promise<boolean> {
  await ensureFilesTable();
  const rows = await sql`DELETE FROM mb_files WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
