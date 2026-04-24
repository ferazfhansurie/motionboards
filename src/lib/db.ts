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
  openaiApiKey: string;
  replicateApiKey: string;
  segmindApiKey: string;
  geminiApiKey: string;
  fishApiKey: string;
  // ByteDance ModelArk (ARK) — direct-API Seedance 2.0 access. Token lives in
  // ARK_API_KEY on Vercel; no settings.json fallback needed for this one but
  // we keep the shape consistent with the others.
  arkApiKey: string;
}

export function getSettings(): Settings {
  let settings: Settings = { openaiApiKey: "", replicateApiKey: "", segmindApiKey: "", geminiApiKey: "", fishApiKey: "", arkApiKey: "" };
  if (existsSync(SETTINGS_FILE)) {
    try {
      settings = { ...settings, ...JSON.parse(readFileSync(SETTINGS_FILE, "utf-8")) };
    } catch {}
  }
  // Fall back to environment variables (works on Vercel)
  if (!settings.openaiApiKey) settings.openaiApiKey = process.env.OPENAI_API_KEY || "";
  if (!settings.replicateApiKey) settings.replicateApiKey = process.env.REPLICATE_API_TOKEN || "";
  if (!settings.segmindApiKey) settings.segmindApiKey = process.env.SEGMIND_API_KEY || "";
  if (!settings.geminiApiKey) settings.geminiApiKey = process.env.GEMINI_API_KEY || "";
  if (!settings.fishApiKey) settings.fishApiKey = process.env.FISH_API_KEY || "";
  if (!settings.arkApiKey) settings.arkApiKey = process.env.ARK_API_KEY || "";
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

// Change a user's password. Requires the current password for verification,
// so a stolen session cookie alone can't lock the user out.
export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters" };
  }
  const rows = await sql`SELECT password_hash FROM mb_users WHERE id = ${userId}`;
  if (rows.length === 0) return { ok: false, error: "User not found" };
  if ((rows[0].password_hash as string) !== hashPassword(currentPassword)) {
    return { ok: false, error: "Current password is incorrect" };
  }
  const newHash = hashPassword(newPassword);
  await sql`UPDATE mb_users SET password_hash = ${newHash} WHERE id = ${userId}`;
  return { ok: true };
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

// Operator email with access to the admin surfaces (logs, registered users).
// Kept alongside the `role === "admin"` DB flag — either grants access, so
// the owner email works out-of-the-box without a DB update.
export const ADMIN_EMAIL = "hello@adleticagency.com";

export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === "admin" || user.email.toLowerCase() === ADMIN_EMAIL;
}

export async function listUsers(limit = 500): Promise<User[]> {
  const rows = await sql`SELECT * FROM mb_users ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(rowToUser);
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

// --- Monthly subscription (RM100/mo → 10000 credits added per billing cycle) ---
//
// The columns are added lazily the first time the feature runs. Credits stay
// in the user's balance whether the subscription is active or not — cancellation
// just stops new top-ups from being applied, it doesn't wipe what's already
// sitting in the account.
export const MONTHLY_SUBSCRIPTION_CREDITS = 10000; // RM100 in sen / 100 credits per RM
export const MONTHLY_SUBSCRIPTION_PRICE_SEN = 10000; // RM100
const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

let subscriptionColumnsEnsured = false;
async function ensureSubscriptionColumns() {
  if (subscriptionColumnsEnsured) return;
  await sql`ALTER TABLE mb_users ADD COLUMN IF NOT EXISTS subscription_id TEXT`;
  await sql`ALTER TABLE mb_users ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE mb_users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mb_users_subscription_id ON mb_users(subscription_id)`;
  subscriptionColumnsEnsured = true;
}

export interface SubscriptionStatus {
  active: boolean;
  expiresAt: string | null;
  subscriptionId: string | null;
}

export async function getSubscription(userId: string): Promise<SubscriptionStatus> {
  await ensureSubscriptionColumns();
  const rows = await sql`
    SELECT subscription_id, subscription_active, subscription_expires_at
    FROM mb_users WHERE id = ${userId}
  `;
  if (rows.length === 0) return { active: false, expiresAt: null, subscriptionId: null };
  const row = rows[0];
  const expiresAt = row.subscription_expires_at ? (row.subscription_expires_at as Date).toISOString() : null;
  // A user counts as active only if they haven't rolled past the billing cycle.
  const active = !!row.subscription_active && !!expiresAt && new Date(expiresAt).getTime() > Date.now();
  return {
    active,
    expiresAt,
    subscriptionId: (row.subscription_id as string) || null,
  };
}

// Called on the initial Stripe checkout.session.completed (mode=subscription).
// Stores the Stripe subscription id, activates the flag, pushes expiry +30d,
// and credits the first month's 10,000.
export async function activateSubscription(userId: string, stripeSubscriptionId: string): Promise<void> {
  await ensureSubscriptionColumns();
  const expiresAt = new Date(Date.now() + DAYS_30_MS).toISOString();
  await sql`
    UPDATE mb_users SET
      subscription_id = ${stripeSubscriptionId},
      subscription_active = true,
      subscription_expires_at = ${expiresAt},
      credits = credits + ${MONTHLY_SUBSCRIPTION_CREDITS}
    WHERE id = ${userId}
  `;
}

// Called on each invoice.payment_succeeded for a recognized subscription id.
// Tops up another month of credits and extends the expiry window forward.
export async function renewSubscriptionBySubscriptionId(stripeSubscriptionId: string): Promise<boolean> {
  await ensureSubscriptionColumns();
  const rows = await sql`SELECT id FROM mb_users WHERE subscription_id = ${stripeSubscriptionId}`;
  if (rows.length === 0) return false;
  const userId = rows[0].id as string;
  const expiresAt = new Date(Date.now() + DAYS_30_MS).toISOString();
  await sql`
    UPDATE mb_users SET
      subscription_active = true,
      subscription_expires_at = ${expiresAt},
      credits = credits + ${MONTHLY_SUBSCRIPTION_CREDITS}
    WHERE id = ${userId}
  `;
  return true;
}

// Stripe fires customer.subscription.deleted when a subscription is cancelled
// or runs out of payment retries. Flip the flag — credits already in the
// balance stay put.
export async function deactivateSubscriptionBySubscriptionId(stripeSubscriptionId: string): Promise<boolean> {
  await ensureSubscriptionColumns();
  const rows = await sql`
    UPDATE mb_users SET subscription_active = false
    WHERE subscription_id = ${stripeSubscriptionId}
    RETURNING id
  `;
  return rows.length > 0;
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

// Mark a generation as completed or failed and record its real wall-clock
// duration (in seconds, derived from created_at by the database so clock
// drift between the request and the response doesn't skew the number).
// All providers (sync and async) should use this instead of updateGeneration
// on the terminal hop so the stats endpoint has accurate numbers to average.
export async function finalizeGeneration(
  id: string,
  patch: { status: "completed" | "failed"; outputUrl?: string | null; error?: string | null },
): Promise<Generation | undefined> {
  const rows = await sql`
    UPDATE mb_generations SET
      status = ${patch.status},
      output_url = COALESCE(${patch.outputUrl ?? null}, output_url),
      error = ${patch.error ?? null},
      duration = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - created_at))::int),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows.length > 0 ? rowToGeneration(rows[0]) : undefined;
}

