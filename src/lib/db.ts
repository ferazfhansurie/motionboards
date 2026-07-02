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

// Operator emails with access to the admin surfaces (logs, registered users,
// the real-human asset request queue). Kept alongside the `role === "admin"`
// DB flag — any match grants access, so owner emails work out-of-the-box
// without a DB update. ADMIN_EMAIL stays a single value for back-compat
// (funnel exclusion references it); ADMIN_EMAILS is the full allowlist.
export const ADMIN_EMAIL = "hello@adleticagency.com";
export const ADMIN_EMAILS = [ADMIN_EMAIL, "faeez@fathopesenergy.com"];

export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === "admin" || ADMIN_EMAILS.includes(user.email.toLowerCase());
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

// Lazy migration for the per-charge audit columns. Called from
// chargeForGeneration before its first write each cold start.
let chargeColumnsEnsured = false;
async function ensureChargeColumns() {
  if (chargeColumnsEnsured) return;
  await sql`ALTER TABLE mb_generations ADD COLUMN IF NOT EXISTS actual_cost_credits INTEGER`;
  await sql`ALTER TABLE mb_generations ADD COLUMN IF NOT EXISTS markup_credits INTEGER`;
  chargeColumnsEnsured = true;
}

// Charge the user for a successful generation. Looks up the actual cost via
// the pricing module, adds the platform markup, deducts in one DB write,
// and records the breakdown on the generation row for audit.
//
// Returns the totalCredits actually deducted, or 0 if the user couldn't
// afford it (which shouldn't happen — the pre-flight check should catch
// that — but we don't want to crash if someone races their balance to zero).
export async function chargeForGeneration(opts: {
  userId: string;
  generationId: string;
  modelId: string;
  providerCostUsd?: number;
  durationSec?: number;
  hasAudio?: boolean;
  resolution?: string;
}): Promise<{ totalCredits: number; providerCredits: number; markupCredits: number }> {
  // Lazy-import to avoid a top-level cycle (pricing imports models, db is
  // imported by routes that also import models).
  const { computeCharge } = await import("@/lib/pricing");
  const charge = computeCharge(opts);
  await ensureChargeColumns();
  const ok = await deductCredits(opts.userId, charge.totalCredits);
  if (!ok) {
    // Negative-balance guard: don't write the breakdown if we couldn't
    // actually pull the funds. The caller should already have validated
    // affordability up front; this is just belt-and-braces.
    return { totalCredits: 0, providerCredits: 0, markupCredits: 0 };
  }
  await sql`
    UPDATE mb_generations
    SET credit_cost = ${charge.totalCredits},
        actual_cost_credits = ${charge.providerCredits},
        markup_credits = ${charge.markupCredits}
    WHERE id = ${opts.generationId}
  `;
  return {
    totalCredits: charge.totalCredits,
    providerCredits: charge.providerCredits,
    markupCredits: charge.markupCredits,
  };
}

export async function getUserCredits(userId: string): Promise<number> {
  const rows = await sql`SELECT credits FROM mb_users WHERE id = ${userId}`;
  return rows.length > 0 ? (rows[0].credits as number) : 0;
}

// --- In-house event log (impressions, conversions, etc.) ---
//
// Replaces Meta Pixel. Every meaningful action — page view, generate-gated,
// signup form view, subscribe click, paid conversion — gets a row. Anonymous
// visitors get an `anon_id` (a UUID stored in their localStorage) so we can
// stitch their pre-signup activity to their user_id once they sign up.

let eventColumnsEnsured = false;
async function ensureEventTable() {
  if (eventColumnsEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_events (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      anon_id TEXT,
      event_name TEXT NOT NULL,
      pathname TEXT,
      referrer TEXT,
      user_agent TEXT,
      properties JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_mb_events_event_name ON mb_events(event_name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mb_events_user_id ON mb_events(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mb_events_anon_id ON mb_events(anon_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mb_events_created_at ON mb_events(created_at DESC)`;
  eventColumnsEnsured = true;
}

export interface RecordEventInput {
  userId?: string | null;
  anonId?: string | null;
  eventName: string;
  pathname?: string;
  referrer?: string;
  userAgent?: string;
  properties?: Record<string, unknown>;
}

export async function recordEvent(input: RecordEventInput): Promise<void> {
  await ensureEventTable();
  await sql`
    INSERT INTO mb_events (user_id, anon_id, event_name, pathname, referrer, user_agent, properties)
    VALUES (
      ${input.userId || null},
      ${input.anonId || null},
      ${input.eventName},
      ${input.pathname || null},
      ${input.referrer || null},
      ${input.userAgent || null},
      ${input.properties ? JSON.stringify(input.properties) : null}
    )
  `;
}

export interface EventCount {
  eventName: string;
  count: number;
  uniqueAnons: number;
  uniqueUsers: number;
}

export async function getEventCounts(since: Date, until?: Date): Promise<EventCount[]> {
  try {
    await ensureEventTable();
    const upper = until ?? new Date();
    // Exclude admin users (role='admin' OR the operator email) so the funnel
    // reflects real visitor behaviour, not the team browsing their own site.
    const rows = await sql`
      SELECT
        e.event_name,
        COUNT(*)::int AS count,
        COUNT(DISTINCT e.anon_id)::int AS unique_anons,
        COUNT(DISTINCT e.user_id)::int AS unique_users
      FROM mb_events e
      LEFT JOIN mb_users u ON u.id = e.user_id
      WHERE e.created_at >= ${since}
        AND e.created_at < ${upper}
        AND (u.id IS NULL OR (u.role <> 'admin' AND LOWER(u.email) <> LOWER(${ADMIN_EMAIL})))
      GROUP BY e.event_name
      ORDER BY count DESC
    `;
    return rows.map((r) => ({
      eventName: r.event_name as string,
      count: (r.count as number) || 0,
      uniqueAnons: (r.unique_anons as number) || 0,
      uniqueUsers: (r.unique_users as number) || 0,
    }));
  } catch {
    return [];
  }
}

export interface PathImpression {
  pathname: string;
  count: number;
  uniqueVisitors: number;
}

export async function getTopPaths(since: Date, until?: Date, limit = 20): Promise<PathImpression[]> {
  try {
    await ensureEventTable();
    const upper = until ?? new Date();
    // SPLIT_PART strips any leftover query string from older rows that were
    // captured before we stopped including window.location.search — so
    // /generate?fbclid=... folds back into /generate.
    // Admin traffic excluded here too.
    const rows = await sql`
      SELECT
        SPLIT_PART(e.pathname, '?', 1) AS pathname,
        COUNT(*)::int AS count,
        COUNT(DISTINCT COALESCE(e.user_id, e.anon_id))::int AS unique_visitors
      FROM mb_events e
      LEFT JOIN mb_users u ON u.id = e.user_id
      WHERE e.created_at >= ${since}
        AND e.created_at < ${upper}
        AND e.event_name = 'page_view'
        AND e.pathname IS NOT NULL
        AND (u.id IS NULL OR (u.role <> 'admin' AND LOWER(u.email) <> LOWER(${ADMIN_EMAIL})))
      GROUP BY SPLIT_PART(e.pathname, '?', 1)
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      pathname: r.pathname as string,
      count: (r.count as number) || 0,
      uniqueVisitors: (r.unique_visitors as number) || 0,
    }));
  } catch {
    return [];
  }
}

// --- Registration funnel metrics ---
//
// All data is derived from existing tables (mb_users / mb_sessions /
// mb_generations) — no new event log needed. Each stage is a strict subset
// of the previous one, so conversion rates come straight from the counts.
export interface FunnelSignup {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  subscriptionActive: boolean;
  loggedIn: boolean;          // has at least one session row
  generationCount: number;    // total generations submitted
  completedCount: number;     // generations that completed
}

export interface FunnelMetrics {
  since: string; // ISO timestamp of cohort lower bound (inclusive)
  until: string; // ISO timestamp of cohort upper bound (exclusive)
  signedUp: number;
  loggedIn: number;
  subscriptionActive: number;
  madeGeneration: number;
  completedGeneration: number;
  stillSubscribed: number;
  // Useful side metrics
  medianMinutesToFirstGen: number | null;
  avgGenerationsPerActive: number | null;
  totalGenerations: number;
  totalCompletedGenerations: number;
  totalFailedGenerations: number;
  // Revenue (in CREDITS, divide by 100 for RM). Computed from the same
  // signup-cohort: only counts users who signed up in the period.
  subscriptionRevenueCredits: number;  // paid users × 1000 (RM10)
  markupRevenueCredits: number;        // sum of markup_credits on completed gens
  providerCostCredits: number;         // sum of actual_cost_credits on completed gens (your provider bill)
  totalRevenueCredits: number;         // subscription + markup
  expectedRmPerSignup: number;         // totalRevenueCredits / signedUp / 100, in RM
  // Per-user list — every signup in the period, with the per-stage flags
  // so the table count must equal `signedUp` by construction.
  signups: FunnelSignup[];
}

export async function getRegistrationFunnel(since: Date, until?: Date): Promise<FunnelMetrics> {
  // The cohort is everyone who signed up between `since` (inclusive) and
  // `until` (exclusive). Defaults to "now" for the upper bound.
  const upper = until ?? new Date();

  // Signed up in range
  const r1 = await sql`SELECT COUNT(*)::int AS n FROM mb_users WHERE created_at >= ${since} AND created_at < ${upper}`;
  const signedUp = (r1[0]?.n as number) || 0;

  // Logged in: any session row tied to a user who signed up in range.
  const r2 = await sql`
    SELECT COUNT(DISTINCT u.id)::int AS n
    FROM mb_users u
    INNER JOIN mb_sessions s ON s.user_id = u.id
    WHERE u.created_at >= ${since} AND u.created_at < ${upper}
  `;
  const loggedIn = (r2[0]?.n as number) || 0;

  // Activated a paid subscription at any point (subscription_id set).
  // Wrap in try since the subscription columns are added lazily on first use.
  let subscriptionActive = 0;
  let stillSubscribed = 0;
  try {
    const r3 = await sql`
      SELECT COUNT(*)::int AS n FROM mb_users
      WHERE created_at >= ${since} AND created_at < ${upper} AND subscription_id IS NOT NULL
    `;
    subscriptionActive = (r3[0]?.n as number) || 0;

    const r3b = await sql`
      SELECT COUNT(*)::int AS n FROM mb_users
      WHERE created_at >= ${since}
        AND created_at < ${upper}
        AND subscription_active = true
        AND subscription_expires_at > NOW()
    `;
    stillSubscribed = (r3b[0]?.n as number) || 0;
  } catch { /* columns not yet created — treat as 0 */ }

  // Made any generation
  const r4 = await sql`
    SELECT COUNT(DISTINCT u.id)::int AS n
    FROM mb_users u
    INNER JOIN mb_generations g ON g.user_id = u.id
    WHERE u.created_at >= ${since} AND u.created_at < ${upper}
  `;
  const madeGeneration = (r4[0]?.n as number) || 0;

  // Completed at least one generation
  const r5 = await sql`
    SELECT COUNT(DISTINCT u.id)::int AS n
    FROM mb_users u
    INNER JOIN mb_generations g ON g.user_id = u.id
    WHERE u.created_at >= ${since} AND u.created_at < ${upper} AND g.status = 'completed'
  `;
  const completedGeneration = (r5[0]?.n as number) || 0;

  // Median minutes from signup → first generation (signup-cohort scoped)
  let medianMinutesToFirstGen: number | null = null;
  try {
    const r6 = await sql`
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (g.first_gen - u.created_at)) / 60.0
      ) AS p50
      FROM mb_users u
      INNER JOIN (
        SELECT user_id, MIN(created_at) AS first_gen FROM mb_generations GROUP BY user_id
      ) g ON g.user_id = u.id
      WHERE u.created_at >= ${since} AND u.created_at < ${upper}
    `;
    const p50 = r6[0]?.p50;
    if (typeof p50 === "string") medianMinutesToFirstGen = Math.round(parseFloat(p50));
    else if (typeof p50 === "number") medianMinutesToFirstGen = Math.round(p50);
  } catch { /* ignore */ }

  // Generations breakdown across the same cohort
  const r7 = await sql`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN g.status = 'completed' THEN 1 ELSE 0 END)::int AS completed,
      SUM(CASE WHEN g.status = 'failed' THEN 1 ELSE 0 END)::int AS failed
    FROM mb_generations g
    INNER JOIN mb_users u ON g.user_id = u.id
    WHERE u.created_at >= ${since} AND u.created_at < ${upper}
  `;
  const totalGenerations = (r7[0]?.total as number) || 0;
  const totalCompletedGenerations = (r7[0]?.completed as number) || 0;
  const totalFailedGenerations = (r7[0]?.failed as number) || 0;

  const avgGenerationsPerActive = madeGeneration > 0
    ? Math.round((totalGenerations / madeGeneration) * 10) / 10
    : null;

  // Revenue inside the cohort. Subscription = paid users × 1000 sen (RM10).
  // Markup = sum of markup_credits over their generations. Provider cost is
  // the actual_cost_credits sum — useful for showing the platform's gross margin.
  const SUBSCRIPTION_PRICE_CREDITS = 1000;
  const subscriptionRevenueCredits = subscriptionActive * SUBSCRIPTION_PRICE_CREDITS;
  let markupRevenueCredits = 0;
  let providerCostCredits = 0;
  try {
    const r8 = await sql`
      SELECT
        COALESCE(SUM(g.markup_credits), 0)::int AS markup,
        COALESCE(SUM(g.actual_cost_credits), 0)::int AS cost
      FROM mb_generations g
      INNER JOIN mb_users u ON g.user_id = u.id
      WHERE u.created_at >= ${since} AND u.created_at < ${upper} AND g.status = 'completed'
    `;
    markupRevenueCredits = (r8[0]?.markup as number) || 0;
    providerCostCredits = (r8[0]?.cost as number) || 0;
  } catch { /* columns absent on first run */ }
  const totalRevenueCredits = subscriptionRevenueCredits + markupRevenueCredits;
  const expectedRmPerSignup = signedUp > 0
    ? Math.round((totalRevenueCredits / signedUp / 100) * 100) / 100
    : 0;

  // Per-user list. One row per signup in the period, with flags showing
  // exactly which funnel stages they reached. Newest signups first so the
  // first row of the table matches the most recent activity.
  let signups: FunnelSignup[] = [];
  try {
    const rows = await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        COALESCE(u.subscription_active, false) AS subscription_active,
        EXISTS (SELECT 1 FROM mb_sessions s WHERE s.user_id = u.id) AS logged_in,
        (SELECT COUNT(*) FROM mb_generations g WHERE g.user_id = u.id)::int AS gen_count,
        (SELECT COUNT(*) FROM mb_generations g WHERE g.user_id = u.id AND g.status = 'completed')::int AS completed_count
      FROM mb_users u
      WHERE u.created_at >= ${since} AND u.created_at < ${upper}
      ORDER BY u.created_at DESC
      LIMIT 500
    `;
    signups = rows.map((r) => ({
      id: r.id as string,
      name: (r.name as string) || "",
      email: (r.email as string) || "",
      createdAt: (r.created_at as Date).toISOString(),
      subscriptionActive: !!r.subscription_active,
      loggedIn: !!r.logged_in,
      generationCount: (r.gen_count as number) || 0,
      completedCount: (r.completed_count as number) || 0,
    }));
  } catch (err) {
    // Subscription column probably hasn't been created yet — fall back to a
    // query without it so we still surface the list.
    console.error("[funnel] signup list fallback:", err);
    const rows = await sql`
      SELECT
        u.id, u.name, u.email, u.created_at,
        EXISTS (SELECT 1 FROM mb_sessions s WHERE s.user_id = u.id) AS logged_in,
        (SELECT COUNT(*) FROM mb_generations g WHERE g.user_id = u.id)::int AS gen_count,
        (SELECT COUNT(*) FROM mb_generations g WHERE g.user_id = u.id AND g.status = 'completed')::int AS completed_count
      FROM mb_users u
      WHERE u.created_at >= ${since} AND u.created_at < ${upper}
      ORDER BY u.created_at DESC
      LIMIT 500
    `;
    signups = rows.map((r) => ({
      id: r.id as string,
      name: (r.name as string) || "",
      email: (r.email as string) || "",
      createdAt: (r.created_at as Date).toISOString(),
      subscriptionActive: false,
      loggedIn: !!r.logged_in,
      generationCount: (r.gen_count as number) || 0,
      completedCount: (r.completed_count as number) || 0,
    }));
  }

  return {
    since: since.toISOString(),
    until: upper.toISOString(),
    signedUp,
    loggedIn,
    subscriptionActive,
    madeGeneration,
    completedGeneration,
    stillSubscribed,
    medianMinutesToFirstGen,
    avgGenerationsPerActive,
    totalGenerations,
    totalCompletedGenerations,
    totalFailedGenerations,
    subscriptionRevenueCredits,
    markupRevenueCredits,
    providerCostCredits,
    totalRevenueCredits,
    expectedRmPerSignup,
    signups,
  };
}

// --- Monthly subscription (RM10/mo → 1000 credits added per billing cycle) ---
//
// Low-friction entry tier for conversion. Pay RM10, get RM10 worth of credits
// to spend on AI generations. Platform earns from the per-generation markup
// (RM0.01/image, RM0.20/video) on top of the credits the user spends.
//
// The columns are added lazily the first time the feature runs. Credits stay
// in the user's balance whether the subscription is active or not — cancellation
// just stops new top-ups from being applied, it doesn't wipe what's already
// sitting in the account.
export const MONTHLY_SUBSCRIPTION_CREDITS = 1000; // RM10 in sen / 100 credits per RM
export const MONTHLY_SUBSCRIPTION_PRICE_SEN = 1000; // RM10
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
  creditCost?: number;          // Total deducted (provider + markup)
  actualCostCredits?: number;   // Provider's portion only
  markupCredits?: number;       // Platform markup
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
    actualCostCredits: row.actual_cost_credits as number | undefined,
    markupCredits: row.markup_credits as number | undefined,
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

// Same as getAllGenerations but joins on mb_users so the admin logs view can
// show whose account each generation came from. Email + name only — never
// returns password hashes.
export interface GenerationWithUser extends Generation {
  userEmail?: string | null;
  userName?: string | null;
}

export async function getAllGenerationsWithUser(opts?: { limit?: number; userId?: string }): Promise<GenerationWithUser[]> {
  const limit = opts?.limit ?? 500;
  const userIdFilter = opts?.userId;
  const rows = userIdFilter
    ? await sql`
        SELECT g.*, u.email AS u_email, u.name AS u_name
        FROM mb_generations g
        LEFT JOIN mb_users u ON u.id = g.user_id
        WHERE g.user_id = ${userIdFilter}
        ORDER BY g.created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT g.*, u.email AS u_email, u.name AS u_name
        FROM mb_generations g
        LEFT JOIN mb_users u ON u.id = g.user_id
        ORDER BY g.created_at DESC
        LIMIT ${limit}
      `;
  return rows.map((r) => ({
    ...rowToGeneration(r),
    userEmail: (r.u_email as string | null) ?? null,
    userName: (r.u_name as string | null) ?? null,
  }));
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
  // Index for fast TTL sweeps (covers WHERE created_at < cutoff queries).
  await sql`CREATE INDEX IF NOT EXISTS mb_files_created_at_idx ON mb_files (created_at)`;
  // Composite index for the per-user newest-first library queries
  // (WHERE user_id = ? ORDER BY created_at DESC LIMIT N). Without this the
  // /media page hangs on accounts with hundreds of files because Postgres
  // has to filter then sort the whole slice.
  await sql`CREATE INDEX IF NOT EXISTS mb_files_user_created_idx ON mb_files (user_id, created_at DESC)`;
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
  // Lazy migration — safe to run repeatedly. Both columns added together so
  // the picker + the instruction share one ALTER round-trip.
  await sql`ALTER TABLE mb_users ADD COLUMN IF NOT EXISTS ai_instruction TEXT`;
  await sql`ALTER TABLE mb_users ADD COLUMN IF NOT EXISTS ai_model TEXT`;
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

export async function getUserAIModel(userId: string): Promise<string | null> {
  await ensureAIInstructionColumn();
  const rows = await sql`SELECT ai_model FROM mb_users WHERE id = ${userId}`;
  if (rows.length === 0) return null;
  return (rows[0].ai_model as string | null) || null;
}

export async function setUserAIModel(userId: string, model: string): Promise<void> {
  await ensureAIInstructionColumn();
  await sql`UPDATE mb_users SET ai_model = ${model} WHERE id = ${userId}`;
}

// --- Single-tab session lock ---
//
// Users were silently losing canvas state when they had MotionBoards open in
// multiple tabs / devices: each tab autosaves its own (possibly stale) state
// every 2s, so the last writer wins and the others' edits get clobbered. To
// prevent that, every tab heartbeats a unique tab id; whichever tab claims
// the slot first owns saves until it goes silent for >TAB_OWNER_TTL_MS, after
// which any other tab can take over. Non-owner tabs surface a modal and stop
// firing autosaves so they can't damage the owner's work.

export const TAB_OWNER_TTL_MS = 30_000; // 30s — heartbeat is every 5s, so 6 misses = considered abandoned

let activeTabColumnsInitialized = false;
async function ensureActiveTabColumns(): Promise<void> {
  if (activeTabColumnsInitialized) return;
  await sql`ALTER TABLE mb_users ADD COLUMN IF NOT EXISTS active_tab_id TEXT`;
  await sql`ALTER TABLE mb_users ADD COLUMN IF NOT EXISTS active_tab_seen_at TIMESTAMPTZ`;
  activeTabColumnsInitialized = true;
}

export interface ActiveTabInfo {
  ownerTabId: string | null;
  ownerSeenAt: number; // ms epoch, 0 if never
  isYou: boolean;       // true if the caller's tabId matches the current owner
}

// Heartbeat from a tab. If the slot is empty, expired, or already held by
// `tabId`, the slot is (re)claimed and `seen_at = NOW()`. Otherwise the
// existing owner is left alone and we just report it back. Atomic via a
// single UPDATE with a guard in the WHERE clause.
export async function heartbeatActiveTab(userId: string, tabId: string): Promise<ActiveTabInfo> {
  await ensureActiveTabColumns();

  // Atomic claim: claim the slot if it's free, expired, OR already mine.
  const claimed = await sql`
    UPDATE mb_users
    SET active_tab_id = ${tabId}, active_tab_seen_at = NOW()
    WHERE id = ${userId}
      AND (
        active_tab_id IS NULL
        OR active_tab_id = ${tabId}
        OR active_tab_seen_at IS NULL
        OR active_tab_seen_at < NOW() - (${TAB_OWNER_TTL_MS} || ' milliseconds')::interval
      )
    RETURNING active_tab_id, active_tab_seen_at
  `;

  if (claimed.length > 0) {
    const seenAt = claimed[0].active_tab_seen_at as Date | null;
    return {
      ownerTabId: claimed[0].active_tab_id as string,
      ownerSeenAt: seenAt ? seenAt.getTime() : Date.now(),
      isYou: true,
    };
  }

  // Couldn't claim — read the current owner.
  const rows = await sql`
    SELECT active_tab_id, active_tab_seen_at FROM mb_users WHERE id = ${userId}
  `;
  if (rows.length === 0) {
    return { ownerTabId: null, ownerSeenAt: 0, isYou: false };
  }
  const seenAt = rows[0].active_tab_seen_at as Date | null;
  return {
    ownerTabId: (rows[0].active_tab_id as string | null) || null,
    ownerSeenAt: seenAt ? seenAt.getTime() : 0,
    isYou: false,
  };
}

// Force-claim the slot even if another tab currently holds it. Used by the
// "Take over here" button on the multi-tab modal. The previous owner will see
// the mismatch on its next heartbeat and lock its own UI.
export async function forceClaimActiveTab(userId: string, tabId: string): Promise<ActiveTabInfo> {
  await ensureActiveTabColumns();
  await sql`
    UPDATE mb_users
    SET active_tab_id = ${tabId}, active_tab_seen_at = NOW()
    WHERE id = ${userId}
  `;
  return { ownerTabId: tabId, ownerSeenAt: Date.now(), isYou: true };
}

// Best-effort release on tab close — called via sendBeacon during unload so
// the next tab can take the slot immediately instead of waiting for the
// 30s TTL to expire.
export async function releaseActiveTab(userId: string, tabId: string): Promise<void> {
  await ensureActiveTabColumns();
  await sql`
    UPDATE mb_users
    SET active_tab_id = NULL, active_tab_seen_at = NULL
    WHERE id = ${userId} AND active_tab_id = ${tabId}
  `;
}

// --- Per-user MCP connectors ---
//
// Users can plug their own MCP servers into ADletic's Claude calls — e.g.
// Higgsfield's hosted MCP at https://mcp.higgsfield.ai/mcp. Each entry is
// passed straight through to `messages.stream({ mcp_servers: [...] })`
// when it's `enabled`.
//
// Stored as a JSON array on mb_users.mcp_connectors_json. Same lazy-
// migration pattern as ai_instruction. Capped at 16 entries per user so
// a corrupt save can't blow up the request payload.

export interface McpConnector {
  id: string;                       // stable React/UI id (uuid-ish)
  name: string;                     // friendly label for the user
  url: string;                      // MCP server URL (must be https://)
  authorizationToken?: string;      // optional bearer the agent forwards
  enabled: boolean;                 // disabled connectors are skipped at request time
}

const MAX_CONNECTORS_PER_USER = 16;

let mcpConnectorsColumnInitialized = false;
async function ensureMcpConnectorsColumn(): Promise<void> {
  if (mcpConnectorsColumnInitialized) return;
  await sql`ALTER TABLE mb_users ADD COLUMN IF NOT EXISTS mcp_connectors_json TEXT`;
  mcpConnectorsColumnInitialized = true;
}

function parseConnectorsBlob(raw: string | null | undefined): McpConnector[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((c, i): McpConnector | null => {
        if (!c || typeof c !== "object") return null;
        const url = String(c.url || "").trim();
        const name = String(c.name || "").trim();
        if (!url || !name) return null;
        return {
          id: String(c.id || `mcp_${Date.now()}_${i}`),
          name,
          url,
          authorizationToken: c.authorizationToken ? String(c.authorizationToken) : undefined,
          enabled: c.enabled !== false, // default true if missing
        };
      })
      .filter((c): c is McpConnector => c !== null)
      .slice(0, MAX_CONNECTORS_PER_USER);
  } catch {
    return [];
  }
}

export async function getUserMcpConnectors(userId: string): Promise<McpConnector[]> {
  await ensureMcpConnectorsColumn();
  const rows = await sql`SELECT mcp_connectors_json FROM mb_users WHERE id = ${userId}`;
  if (rows.length === 0) return [];
  return parseConnectorsBlob(rows[0].mcp_connectors_json as string | null);
}

export async function setUserMcpConnectors(userId: string, connectors: McpConnector[]): Promise<void> {
  await ensureMcpConnectorsColumn();
  // Validate + sanitise on the way in. Reject http:// (must be https) so a
  // user pasting a local dev URL can't silently leak prompts to clear-text.
  const cleaned: McpConnector[] = [];
  for (const raw of connectors.slice(0, MAX_CONNECTORS_PER_USER)) {
    const url = String(raw.url || "").trim();
    const name = String(raw.name || "").trim();
    if (!url || !name) continue;
    if (!/^https:\/\//i.test(url)) continue;
    cleaned.push({
      id: String(raw.id || `mcp_${Date.now()}_${cleaned.length}`),
      name: name.slice(0, 64),
      url: url.slice(0, 512),
      authorizationToken: raw.authorizationToken ? String(raw.authorizationToken).slice(0, 4096) : undefined,
      enabled: raw.enabled !== false,
    });
  }
  const payload = JSON.stringify(cleaned);
  await sql`UPDATE mb_users SET mcp_connectors_json = ${payload} WHERE id = ${userId}`;
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

// ────────────────────────────────────────────────────────────────────────
// My Assets — a REQUEST QUEUE for ByteDance real-human characters. The
// biometric face verification is account-bound and UI-only by design (portrait
// rights), and every Seedance call goes through ONE shared company Ark key, so
// the verified asset must live under that company account. Rather than expect
// each user to have a BytePlus login, users submit a request with reference
// photos; an operator (see isAdmin) does the verification on the company
// account, pastes back the resulting `asset_id`, and marks it ready. Only then
// can the requesting user reference it as `asset://<id>` in generations.
// ────────────────────────────────────────────────────────────────────────
export type AssetStatus = "pending" | "completed" | "failed";

export interface MbAsset {
  id: string;
  userId: string;
  name: string;
  status: AssetStatus;
  assetId: string | null;       // filled by the operator on completion
  assetType: string;
  thumbFileId: string | null;
  refPhotoIds: string[];        // user-uploaded reference photos for verification
  note: string;                 // requester's note to the operator
  adminNote: string;            // operator's note / failure reason
  description: string;
  createdAt: string;
  // Only present on the admin queue (joined from mb_users):
  requesterEmail?: string;
  requesterName?: string;
}

let assetsTableInitialized = false;

async function ensureAssetsTable(): Promise<void> {
  if (assetsTableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Untitled',
      status TEXT NOT NULL DEFAULT 'pending',
      asset_id TEXT,
      asset_type TEXT NOT NULL DEFAULT 'real-human',
      thumb_file_id TEXT,
      ref_photo_ids TEXT DEFAULT '[]',
      note TEXT DEFAULT '',
      admin_note TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // Idempotent upgrades for tables created by an earlier revision of this file.
  await sql`ALTER TABLE mb_assets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`;
  await sql`ALTER TABLE mb_assets ADD COLUMN IF NOT EXISTS ref_photo_ids TEXT DEFAULT '[]'`;
  await sql`ALTER TABLE mb_assets ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''`;
  await sql`ALTER TABLE mb_assets ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT ''`;
  await sql`ALTER TABLE mb_assets ALTER COLUMN asset_id DROP NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS mb_assets_user_idx ON mb_assets (user_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS mb_assets_status_idx ON mb_assets (status, created_at DESC)`;
  assetsTableInitialized = true;
}

function parsePhotoIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

function rowToAsset(row: Record<string, unknown>): MbAsset {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    status: ((row.status as string) || "pending") as AssetStatus,
    assetId: (row.asset_id as string) || null,
    assetType: (row.asset_type as string) || "real-human",
    thumbFileId: (row.thumb_file_id as string) || null,
    refPhotoIds: parsePhotoIds(row.ref_photo_ids),
    note: (row.note as string) || "",
    adminNote: (row.admin_note as string) || "",
    description: (row.description as string) || "",
    createdAt: (row.created_at as Date).toISOString(),
    ...(row.requester_email ? { requesterEmail: row.requester_email as string } : {}),
    ...(row.requester_name ? { requesterName: row.requester_name as string } : {}),
  };
}

// A user's own requests, all statuses.
export async function listAssets(userId: string): Promise<MbAsset[]> {
  await ensureAssetsTable();
  const rows = await sql`
    SELECT * FROM mb_assets
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToAsset);
}

// Operator queue: every request across all users, pending first.
export async function listAllAssetRequests(): Promise<MbAsset[]> {
  await ensureAssetsTable();
  const rows = await sql`
    SELECT a.*, u.email AS requester_email, u.name AS requester_name
    FROM mb_assets a
    LEFT JOIN mb_users u ON u.id = a.user_id
    ORDER BY (a.status = 'pending') DESC, a.created_at DESC
  `;
  return rows.map(rowToAsset);
}

export async function createAssetRequest(
  userId: string,
  opts: { name: string; refPhotoIds?: string[]; note?: string; thumbFileId?: string | null; assetType?: string; description?: string }
): Promise<MbAsset> {
  await ensureAssetsTable();
  const id = `as_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const safeName = (opts.name || "Untitled").toString().slice(0, 80);
  const safeType = (opts.assetType || "real-human").toString().slice(0, 40);
  const safeNote = (opts.note || "").toString().slice(0, 1000);
  const safeDesc = (opts.description || "").toString().slice(0, 500);
  const photos = JSON.stringify((opts.refPhotoIds || []).slice(0, 12));
  const thumb = opts.thumbFileId || (opts.refPhotoIds && opts.refPhotoIds[0]) || null;
  const rows = await sql`
    INSERT INTO mb_assets (id, user_id, name, status, asset_type, thumb_file_id, ref_photo_ids, note, description)
    VALUES (${id}, ${userId}, ${safeName}, 'pending', ${safeType}, ${thumb}, ${photos}, ${safeNote}, ${safeDesc})
    RETURNING *
  `;
  return rowToAsset(rows[0]);
}

// Requester can rename their own request; operator can rename any (admin=true).
export async function renameAsset(id: string, userId: string, name: string, isAdminUser = false): Promise<boolean> {
  await ensureAssetsTable();
  const safeName = (name || "Untitled").toString().slice(0, 80);
  const rows = isAdminUser
    ? await sql`UPDATE mb_assets SET name = ${safeName} WHERE id = ${id} RETURNING id`
    : await sql`UPDATE mb_assets SET name = ${safeName} WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  return rows.length > 0;
}

// Operator-only: resolve a request. status 'completed' requires an assetId.
export async function updateAssetStatus(
  id: string,
  opts: { status: AssetStatus; assetId?: string | null; adminNote?: string }
): Promise<boolean> {
  await ensureAssetsTable();
  const safeAssetId = opts.status === "completed" ? (opts.assetId || "").toString().slice(0, 200) : (opts.assetId ?? null);
  const safeAdminNote = (opts.adminNote || "").toString().slice(0, 1000);
  const rows = await sql`
    UPDATE mb_assets
    SET status = ${opts.status}, asset_id = ${safeAssetId}, admin_note = ${safeAdminNote}
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function deleteAsset(id: string, userId: string, isAdminUser = false): Promise<boolean> {
  await ensureAssetsTable();
  const rows = isAdminUser
    ? await sql`DELETE FROM mb_assets WHERE id = ${id} RETURNING id`
    : await sql`DELETE FROM mb_assets WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
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

// ============================================================================
// API keys
//
// Lets non-browser clients (MCP servers, scripts, automations) authenticate
// against MotionBoards using a bearer token instead of the session cookie.
//
// Storage:
//   mb_api_keys (id, user_id, name, prefix, key_hash, created_at, last_used_at, revoked_at)
//
// Token format: `mb_<32 random hex>`. The full token is shown to the user
// exactly once at creation. We store only the sha256 hash + a short prefix
// for display. Revocation is soft (set revoked_at) so the audit trail stays.
// ============================================================================

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  prefix: string;          // safe to display, e.g. "mb_a1b2c3d4…"
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const MAX_API_KEYS_PER_USER = 16;

let apiKeysTableInitialized = false;
async function ensureApiKeysTable(): Promise<void> {
  if (apiKeysTableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mb_api_keys_user_idx ON mb_api_keys(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS mb_api_keys_hash_idx ON mb_api_keys(key_hash) WHERE revoked_at IS NULL`;
  apiKeysTableInitialized = true;
}

function rowToApiKey(row: SqlRow): ApiKey {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    prefix: row.prefix as string,
    createdAt: (row.created_at as Date).toISOString(),
    lastUsedAt: row.last_used_at ? (row.last_used_at as Date).toISOString() : null,
    revokedAt: row.revoked_at ? (row.revoked_at as Date).toISOString() : null,
  };
}

function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Create a new API key. Returns the full plaintext token ONCE — caller must
 * surface it to the user immediately and never store it.
 */
export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ apiKey: ApiKey; fullKey: string } | { error: string }> {
  await ensureApiKeysTable();

  const trimmedName = name.trim().slice(0, 64) || "Unnamed key";

  const existing = await sql`
    SELECT COUNT(*)::int AS n FROM mb_api_keys
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
  if ((existing[0]?.n as number) >= MAX_API_KEYS_PER_USER) {
    return { error: `Limit of ${MAX_API_KEYS_PER_USER} active keys per account reached. Revoke an old key first.` };
  }

  const random = randomBytes(16).toString("hex");
  const fullKey = `mb_${random}`;
  const prefix = `${fullKey.slice(0, 9)}…`;
  const keyHash = hashApiKey(fullKey);

  const id = `apikey_${Date.now()}_${randomBytes(4).toString("hex")}`;

  const rows = await sql`
    INSERT INTO mb_api_keys (id, user_id, name, prefix, key_hash)
    VALUES (${id}, ${userId}, ${trimmedName}, ${prefix}, ${keyHash})
    RETURNING *
  `;

  return { apiKey: rowToApiKey(rows[0]), fullKey };
}

/**
 * Resolve an API key to a User. Bumps last_used_at so the user can see when
 * each key was last active. Returns undefined if the key is unknown, revoked,
 * or the user is gone.
 */
export async function getUserFromApiKey(rawKey: string): Promise<User | undefined> {
  if (!rawKey || !rawKey.startsWith("mb_")) return undefined;
  await ensureApiKeysTable();

  const keyHash = hashApiKey(rawKey);
  const rows = await sql`
    SELECT user_id FROM mb_api_keys
    WHERE key_hash = ${keyHash} AND revoked_at IS NULL
    LIMIT 1
  `;
  if (rows.length === 0) return undefined;

  const userId = rows[0].user_id as string;

  // Fire-and-forget last_used_at bump
  sql`UPDATE mb_api_keys SET last_used_at = NOW() WHERE key_hash = ${keyHash}`.catch(() => {});

  return getUserById(userId);
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  await ensureApiKeysTable();
  const rows = await sql`
    SELECT * FROM mb_api_keys
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToApiKey);
}

export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  await ensureApiKeysTable();
  const rows = await sql`
    UPDATE mb_api_keys
    SET revoked_at = NOW()
    WHERE id = ${keyId} AND user_id = ${userId} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

// --- FatHopes media gallery (the /fathopes page) ---
//
// A flat, shared library (not per-user) — anyone signed in can add or remove.
// `src` and `thumb` are R2 key paths beginning with "/fathopes/..."; the page
// prefixes them with NEXT_PUBLIC_FATHOPES_BASE to build the public URL.

export interface FathopesItem {
  id: string;
  src: string;
  thumb: string;
  ratio: number;
  category: string;
  catSlug: string;
  type: "image" | "video";
  name: string;
  createdAt: string;
}

let fathopesTableInitialized = false;

async function ensureFathopesTable(): Promise<void> {
  if (fathopesTableInitialized) return;
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
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mb_fathopes_src_idx ON mb_fathopes_media (src)`;
  await sql`CREATE INDEX IF NOT EXISTS mb_fathopes_cat_idx ON mb_fathopes_media (cat_slug)`;
  fathopesTableInitialized = true;
}