// Per-model average wall-clock time for successful generations. Used by the
// client to replace the hardcoded `speed: "~4m"` with a live estimate.
// Only includes runs that completed and have a real duration recorded — the
// historical backlog of `duration = 0` rows gets filtered out.
export async function getModelDurationStats(): Promise<Array<{ model: string; avgSeconds: number; count: number }>> {
  const rows = await sql`
    SELECT model,
           AVG(duration)::int  AS avg_seconds,
           COUNT(*)::int        AS count
    FROM mb_generations
    WHERE status = 'completed' AND duration IS NOT NULL AND duration > 0
    GROUP BY model
  `;
  return rows.map((r) => ({
    model: r.model as string,
    avgSeconds: Number(r.avg_seconds) || 0,
    count: Number(r.count) || 0,
  }));
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

// Metadata row for the user-facing media library. Excludes the `data` blob
// (we only need it when streaming the file through /api/files/:id).
export interface UserFileMeta {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

// Page a user's files by creation time. `before` is a cursor — pass the
// createdAt of the oldest row from the previous page to keep paging stable
// even when new uploads arrive at the top. `from` / `to` clamp to a date
// window (inclusive).
export async function listUserFiles(
  userId: string,
  opts: { limit?: number; before?: string | null; from?: string | null; to?: string | null } = {}
): Promise<{ files: UserFileMeta[]; nextCursor: string | null }> {
  await ensureFilesTable();
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  const before = opts.before ?? null;
  const from = opts.from ?? null;
  const to = opts.to ?? null;

  // Neon's tagged-template driver doesn't love conditional WHERE clauses so
  // we switch per branch — keeps the query simple and predicate indexable.
  const rows =
    before && from && to
      ? await sql`
          SELECT id, mime_type, size_bytes, created_at FROM mb_files
          WHERE user_id = ${userId}
            AND created_at < ${before}
            AND created_at >= ${from}
            AND created_at <= ${to}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : before && from
      ? await sql`
          SELECT id, mime_type, size_bytes, created_at FROM mb_files
          WHERE user_id = ${userId}
            AND created_at < ${before}
            AND created_at >= ${from}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : before && to
      ? await sql`
          SELECT id, mime_type, size_bytes, created_at FROM mb_files
          WHERE user_id = ${userId}
            AND created_at < ${before}
            AND created_at <= ${to}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : before
      ? await sql`
          SELECT id, mime_type, size_bytes, created_at FROM mb_files
          WHERE user_id = ${userId}
            AND created_at < ${before}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : from && to
      ? await sql`
          SELECT id, mime_type, size_bytes, created_at FROM mb_files
          WHERE user_id = ${userId}
            AND created_at >= ${from}
            AND created_at <= ${to}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : from
      ? await sql`
          SELECT id, mime_type, size_bytes, created_at FROM mb_files
          WHERE user_id = ${userId}
            AND created_at >= ${from}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : to
      ? await sql`
          SELECT id, mime_type, size_bytes, created_at FROM mb_files
          WHERE user_id = ${userId}
            AND created_at <= ${to}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, mime_type, size_bytes, created_at FROM mb_files
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

  const files: UserFileMeta[] = rows.map((r) => ({
    id: r.id as string,
    mimeType: r.mime_type as string,
    sizeBytes: r.size_bytes as number,
    createdAt: (r.created_at as Date).toISOString(),
  }));
  const nextCursor = files.length === limit ? files[files.length - 1].createdAt : null;
  return { files, nextCursor };
}

// Let a user delete one of their own files from the library.
export async function deleteUserFile(id: string, userId: string): Promise<boolean> {
  await ensureFilesTable();
  const rows = await sql`
    DELETE FROM mb_files WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  return rows.length > 0;
}

// --- AI Prompt Generator chats ---
//
// Conversation history for the AI Prompt Generator side panel. Each chat is a
// full message transcript stored as JSONB so the backend (GPT-4o-mini) can
// rebuild context on every reply. Chats share the same 14-day TTL as files.

// Content is either a plain string (most assistant turns and simple user turns)
// or an array of parts with text and/or images (when the user attaches media).
export type ChatMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: "user" | "assistant";
  content: ChatMessageContent;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

let chatsTableInitialized = false;
let lastChatSweepAt = 0;

async function ensureChatsTable(): Promise<void> {
  if (chatsTableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'New Chat',
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mb_chats_user_updated_idx ON mb_chats (user_id, updated_at DESC)`;
  chatsTableInitialized = true;
}

async function sweepExpiredChats(): Promise<void> {
  const now = Date.now();
  if (now - lastChatSweepAt < CLEANUP_THROTTLE_MS) return;
  lastChatSweepAt = now;
  try {
    await sql`
      DELETE FROM mb_chats
      WHERE updated_at < NOW() - (${FILE_TTL_DAYS}::int * INTERVAL '1 day')
    `;
  } catch (err) {
    console.error("Chat TTL sweep failed:", err);
  }
}

function rowToChat(row: Record<string, unknown>): Chat {
  const rawMessages = row.messages as ChatMessage[] | string;
  const messages = typeof rawMessages === "string" ? JSON.parse(rawMessages) : rawMessages;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    messages: (messages as ChatMessage[]) || [],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function listChats(userId: string): Promise<Chat[]> {
  await ensureChatsTable();
  const rows = await sql`
    SELECT * FROM mb_chats WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 50
  `;
  return rows.map(rowToChat);
}

export async function createChat(userId: string, title: string = "New Chat"): Promise<Chat> {
  await ensureChatsTable();
  const id = `chat_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const rows = await sql`
    INSERT INTO mb_chats (id, user_id, title, messages)
    VALUES (${id}, ${userId}, ${title}, '[]'::jsonb)
    RETURNING *
  `;
  sweepExpiredChats().catch(() => {});
  return rowToChat(rows[0]);
}

export async function getChat(id: string, userId: string): Promise<Chat | null> {
  await ensureChatsTable();
  const rows = await sql`
    SELECT * FROM mb_chats WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows.length > 0 ? rowToChat(rows[0]) : null;
}

export async function updateChat(
  id: string,
  userId: string,
  updates: { title?: string; messages?: ChatMessage[] }
): Promise<Chat | null> {
  await ensureChatsTable();
  const rows = await sql`
    UPDATE mb_chats SET
      title = COALESCE(${updates.title ?? null}, title),
      messages = COALESCE(${updates.messages ? JSON.stringify(updates.messages) : null}::jsonb, messages),
      updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `;
  return rows.length > 0 ? rowToChat(rows[0]) : null;
}

export async function deleteChat(id: string, userId: string): Promise<boolean> {
  await ensureChatsTable();
  const rows = await sql`
    DELETE FROM mb_chats WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  return rows.length > 0;
}

// --- AI Prompt Helper per-user custom instruction ---
//
// Each user can store their own system-prompt tweak / template. This is
// prepended to the base instructions on every AI request so the assistant
// tailors its output (e.g. "keep prompts short and compact, no bold headers").

let aiInstructionColumnInitialized = false;

async function ensureAIInstructionColumn(): Promise<void> {
  if (aiInstructionColumnInitialized) return;
  // Lazy migration — safe to run repeatedly
  await sql`ALTER TABLE mb_users ADD COLUMN IF NOT EXISTS ai_instruction TEXT`;
  aiInstructionColumnInitialized = true;
}

export async function getUserAIInstruction(userId: string): Promise<string> {
  await ensureAIInstructionColumn();
  const rows = await sql`SELECT ai_instruction FROM mb_users WHERE id = ${userId}`;
  if (rows.length === 0) return "";
  return (rows[0].ai_instruction as string | null) || "";
}

export async function setUserAIInstruction(userId: string, instruction: string): Promise<void> {
  await ensureAIInstructionColumn();
  await sql`UPDATE mb_users SET ai_instruction = ${instruction} WHERE id = ${userId}`;
}

// --- Board version history ---
//
// Periodic snapshots of the user's full board state so they can recover from
// accidental cache clears, browser crashes, or silent DB save failures. Each
// snapshot is stored as JSONB in mb_board_versions with the same 14-day TTL
// sweep as files. Snapshots are also deduplicated by a short summary of the
// data so we don't flood storage when nothing changed.

export interface BoardVersion {
  id: string;
  userId: string;
  label: string;          // human-readable — "Auto 3:42 PM", "Manual checkpoint", etc
  itemCount: number;      // quick preview count without loading the full snapshot
  boardCount: number;
  data: unknown;          // full { boards, activeBoardId, selectedModelId }
  createdAt: string;
}

let boardVersionsTableInitialized = false;
let lastBoardVersionSweepAt = 0;

async function ensureBoardVersionsTable(): Promise<void> {
  if (boardVersionsTableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_board_versions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      item_count INTEGER NOT NULL DEFAULT 0,
      board_count INTEGER NOT NULL DEFAULT 0,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mb_board_versions_user_created_idx ON mb_board_versions (user_id, created_at DESC)`;
  boardVersionsTableInitialized = true;
}

async function sweepExpiredBoardVersions(): Promise<void> {
  const now = Date.now();
  if (now - lastBoardVersionSweepAt < CLEANUP_THROTTLE_MS) return;
  lastBoardVersionSweepAt = now;
  try {
    await sql`
      DELETE FROM mb_board_versions
      WHERE created_at < NOW() - (${FILE_TTL_DAYS}::int * INTERVAL '1 day')
    `;
  } catch (err) {
    console.error("Board version TTL sweep failed:", err);
  }
}

function rowToBoardVersion(row: Record<string, unknown>, includeData: boolean): BoardVersion {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    label: (row.label as string) || "",
    itemCount: (row.item_count as number) || 0,
    boardCount: (row.board_count as number) || 0,
    data: includeData ? row.data : null,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

// Keep at most this many snapshots per user; oldest beyond this are pruned
// right after each insert so storage stays bounded even for heavy editors.
// Combined with the 14-day TTL sweep, a user never holds more than ~50 × the
// size of one snapshot.
const MAX_BOARD_VERSIONS_PER_USER = 50;

export async function createBoardVersion(
  userId: string,
  data: unknown,
  label: string,
  itemCount: number,
  boardCount: number
): Promise<BoardVersion> {
  await ensureBoardVersionsTable();
  const id = `bv_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const rows = await sql`
    INSERT INTO mb_board_versions (id, user_id, label, item_count, board_count, data)
    VALUES (${id}, ${userId}, ${label}, ${itemCount}, ${boardCount}, ${JSON.stringify(data)}::jsonb)
    RETURNING *
  `;

  // Trim oldest snapshots beyond the cap (by created_at DESC, then delete tail)
  try {
    await sql`
      DELETE FROM mb_board_versions
      WHERE id IN (
        SELECT id FROM mb_board_versions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        OFFSET ${MAX_BOARD_VERSIONS_PER_USER}
      )
    `;
  } catch (err) {
    console.error("Board version cap trim failed:", err);
  }

  sweepExpiredBoardVersions().catch(() => {});
  return rowToBoardVersion(rows[0], true);
}

export async function listBoardVersions(userId: string): Promise<BoardVersion[]> {
  await ensureBoardVersionsTable();
  // Exclude the heavy `data` column from the list view — versions can be 1–3MB each
  const rows = await sql`
    SELECT id, user_id, label, item_count, board_count, created_at
    FROM mb_board_versions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows.map((r) => rowToBoardVersion(r, false));
}

export async function getBoardVersion(id: string, userId: string): Promise<BoardVersion | null> {
  await ensureBoardVersionsTable();
  const rows = await sql`
    SELECT * FROM mb_board_versions WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows.length > 0 ? rowToBoardVersion(rows[0], true) : null;
}

export async function deleteBoardVersion(id: string, userId: string): Promise<boolean> {
  await ensureBoardVersionsTable();
  const rows = await sql`
    DELETE FROM mb_board_versions WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  return rows.length > 0;
}

// --- Background board exports ---
//
// Each row represents a user-initiated export job. The job starts as `pending`,
// flips to `processing` while the server fetches media + builds the JSON, and
// ends as `completed` (with file_id pointing at the stored export) or `failed`.
// Closing the tab doesn't cancel the job — Next.js's after() keeps the work
// running past the response. Jobs auto-expire after 14 days.

export type BoardExportStatus = "pending" | "processing" | "completed" | "failed";

export interface BoardExportJob {
  id: string;
  userId: string;
  boardName: string;
  status: BoardExportStatus;
  progress: number;       // items processed
  total: number;          // total items to process
  fileId: string | null;  // mb_files.id when completed
  fileName: string | null;// filename for download
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

let boardExportsTableInitialized = false;
let lastBoardExportSweepAt = 0;

async function ensureBoardExportsTable(): Promise<void> {
  if (boardExportsTableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_board_exports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      board_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      file_id TEXT,
      file_name TEXT,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mb_board_exports_user_created_idx ON mb_board_exports (user_id, created_at DESC)`;
  boardExportsTableInitialized = true;
}

async function sweepExpiredBoardExports(): Promise<void> {
  const now = Date.now();
  if (now - lastBoardExportSweepAt < CLEANUP_THROTTLE_MS) return;
  lastBoardExportSweepAt = now;
  try {
    await sql`
      DELETE FROM mb_board_exports
      WHERE created_at < NOW() - (${FILE_TTL_DAYS}::int * INTERVAL '1 day')
    `;
  } catch (err) {
    console.error("Board export TTL sweep failed:", err);
  }
}

function rowToBoardExportJob(row: Record<string, unknown>): BoardExportJob {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    boardName: (row.board_name as string) || "",
    status: (row.status as BoardExportStatus) || "pending",
    progress: (row.progress as number) || 0,
    total: (row.total as number) || 0,
    fileId: (row.file_id as string | null) || null,
    fileName: (row.file_name as string | null) || null,
    error: (row.error as string | null) || null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function createBoardExportJob(userId: string, boardName: string, total: number): Promise<BoardExportJob> {
  await ensureBoardExportsTable();
  const id = `be_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const rows = await sql`
    INSERT INTO mb_board_exports (id, user_id, board_name, status, progress, total)
    VALUES (${id}, ${userId}, ${boardName}, 'pending', 0, ${total})
    RETURNING *
  `;
  sweepExpiredBoardExports().catch(() => {});
  return rowToBoardExportJob(rows[0]);
}

export async function updateBoardExportJob(
  id: string,
  updates: Partial<{
    status: BoardExportStatus;
    progress: number;
    total: number;
    fileId: string | null;
    fileName: string | null;
    error: string | null;
  }>
): Promise<void> {
  await ensureBoardExportsTable();
  // Use NULL fallback trick so we can leave fields alone when not provided
  await sql`
    UPDATE mb_board_exports SET
      status = COALESCE(${updates.status ?? null}, status),
      progress = COALESCE(${updates.progress ?? null}, progress),
      total = COALESCE(${updates.total ?? null}, total),
      file_id = COALESCE(${updates.fileId ?? null}, file_id),
      file_name = COALESCE(${updates.fileName ?? null}, file_name),
      error = ${updates.error ?? null},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function listBoardExportJobs(userId: string): Promise<BoardExportJob[]> {
  await ensureBoardExportsTable();
  const rows = await sql`
    SELECT * FROM mb_board_exports WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 30
  `;
  return rows.map(rowToBoardExportJob);
}

export async function getBoardExportJob(id: string, userId: string): Promise<BoardExportJob | null> {
  await ensureBoardExportsTable();
  const rows = await sql`
    SELECT * FROM mb_board_exports WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows.length > 0 ? rowToBoardExportJob(rows[0]) : null;
}

export async function deleteBoardExportJob(id: string, userId: string): Promise<boolean> {
  await ensureBoardExportsTable();
  const rows = await sql`
    DELETE FROM mb_board_exports WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  return rows.length > 0;
}

// --- Folders (per-user asset stash) ---
//
// Each user has a list of folders. Each folder has items — a reference to a
// file_id in mb_files plus some display metadata. Items are 14-day TTL because
// their backing file rows are swept; we also prune orphan item rows when a
// file disappears. Folders themselves don't expire.

export interface Folder {
  id: string;
  userId: string;
  name: string;
  itemCount: number;
  createdAt: string;
}

export interface FolderItem {
  id: string;
  folderId: string;
  fileId: string;
  mediaType: "image" | "video" | "audio";
  fileName: string;
  createdAt: string;
}

let foldersTablesInitialized = false;

async function ensureFoldersTables(): Promise<void> {
  if (foldersTablesInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_folders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Untitled',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mb_folders_user_idx ON mb_folders (user_id, created_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_folder_items (
      id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      file_name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mb_folder_items_folder_idx ON mb_folder_items (folder_id, created_at DESC)`;
  foldersTablesInitialized = true;
}

function rowToFolder(row: Record<string, unknown>, itemCount: number): Folder {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    itemCount,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

function rowToFolderItem(row: Record<string, unknown>): FolderItem {
  return {
    id: row.id as string,
    folderId: row.folder_id as string,
    fileId: row.file_id as string,
    mediaType: row.media_type as "image" | "video" | "audio",
    fileName: (row.file_name as string) || "",
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function listFolders(userId: string): Promise<Folder[]> {
  await ensureFoldersTables();
  const rows = await sql`
    SELECT f.*, COUNT(fi.id) AS item_count
    FROM mb_folders f
    LEFT JOIN mb_folder_items fi ON fi.folder_id = f.id
    WHERE f.user_id = ${userId}
    GROUP BY f.id
    ORDER BY f.created_at DESC
  `;
  return rows.map((r) => rowToFolder(r, Number(r.item_count || 0)));
}

export async function createFolder(userId: string, name: string): Promise<Folder> {
  await ensureFoldersTables();
  const id = `fd_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const safeName = (name || "Untitled").toString().slice(0, 80);
  const rows = await sql`
    INSERT INTO mb_folders (id, user_id, name)
    VALUES (${id}, ${userId}, ${safeName})
    RETURNING *
  `;
  return rowToFolder(rows[0], 0);
}

export async function renameFolder(id: string, userId: string, name: string): Promise<boolean> {
  await ensureFoldersTables();
  const safeName = (name || "Untitled").toString().slice(0, 80);
  const rows = await sql`
    UPDATE mb_folders SET name = ${safeName}
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function deleteFolder(id: string, userId: string): Promise<boolean> {
  await ensureFoldersTables();
  const rows = await sql`
    DELETE FROM mb_folders WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  if (rows.length > 0) {
    await sql`DELETE FROM mb_folder_items WHERE folder_id = ${id}`;
  }
  return rows.length > 0;
}

// List items whose backing file still exists in mb_files. Filters out rows whose
// file was swept by the TTL so we don't render broken thumbnails.
export async function listFolderItems(folderId: string, userId: string): Promise<FolderItem[]> {
  await ensureFoldersTables();
  const owner = await sql`SELECT 1 FROM mb_folders WHERE id = ${folderId} AND user_id = ${userId}`;
  if (owner.length === 0) return [];
  const rows = await sql`
    SELECT fi.*
    FROM mb_folder_items fi
    JOIN mb_files f ON f.id = fi.file_id
    WHERE fi.folder_id = ${folderId}
    ORDER BY fi.created_at DESC
  `;
  return rows.map(rowToFolderItem);
}

export async function addFolderItem(
  folderId: string,
  userId: string,
  fileId: string,
  mediaType: "image" | "video" | "audio",
  fileName: string
): Promise<FolderItem | null> {
  await ensureFoldersTables();
  const owner = await sql`SELECT 1 FROM mb_folders WHERE id = ${folderId} AND user_id = ${userId}`;
  if (owner.length === 0) return null;
  const id = `fi_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const safeName = (fileName || "Untitled").toString().slice(0, 120);
  const rows = await sql`
    INSERT INTO mb_folder_items (id, folder_id, file_id, media_type, file_name)
    VALUES (${id}, ${folderId}, ${fileId}, ${mediaType}, ${safeName})
    RETURNING *
  `;
  return rowToFolderItem(rows[0]);
}

export async function deleteFolderItem(itemId: string, userId: string): Promise<boolean> {
  await ensureFoldersTables();
  const rows = await sql`
    DELETE FROM mb_folder_items
    WHERE id = ${itemId}
      AND folder_id IN (SELECT id FROM mb_folders WHERE user_id = ${userId})
    RETURNING id
  `;
  return rows.length > 0;
}

// --- Community (Instagram-style feed) ---
//
// Creators publish a single piece of media (image or video) with a caption. Any
// signed-in user can like a post; users can flag posts for review; admins can
// hide posts. Media lives in mb_files — posts store a file_id reference.

export const COMMUNITY_CATEGORIES = ["General", "Showcase", "Help", "Wins", "Feedback"] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export interface CommunityPost {
  id: string;
  userId: string;
  authorName: string;
  fileId: string | null;
  mediaType: "image" | "video" | null;
  title: string;
  body: string;
  category: CommunityCategory;
  pinned: boolean;
  hidden: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

export interface CommunityPostWithLike extends CommunityPost {
  likedByMe: boolean;
  flaggedByMe: boolean;
}

export interface CommunityComment {
  id: string;
  postId: string;
  parentId: string | null;
  userId: string;
  authorName: string;
  body: string;
  hidden: boolean;
  likeCount: number;
  createdAt: string;
}

export interface CommunityCommentWithLike extends CommunityComment {
  likedByMe: boolean;
}

let communityTablesInitialized = false;

async function ensureCommunityTables(): Promise<void> {
  if (communityTablesInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_community_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      author_name TEXT NOT NULL DEFAULT '',
      file_id TEXT,
      media_type TEXT,
      caption TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'General',
      pinned BOOLEAN NOT NULL DEFAULT FALSE,
      hidden BOOLEAN NOT NULL DEFAULT FALSE,
      like_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // Older rows predate title/body/category/pinned/comment_count — add them if
  // missing. ALTER ... IF NOT EXISTS is idempotent and cheap.
  await sql`ALTER TABLE mb_community_posts ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE mb_community_posts ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE mb_community_posts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General'`;
  await sql`ALTER TABLE mb_community_posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE mb_community_posts ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0`;
  // file_id started as NOT NULL; relax it so text-only posts are allowed.
  await sql`ALTER TABLE mb_community_posts ALTER COLUMN file_id DROP NOT NULL`;
  await sql`ALTER TABLE mb_community_posts ALTER COLUMN media_type DROP NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS mb_community_posts_feed_idx ON mb_community_posts (hidden, pinned DESC, created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS mb_community_likes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_community_flags (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mb_community_flags_post_idx ON mb_community_flags (post_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS mb_community_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      parent_id TEXT,
      user_id TEXT NOT NULL,
      author_name TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      hidden BOOLEAN NOT NULL DEFAULT FALSE,
      like_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mb_community_comments_post_idx ON mb_community_comments (post_id, created_at ASC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_community_comment_likes (
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (comment_id, user_id)
    )
  `;
  communityTablesInitialized = true;
}

function sanitizeCategory(raw: unknown): CommunityCategory {
  const v = typeof raw === "string" ? raw : "";
  return (COMMUNITY_CATEGORIES as readonly string[]).includes(v)
    ? (v as CommunityCategory)
    : "General";
}

function rowToCommunityPost(row: Record<string, unknown>): CommunityPost {
  const title = (row.title as string) || (row.caption as string) || "";
  const body = (row.body as string) || "";
  return {
    id: row.id as string,
    userId: row.user_id as string,
    authorName: (row.author_name as string) || "",
    fileId: (row.file_id as string | null) ?? null,
    mediaType: (row.media_type as "image" | "video" | null) ?? null,
    title,
    body,
    category: sanitizeCategory(row.category),
    pinned: (row.pinned as boolean) ?? false,
    hidden: row.hidden as boolean,
    likeCount: (row.like_count as number) || 0,
    commentCount: (row.comment_count as number) || 0,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function createCommunityPost(params: {
  userId: string;
  authorName: string;
  title: string;
  body: string;
  category: CommunityCategory;
  fileId: string | null;
  mediaType: "image" | "video" | null;
}): Promise<CommunityPost> {
  await ensureCommunityTables();
  const id = `cp_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const rows = await sql`
    INSERT INTO mb_community_posts (id, user_id, author_name, file_id, media_type, title, body, category)
    VALUES (
      ${id}, ${params.userId}, ${params.authorName},
      ${params.fileId}, ${params.mediaType},
      ${params.title}, ${params.body}, ${params.category}
    )
    RETURNING *
  `;
  return rowToCommunityPost(rows[0]);
}

// List posts: pinned first, then newest. Filter by category when provided.
// Admins see hidden posts too; everyone else only sees visible posts.
export async function listCommunityPosts(
  currentUserId: string | null,
  isAdmin: boolean,
  opts: { category?: CommunityCategory | "All"; limit?: number; offset?: number } = {}
): Promise<CommunityPostWithLike[]> {
  await ensureCommunityTables();
  const limit = opts.limit ?? 60;
  const offset = opts.offset ?? 0;
  const catFilter = opts.category && opts.category !== "All" ? opts.category : null;

  const rows = isAdmin
    ? catFilter
      ? await sql`
          SELECT * FROM mb_community_posts
          WHERE category = ${catFilter}
          ORDER BY pinned DESC, created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT * FROM mb_community_posts
          ORDER BY pinned DESC, created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
    : catFilter
      ? await sql`
          SELECT * FROM mb_community_posts
          WHERE hidden = FALSE AND category = ${catFilter}
          ORDER BY pinned DESC, created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT * FROM mb_community_posts
          WHERE hidden = FALSE
          ORDER BY pinned DESC, created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

  if (rows.length === 0) return [];
  const postIds = rows.map((r) => r.id as string);
  let likedSet = new Set<string>();
  let flaggedSet = new Set<string>();
  if (currentUserId) {
    const likeRows = await sql`
      SELECT post_id FROM mb_community_likes
      WHERE user_id = ${currentUserId} AND post_id = ANY(${postIds as unknown as string[]}::text[])
    `;
    likedSet = new Set(likeRows.map((r) => r.post_id as string));
    const flagRows = await sql`
      SELECT DISTINCT post_id FROM mb_community_flags
      WHERE user_id = ${currentUserId} AND post_id = ANY(${postIds as unknown as string[]}::text[])
    `;
    flaggedSet = new Set(flagRows.map((r) => r.post_id as string));
  }
  return rows.map((r) => ({
    ...rowToCommunityPost(r),
    likedByMe: likedSet.has(r.id as string),
    flaggedByMe: flaggedSet.has(r.id as string),
  }));
}

export async function setCommunityPostPinned(id: string, pinned: boolean): Promise<boolean> {
  await ensureCommunityTables();
  const rows = await sql`
    UPDATE mb_community_posts SET pinned = ${pinned} WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

export async function getCommunityPost(id: string): Promise<CommunityPost | null> {
  await ensureCommunityTables();
  const rows = await sql`SELECT * FROM mb_community_posts WHERE id = ${id}`;
  return rows.length > 0 ? rowToCommunityPost(rows[0]) : null;
}

export async function deleteCommunityPost(id: string, userId: string): Promise<boolean> {
  await ensureCommunityTables();
  const rows = await sql`
    DELETE FROM mb_community_posts WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  if (rows.length > 0) {
    await sql`DELETE FROM mb_community_likes WHERE post_id = ${id}`;
    await sql`DELETE FROM mb_community_flags WHERE post_id = ${id}`;
  }
  return rows.length > 0;
}

export async function setCommunityPostHidden(id: string, hidden: boolean): Promise<boolean> {
  await ensureCommunityTables();
  const rows = await sql`
    UPDATE mb_community_posts SET hidden = ${hidden} WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

// Toggle a like for (post, user). Returns the new liked state and the new count.
// Uses the likes row as source of truth and denormalizes like_count on the post
// row so the feed can render counts without a JOIN.
export async function toggleCommunityLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number } | null> {
  await ensureCommunityTables();
  const existing = await sql`
    SELECT 1 FROM mb_community_likes WHERE post_id = ${postId} AND user_id = ${userId}
  `;
  if (existing.length > 0) {
    await sql`DELETE FROM mb_community_likes WHERE post_id = ${postId} AND user_id = ${userId}`;
    const rows = await sql`
      UPDATE mb_community_posts SET like_count = GREATEST(like_count - 1, 0)
      WHERE id = ${postId} RETURNING like_count
    `;
    if (rows.length === 0) return null;
    return { liked: false, likeCount: rows[0].like_count as number };
  }
  await sql`INSERT INTO mb_community_likes (post_id, user_id) VALUES (${postId}, ${userId})`;
  const rows = await sql`
    UPDATE mb_community_posts SET like_count = like_count + 1
    WHERE id = ${postId} RETURNING like_count
  `;
  if (rows.length === 0) return null;
  return { liked: true, likeCount: rows[0].like_count as number };
}

export async function flagCommunityPost(
  postId: string,
  userId: string,
  reason: string
): Promise<boolean> {
  await ensureCommunityTables();
  const post = await getCommunityPost(postId);
  if (!post) return false;
  const id = `cf_${Date.now()}_${randomBytes(4).toString("hex")}`;
  await sql`
    INSERT INTO mb_community_flags (id, post_id, user_id, reason)
    VALUES (${id}, ${postId}, ${userId}, ${reason})
  `;
  return true;
}

export interface CommunityFlagWithPost {
  id: string;
  postId: string;
  userId: string;
  reason: string;
  createdAt: string;
  post: CommunityPost | null;
}

export async function listCommunityFlags(limit = 100): Promise<CommunityFlagWithPost[]> {
  await ensureCommunityTables();
  const rows = await sql`
    SELECT f.id AS flag_id, f.post_id, f.user_id, f.reason, f.created_at,
           p.id AS p_id, p.user_id AS p_user_id, p.author_name AS p_author_name,
           p.file_id AS p_file_id, p.media_type AS p_media_type, p.caption AS p_caption,
           p.hidden AS p_hidden, p.like_count AS p_like_count, p.created_at AS p_created_at
    FROM mb_community_flags f
    LEFT JOIN mb_community_posts p ON p.id = f.post_id
    ORDER BY f.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.flag_id as string,
    postId: r.post_id as string,
    userId: r.user_id as string,
    reason: (r.reason as string) || "",
    createdAt: (r.created_at as Date).toISOString(),
    post: r.p_id
      ? {
          id: r.p_id as string,
          userId: r.p_user_id as string,
          authorName: (r.p_author_name as string) || "",
          fileId: (r.p_file_id as string | null) ?? null,
          mediaType: (r.p_media_type as "image" | "video" | null) ?? null,
          title: "",
          body: "",
          category: "General" as CommunityCategory,
          pinned: false,
          hidden: r.p_hidden as boolean,
          likeCount: (r.p_like_count as number) || 0,
          commentCount: 0,
          createdAt: (r.p_created_at as Date).toISOString(),
        }
      : null,
  }));
}

// --- Community comments -----------------------------------------------------

function rowToCommunityComment(row: Record<string, unknown>): CommunityComment {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    parentId: (row.parent_id as string | null) ?? null,
    userId: row.user_id as string,
    authorName: (row.author_name as string) || "",
    body: (row.body as string) || "",
    hidden: row.hidden as boolean,
    likeCount: (row.like_count as number) || 0,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function listCommunityComments(
  postId: string,
  currentUserId: string | null,
  isAdmin: boolean
): Promise<CommunityCommentWithLike[]> {
  await ensureCommunityTables();
  const rows = isAdmin
    ? await sql`
        SELECT * FROM mb_community_comments
        WHERE post_id = ${postId}
        ORDER BY created_at ASC
      `
    : await sql`
        SELECT * FROM mb_community_comments
        WHERE post_id = ${postId} AND hidden = FALSE
        ORDER BY created_at ASC
      `;
  if (rows.length === 0) return [];
  let likedSet = new Set<string>();
  if (currentUserId) {
    const commentIds = rows.map((r) => r.id as string);
    const likeRows = await sql`
      SELECT comment_id FROM mb_community_comment_likes
      WHERE user_id = ${currentUserId} AND comment_id = ANY(${commentIds as unknown as string[]}::text[])
    `;
    likedSet = new Set(likeRows.map((r) => r.comment_id as string));
  }
  return rows.map((r) => ({
    ...rowToCommunityComment(r),
    likedByMe: likedSet.has(r.id as string),
  }));
}

export async function createCommunityComment(params: {
  postId: string;
  userId: string;
  authorName: string;
  body: string;
  parentId: string | null;
}): Promise<CommunityComment | null> {
  await ensureCommunityTables();
  const post = await getCommunityPost(params.postId);
  if (!post) return null;
  const id = `cc_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const trimmed = params.body.trim().slice(0, 4000);
  if (!trimmed) return null;
  const rows = await sql`
    INSERT INTO mb_community_comments (id, post_id, parent_id, user_id, author_name, body)
    VALUES (${id}, ${params.postId}, ${params.parentId}, ${params.userId}, ${params.authorName}, ${trimmed})
    RETURNING *
  `;
  await sql`
    UPDATE mb_community_posts SET comment_count = comment_count + 1 WHERE id = ${params.postId}
  `;
  return rowToCommunityComment(rows[0]);
}

export async function deleteCommunityComment(
  commentId: string,
  userId: string,
  isAdmin: boolean
): Promise<boolean> {
  await ensureCommunityTables();
  const rows = isAdmin
    ? await sql`DELETE FROM mb_community_comments WHERE id = ${commentId} RETURNING post_id`
    : await sql`DELETE FROM mb_community_comments WHERE id = ${commentId} AND user_id = ${userId} RETURNING post_id`;
  if (rows.length === 0) return false;
  const postId = rows[0].post_id as string;
  await sql`DELETE FROM mb_community_comment_likes WHERE comment_id = ${commentId}`;
  await sql`
    UPDATE mb_community_posts SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = ${postId}
  `;
  return true;
}

export async function setCommunityCommentHidden(commentId: string, hidden: boolean): Promise<boolean> {
  await ensureCommunityTables();
  const rows = await sql`
    UPDATE mb_community_comments SET hidden = ${hidden} WHERE id = ${commentId} RETURNING id
  `;
  return rows.length > 0;
}

export async function toggleCommunityCommentLike(
  commentId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number } | null> {
  await ensureCommunityTables();
  const existing = await sql`
    SELECT 1 FROM mb_community_comment_likes WHERE comment_id = ${commentId} AND user_id = ${userId}
  `;
  if (existing.length > 0) {
    await sql`DELETE FROM mb_community_comment_likes WHERE comment_id = ${commentId} AND user_id = ${userId}`;
    const rows = await sql`
      UPDATE mb_community_comments SET like_count = GREATEST(like_count - 1, 0)
      WHERE id = ${commentId} RETURNING like_count
    `;
    if (rows.length === 0) return null;
    return { liked: false, likeCount: rows[0].like_count as number };
  }
  await sql`INSERT INTO mb_community_comment_likes (comment_id, user_id) VALUES (${commentId}, ${userId})`;
  const rows = await sql`
    UPDATE mb_community_comments SET like_count = like_count + 1
    WHERE id = ${commentId} RETURNING like_count
  `;
  if (rows.length === 0) return null;
  return { liked: true, likeCount: rows[0].like_count as number };
}

// --- Leaderboard ------------------------------------------------------------
//
// Points = 5 per post + 1 per comment + 1 per like received (on either posts
// or comments). Computed live — community volume is small enough that the full
// scan is cheap, and no caching saves us from stale counts.

export interface LeaderboardEntry {
  userId: string;
  authorName: string;
  points: number;
  postCount: number;
  commentCount: number;
  level: number;
}

function pointsToLevel(points: number): number {
  // Level curve: 1 at 0, 2 at 10, 3 at 30, 4 at 70, 5 at 150, 6 at 310 …
  // Each level takes 2× the prior delta + 10. Cap at 10.
  let level = 1;
  let needed = 10;
  let remaining = points;
  while (remaining >= needed && level < 10) {
    remaining -= needed;
    level += 1;
    needed = needed * 2;
  }
  return level;
}

export async function getCommunityLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  await ensureCommunityTables();
  const rows = await sql`
    WITH post_stats AS (
      SELECT user_id, MAX(author_name) AS author_name,
             COUNT(*) AS post_count,
             COALESCE(SUM(like_count), 0) AS post_likes
      FROM mb_community_posts
      WHERE hidden = FALSE
      GROUP BY user_id
    ),
    comment_stats AS (
      SELECT user_id, MAX(author_name) AS author_name,
             COUNT(*) AS comment_count,
             COALESCE(SUM(like_count), 0) AS comment_likes
      FROM mb_community_comments
      WHERE hidden = FALSE
      GROUP BY user_id
    )
    SELECT
      COALESCE(p.user_id, c.user_id) AS user_id,
      COALESCE(p.author_name, c.author_name, 'Creator') AS author_name,
      COALESCE(p.post_count, 0)::int AS post_count,
      COALESCE(c.comment_count, 0)::int AS comment_count,
      (COALESCE(p.post_count, 0) * 5
       + COALESCE(c.comment_count, 0) * 1
       + COALESCE(p.post_likes, 0)
       + COALESCE(c.comment_likes, 0))::int AS points
    FROM post_stats p
    FULL OUTER JOIN comment_stats c ON p.user_id = c.user_id
    ORDER BY points DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => {
    const points = (r.points as number) || 0;
    return {
      userId: r.user_id as string,
      authorName: (r.author_name as string) || "Creator",
      points,
      postCount: (r.post_count as number) || 0,
      commentCount: (r.comment_count as number) || 0,
      level: pointsToLevel(points),
    };
  });
}