export function fathopesSlug(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "uncategorised"
  );
}

function rowToFathopes(row: Record<string, unknown>): FathopesItem {
  return {
    id: row.id as string,
    src: row.src as string,
    thumb: row.thumb as string,
    ratio: Number(row.ratio) || 1,
    category: row.category as string,
    catSlug: row.cat_slug as string,
    type: (row.type as "image" | "video") || "image",
    name: (row.name as string) || "",
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function listFathopesMedia(): Promise<FathopesItem[]> {
  await ensureFathopesTable();
  const rows = await sql`
    SELECT * FROM mb_fathopes_media
    ORDER BY cat_slug ASC, created_at ASC, name ASC
  `;
  return rows.map(rowToFathopes);
}

export async function createFathopesMedia(input: {
  src: string;
  thumb: string;
  ratio: number;
  category: string;
  type: "image" | "video";
  name: string;
}): Promise<FathopesItem> {
  await ensureFathopesTable();
  const id = `fh_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const category = (input.category || "Uncategorised").toString().slice(0, 80);
  const catSlug = fathopesSlug(category);
  const ratio = Number.isFinite(input.ratio) && input.ratio > 0 ? input.ratio : 1;
  const rows = await sql`
    INSERT INTO mb_fathopes_media (id, src, thumb, ratio, category, cat_slug, type, name)
    VALUES (${id}, ${input.src}, ${input.thumb}, ${ratio}, ${category}, ${catSlug}, ${input.type}, ${input.name.slice(0, 200)})
    ON CONFLICT (src) DO UPDATE SET thumb = EXCLUDED.thumb, ratio = EXCLUDED.ratio, category = EXCLUDED.category, cat_slug = EXCLUDED.cat_slug
    RETURNING *
  `;
  return rowToFathopes(rows[0]);
}

// Returns the deleted row's R2 keys so the caller can purge the objects.
export async function deleteFathopesMedia(id: string): Promise<{ src: string; thumb: string } | null> {
  await ensureFathopesTable();
  const rows = await sql`
    DELETE FROM mb_fathopes_media WHERE id = ${id}
    RETURNING src, thumb
  `;
  if (!rows.length) return null;
  return { src: rows[0].src as string, thumb: rows[0].thumb as string };
}

// --- FatHopes agent conversations ---
//
// Per-user chat threads for the gallery's floating agent. The whole UI state
// (messages + generation results) is stored as one JSONB blob so a thread
// restores exactly, including inline generation cards.

export interface FathopesChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

let fathopesChatsTableInitialized = false;

async function ensureFathopesChatsTable(): Promise<void> {
  if (fathopesChatsTableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS mb_fathopes_chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'New chat',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mb_fathopes_chats_user_idx ON mb_fathopes_chats (user_id, updated_at DESC)`;
  fathopesChatsTableInitialized = true;
}

export async function listFathopesChats(userId: string): Promise<FathopesChatSummary[]> {
  await ensureFathopesChatsTable();
  const rows = await sql`
    SELECT id, title, updated_at FROM mb_fathopes_chats
    WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 100
  `;
  return rows.map((r) => ({ id: r.id as string, title: r.title as string, updatedAt: (r.updated_at as Date).toISOString() }));
}

export async function getFathopesChat(id: string, userId: string): Promise<{ id: string; title: string; data: unknown } | null> {
  await ensureFathopesChatsTable();
  const rows = await sql`SELECT id, title, data FROM mb_fathopes_chats WHERE id = ${id} AND user_id = ${userId}`;
  if (!rows.length) return null;
  const raw = rows[0].data;
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  return { id: rows[0].id as string, title: rows[0].title as string, data };
}

export async function upsertFathopesChat(
  userId: string,
  input: { id?: string; title: string; data: unknown },
): Promise<FathopesChatSummary> {
  await ensureFathopesChatsTable();
  const title = (input.title || "New chat").toString().slice(0, 120);
  const json = JSON.stringify(input.data ?? {});
  if (input.id) {
    const rows = await sql`
      UPDATE mb_fathopes_chats SET title = ${title}, data = ${json}::jsonb, updated_at = NOW()
      WHERE id = ${input.id} AND user_id = ${userId}
      RETURNING id, title, updated_at
    `;
    if (rows.length) return { id: rows[0].id as string, title: rows[0].title as string, updatedAt: (rows[0].updated_at as Date).toISOString() };
  }
  const id = input.id || `fhc_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const rows = await sql`
    INSERT INTO mb_fathopes_chats (id, user_id, title, data)
    VALUES (${id}, ${userId}, ${title}, ${json}::jsonb)
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, data = EXCLUDED.data, updated_at = NOW()
    RETURNING id, title, updated_at
  `;
  return { id: rows[0].id as string, title: rows[0].title as string, updatedAt: (rows[0].updated_at as Date).toISOString() };
}

export async function deleteFathopesChat(id: string, userId: string): Promise<boolean> {
  await ensureFathopesChatsTable();
  const rows = await sql`DELETE FROM mb_fathopes_chats WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  return rows.length > 0;
}
