// Sparron — FatHopes Energy's AI social media manager.
//
// She watches the FatHopes Facebook Page + Instagram and keeps the
// conversation going across FOUR surfaces:
//   - Instagram comments
//   - Instagram DMs
//   - Facebook Page comments
//   - Facebook Messenger
//
// Design goals, mirrored on the Threads auto-poster (src/lib/threads.ts) so
// there's exactly one code path to trust and both the cron route
// (/api/sparron) and any local script can share it:
//
//   1. THREAD-AWARE. She looks at the LAST message in each thread. If the last
//      message is from someone other than us, it needs a reply — so a reply to
//      a reply re-triggers her, and she stays quiet once she's had the last
//      word. This is why she continues conversations instead of answering once.
//
//   2. HYBRID AUTONOMY (the mode the owner chose). Straightforward messages
//      (banter, where/when, how it works, how to join) are answered
//      automatically in her voice. Anything sensitive — complaints, payment
//      disputes, press, business proposals, unclear, anything needing a number
//      or exact address we can't verify — is held as a DRAFT for human
//      approval instead of sent. Tunable via SPARRON_AUTONOMY.
//
//   3. LOOP GUARD. She'll carry a thread up to SPARRON_REPLY_CAP (default 3)
//      of her own replies, then stop and hand the thread to a human. Prevents
//      an infinite public back-and-forth with a chatty commenter or a troll.
//
//   4. STATELESS-SAFE DEDUPE. Every reply she sends is logged (mb_sparron_log).
//      Before replying she checks she hasn't already answered that exact
//      message id, so a double cron tick can't double-post.
//
// This uses the SAME Facebook/IG token as the rest of the Meta work
// (META_APP_TOKEN, a long-lived USER token). The page access token is derived
// from it per run and never persisted.

import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";

const GRAPH = "https://graph.facebook.com/v23.0";

// The FatHopes Energy Facebook Page. IG business account is derived from it.
const PAGE_ID = process.env.FATHOPES_PAGE_ID || "102967319775538";

// Reply/triage model. Sonnet is the sweet spot for short, voice-heavy replies —
// matches what the Threads poster uses. Override with SPARRON_MODEL.
const MODEL = process.env.SPARRON_MODEL || "claude-sonnet-4-6";

// How many of her own replies she'll add to one thread before handing off,
// counted within a rolling window (below). A lifetime cap would wrongly muzzle
// a genuine long-running DM at message #4; a windowed cap still trips on a
// rapid loop / troll in one sitting but resets for real ongoing relationships.
const REPLY_CAP = Number(process.env.SPARRON_REPLY_CAP || 3);
const CAP_WINDOW_HOURS = Number(process.env.SPARRON_CAP_WINDOW_HOURS || 24);

// "hybrid" (default) — auto-send simple, hold sensitive as drafts.
// "draft"  — hold EVERYTHING as a draft (nothing auto-sends).
// "auto"   — send everything (still respects the loop cap).
type Autonomy = "hybrid" | "draft" | "auto";
const AUTONOMY = (process.env.SPARRON_AUTONOMY || "hybrid") as Autonomy;

// Don't necro-reply the whole back-catalogue on first deploy: only consider
// inbound messages newer than this. Follow-ups are recent by definition.
const MAX_AGE_HOURS = Number(process.env.SPARRON_MAX_AGE_HOURS || 72);

// How many recent media / posts to scan for comments each run.
const SCAN = Number(process.env.SPARRON_MEDIA_SCAN || 10);

// Instagram DMs only: when on (default), Sparron replies ONLY to brand-new
// conversations — first contact from someone we've never messaged. Any IG DM
// thread we've ever replied in (an "existing person") is left alone. This does
// NOT affect FB Messenger, IG comments, or FB comments. Flip to "0" to restore
// full continue-the-conversation behavior on IG DMs.
const IG_DM_NEW_ONLY = (process.env.SPARRON_IG_DM_NEW_ONLY ?? "1") !== "0";

// ---------------------------------------------------------------------------
// DB — Neon serverless, same tagged-template pattern as src/lib/db.ts.
// ---------------------------------------------------------------------------

type SqlRow = Record<string, unknown>;
const sql = (strings: TemplateStringsArray, ...values: unknown[]) =>
  neon(process.env.DATABASE_URL!)(strings, ...values) as Promise<SqlRow[]>;

let tablesReady = false;
async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  // Every reply Sparron sends. Backs both dedupe (item_id) and the loop
  // guard (count per thread_key).
  await sql`
    CREATE TABLE IF NOT EXISTS mb_sparron_log (
      id BIGSERIAL PRIMARY KEY,
      surface TEXT NOT NULL,
      thread_key TEXT NOT NULL,
      item_id TEXT NOT NULL,
      reply_text TEXT NOT NULL,
      mode TEXT NOT NULL,
      reply_ref TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sparron_log_item ON mb_sparron_log(item_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sparron_log_thread ON mb_sparron_log(thread_key)`;
  // Held drafts awaiting human approval (hybrid/draft mode).
  await sql`
    CREATE TABLE IF NOT EXISTS mb_sparron_drafts (
      id TEXT PRIMARY KEY,
      surface TEXT NOT NULL,
      thread_key TEXT NOT NULL,
      item_id TEXT NOT NULL,
      author_name TEXT,
      incoming_text TEXT,
      draft_text TEXT NOT NULL,
      target JSONB NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sparron_drafts_item ON mb_sparron_drafts(item_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sparron_drafts_status ON mb_sparron_drafts(status)`;
  tablesReady = true;
}

// Have we already replied to this exact message/comment id?
async function alreadyHandled(itemId: string): Promise<boolean> {
  const logged = await sql`SELECT 1 FROM mb_sparron_log WHERE item_id = ${itemId} LIMIT 1`;
  if (logged.length > 0) return true;
  // A pending/sent draft for the same item also counts as handled — don't
  // queue the same message twice.
  const drafted = await sql`
    SELECT 1 FROM mb_sparron_drafts
    WHERE item_id = ${itemId} AND status IN ('pending','approved','sent') LIMIT 1
  `;
  return drafted.length > 0;
}

// Sparron replies in this thread within the rolling cap window.
async function threadReplyCount(threadKey: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM mb_sparron_log
    WHERE thread_key = ${threadKey}
      AND created_at > NOW() - (${CAP_WINDOW_HOURS}::int * INTERVAL '1 hour')
  `;
  return (rows[0]?.n as number) || 0;
}

async function recordReply(
  c: Candidate,
  text: string,
  mode: "auto" | "approved",
  replyRef: string | null,
): Promise<void> {
  await sql`
    INSERT INTO mb_sparron_log (surface, thread_key, item_id, reply_text, mode, reply_ref)
    VALUES (${c.surface}, ${c.threadKey}, ${c.itemId}, ${text}, ${mode}, ${replyRef})
  `;
}

async function saveDraft(c: Candidate, text: string, reason: string): Promise<void> {
  const id = `spd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO mb_sparron_drafts
      (id, surface, thread_key, item_id, author_name, incoming_text, draft_text, target, reason, status)
    VALUES (${id}, ${c.surface}, ${c.threadKey}, ${c.itemId}, ${c.authorName || null},
            ${c.incomingText}, ${text}, ${JSON.stringify(c.target)}, ${reason}, 'pending')
  `;
}

export interface SparronDraft {
  id: string;
  surface: Surface;
  threadKey: string;
  itemId: string;
  authorName: string | null;
  incomingText: string | null;
  draftText: string;
  target: ReplyTarget;
  reason: string | null;
  status: string;
  createdAt: string;
}

function rowToDraft(r: SqlRow): SparronDraft {
  const target = typeof r.target === "string" ? JSON.parse(r.target as string) : r.target;
  return {
    id: r.id as string,
    surface: r.surface as Surface,
    threadKey: r.thread_key as string,
    itemId: r.item_id as string,
    authorName: (r.author_name as string | null) ?? null,
    incomingText: (r.incoming_text as string | null) ?? null,
    draftText: r.draft_text as string,
    target: target as ReplyTarget,
    reason: (r.reason as string | null) ?? null,
    status: r.status as string,
    createdAt: (r.created_at as Date).toISOString(),
  };
}

export async function listPendingDrafts(limit = 50): Promise<SparronDraft[]> {
  await ensureTables();
  const rows = await sql`
    SELECT * FROM mb_sparron_drafts WHERE status = 'pending'
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map(rowToDraft);
}

// ---------------------------------------------------------------------------
// Graph API plumbing.
// ---------------------------------------------------------------------------

interface GraphError {
  message?: string;
  code?: number;
  error_subcode?: number;
}

async function graphGet<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string>,
  token: string,
): Promise<T & { error?: GraphError }> {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}/${path}?${qs.toString()}`);
  return (await res.json()) as T & { error?: GraphError };
}

async function graphPost(
  path: string,
  body: Record<string, string>,
  token: string,
): Promise<{ id?: string; error?: GraphError }> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, access_token: token }),
  });
  return (await res.json()) as { id?: string; error?: GraphError };
}

export interface PageContext {
  pageId: string;
  pageToken: string;
  igId: string;
  igUser: string;
}

// Derive the page access token + IG identity from the long-lived user token.
// Kept in memory for the run only — never written to disk.
export async function getPageContext(): Promise<PageContext> {
  const userToken = process.env.META_APP_TOKEN;
  if (!userToken) throw new Error("META_APP_TOKEN not configured");
  const pg = await graphGet<{
    access_token?: string;
    instagram_business_account?: { id: string; username: string };
  }>(PAGE_ID, { fields: "access_token,instagram_business_account{id,username}" }, userToken);
  if (pg.error || !pg.access_token) {
    throw new Error(`Could not read page token: ${pg.error?.message || "no access_token"}`);
  }
  const ig = pg.instagram_business_account;
  if (!ig?.id) throw new Error("FatHopes page has no linked Instagram business account");
  return { pageId: PAGE_ID, pageToken: pg.access_token, igId: ig.id, igUser: ig.username };
}

// ---------------------------------------------------------------------------
// Candidate collection — one "unit of work" per thread whose last inbound
// message is from someone other than us.
// ---------------------------------------------------------------------------

export type Surface = "ig_comment" | "fb_comment" | "ig_dm" | "fb_dm";

export type ReplyTarget =
  | { kind: "ig_comment"; replyTo: string }
  | { kind: "fb_comment"; replyTo: string }
  | { kind: "dm"; psid: string };

export interface Candidate {
  surface: Surface;
  threadKey: string; // stable id for the whole thread (loop guard scope)
  itemId: string; // the exact latest inbound message we're answering (dedupe)
  incomingText: string;
  authorName: string | null;
  history: string[]; // short "who: what" transcript, oldest first
  target: ReplyTarget;
  tsMs: number; // timestamp of the latest inbound message
}

// Meta stamps look like "2026-07-03T12:50:26+0000" — normalise the zero offset
// so older Node Date parsers don't choke.
function parseTs(ts?: string): number {
  if (!ts) return 0;
  const norm = ts.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const ms = Date.parse(norm);
  return Number.isNaN(ms) ? 0 : ms;
}

function freshEnough(tsMs: number): boolean {
  if (!tsMs) return false;
  return Date.now() - tsMs <= MAX_AGE_HOURS * 3600_000;
}

// --- Instagram comments -----------------------------------------------------
async function collectIgComments(ctx: PageContext): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const media = await graphGet<{ data?: Array<{ id: string; caption?: string; comments_count?: number }> }>(
    `${ctx.igId}/media`,
    { fields: "id,caption,comments_count", limit: String(SCAN) },
    ctx.pageToken,
  );
  for (const m of media.data || []) {
    if (!m.comments_count) continue;
    const cm = await graphGet<{
      data?: Array<{
        id: string;
        text?: string;
        username?: string;
        timestamp?: string;
        replies?: { data?: Array<{ id: string; username?: string; text?: string; timestamp?: string }> };
      }>;
    }>(
      `${m.id}/comments`,
      { fields: "id,text,username,timestamp,replies{id,username,text,timestamp}", limit: "50" },
      ctx.pageToken,
    );
    for (const c of cm.data || []) {
      const replies = c.replies?.data || [];
      // The last node in the thread, by time: top comment or its newest reply.
      const nodes = [
        { id: c.id, username: c.username, text: c.text || "", ts: parseTs(c.timestamp) },
        ...replies.map((r) => ({ id: r.id, username: r.username, text: r.text || "", ts: parseTs(r.timestamp) })),
      ].sort((a, b) => a.ts - b.ts);
      const last = nodes[nodes.length - 1];
      if (!last || last.username === ctx.igUser) continue; // we had the last word
      if (!freshEnough(last.ts)) continue;
      out.push({
        surface: "ig_comment",
        threadKey: c.id, // top-level comment id
        itemId: last.id,
        incomingText: last.text,
        authorName: last.username || null,
        history: nodes.map((n) => `${n.username === ctx.igUser ? "FatHopes" : n.username || "user"}: ${n.text}`),
        target: { kind: "ig_comment", replyTo: c.id },
        tsMs: last.ts,
      });
    }
  }
  return out;
}

// --- Facebook Page comments -------------------------------------------------
async function collectFbComments(ctx: PageContext): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const posts = await graphGet<{
    data?: Array<{
      id: string;
      comments?: {
        data?: Array<{
          id: string;
          message?: string;
          created_time?: string;
          from?: { id?: string; name?: string };
          comments?: { data?: Array<{ id: string; message?: string; created_time?: string; from?: { id?: string; name?: string } }> };
        }>;
      };
    }>;
  }>(
    `${ctx.pageId}/posts`,
    {
      fields:
        "id,comments{id,message,created_time,from,comments{id,message,created_time,from}}",
      limit: String(SCAN),
    },
    ctx.pageToken,
  );
  for (const p of posts.data || []) {
    for (const c of p.comments?.data || []) {
      const subs = c.comments?.data || [];
      const nodes = [
        { id: c.id, fromId: c.from?.id, name: c.from?.name, text: c.message || "", ts: parseTs(c.created_time) },
        ...subs.map((s) => ({
          id: s.id,
          fromId: s.from?.id,
          name: s.from?.name,
          text: s.message || "",
          ts: parseTs(s.created_time),
        })),
      ].sort((a, b) => a.ts - b.ts);
      const last = nodes[nodes.length - 1];
      if (!last || last.fromId === ctx.pageId) continue;
      if (!last.text.trim()) continue; // sticker/photo-only — nothing to answer
      if (!freshEnough(last.ts)) continue;
      out.push({
        surface: "fb_comment",
        threadKey: c.id,
        itemId: last.id,
        incomingText: last.text,
        authorName: last.name || null,
        history: nodes.map((n) => `${n.fromId === ctx.pageId ? "FatHopes" : n.name || "user"}: ${n.text}`),
        target: { kind: "fb_comment", replyTo: c.id },
        tsMs: last.ts,
      });
    }
  }
  return out;
}

// --- Direct messages (shared for IG + Messenger) ----------------------------
async function collectDms(ctx: PageContext, platform: "instagram" | "messenger"): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const selfId = platform === "instagram" ? ctx.igId : ctx.pageId;
  const surface: Surface = platform === "instagram" ? "ig_dm" : "fb_dm";
  // On IG DMs we optionally reply to NEW conversations only (see IG_DM_NEW_ONLY).
  // To detect "existing" threads reliably we need message_count (to know when
  // our reply scrolled out of the fetch window) and a wider message window to
  // scan for any prior reply of ours.
  const igNewOnly = platform === "instagram" && IG_DM_NEW_ONLY;
  const msgLimit = igNewOnly ? "25" : "8";
  // The IG conversations edge is heavy and sometimes rate-errors; ask for the
  // minimum and fetch messages per-conversation. Best-effort — bail quietly.
  const conv = await graphGet<{ data?: Array<{ id: string; message_count?: number }>; error?: GraphError }>(
    `${ctx.pageId}/conversations`,
    { platform, fields: igNewOnly ? "id,message_count" : "id", limit: "20" },
    ctx.pageToken,
  );
  if (conv.error || !conv.data) return out;
  for (const cv of conv.data) {
    const mm = await graphGet<{
      data?: Array<{ id: string; message?: string; created_time?: string; from?: { id?: string; name?: string; username?: string } }>;
    }>(`${cv.id}/messages`, { fields: "id,message,from,created_time", limit: msgLimit }, ctx.pageToken);
    const msgs = mm.data || [];
    if (!msgs.length) continue;
    const last = msgs[0]; // newest first
    const fromId = last.from?.id;
    if (!fromId || fromId === selfId) continue; // we replied last
    const tsMs = parseTs(last.created_time);
    if (!freshEnough(tsMs)) continue;
    // IG-DM new-only gate: skip anyone we've ever engaged. "Existing" =
    // we've replied somewhere in the visible window, OR the thread has more
    // messages than we fetched (older history exists that we can't see, so a
    // brand-new first-contact it is not).
    if (igNewOnly) {
      const weEverReplied = msgs.some((m) => m.from?.id === selfId);
      const olderBeyondWindow = typeof cv.message_count === "number" && cv.message_count > msgs.length;
      if (weEverReplied || olderBeyondWindow) continue;
    }
    // PSID = the participant's id (from the newest inbound message).
    const history = [...msgs]
      .reverse()
      .map((m) => `${m.from?.id === selfId ? "FatHopes" : m.from?.name || m.from?.username || "user"}: ${m.message || ""}`);
    out.push({
      surface,
      threadKey: cv.id,
      itemId: last.id,
      incomingText: last.message || "",
      authorName: last.from?.name || last.from?.username || null,
      history,
      target: { kind: "dm", psid: fromId },
      tsMs,
    });
  }
  return out;
}

// Gather everything needing attention, newest first. Each surface is guarded
// so one flaky edge (IG DMs, notoriously) can't sink the whole run.
export async function collectCandidates(ctx: PageContext): Promise<Candidate[]> {
  const results = await Promise.allSettled([
    collectIgComments(ctx),
    collectFbComments(ctx),
    collectDms(ctx, "instagram"),
    collectDms(ctx, "messenger"),
  ]);
  const all: Candidate[] = [];
  for (const r of results) if (r.status === "fulfilled") all.push(...r.value);
  return all.sort((a, b) => b.tsMs - a.tsMs);
}

// ---------------------------------------------------------------------------
// Sparron's brain — voice, facts, triage + reply generation.
// ---------------------------------------------------------------------------

// The persona. FatHopes = "kita"; the customer = "cik". Short, straightforward
// KL Manglish in the FatHopes Threads voice, little-to-sometimes emoji.
const VOICE = `You are Sparron, the social media manager for FatHopes Energy, replying to a comment or DM as the FatHopes brand account. Reply in ONE short message.

HARD RULES (address form):
- Refer to FatHopes as "kita" (never "kami", never "saya", never "we/our").
- Address the customer as "cik" (never "anda", never "awak").

VOICE (KL Manglish, FatHopes Threads energy — concise, straightforward, real):
- Manglish: Malay-dominant KL rojak that code-switches into English naturally. NOT formal BM, NOT full English.
- SHORT and to the point. One clear helpful answer, usually 1–2 short lines, under ~200 chars. No fluff, no corporate intro like "Terima kasih kerana menghubungi kami".
- Mostly lowercase. Little to SOMETIMES an emoji (0–1, not every reply, never a string of them).
- Malay shorthand is fine: je, sbb, dgn, tgk, byk, mcm, tp, lg, korg, ye, ni. Do NOT use a bare "x" for "tak" — write "tak".
- Never end the whole message on a bare full stop (end on the last word, a "?" or a "!"). A trailing "..." is fine occasionally.
- NEVER use em-dashes or en-dashes — use commas or line breaks.
- Match the language the person used (Malay → Malay, English → English, mix → mix).
- Warm and helpful, not stiff. You represent the brand, so stay friendly and never combative, even if they are.

DON'T INVENT FACTS:
- Never state a specific buy-back price per kg or a specific ringgit amount — say it follows "kadar semasa" (current rate) shown when weighed / in the app.
- Never invent an exact address, phone number, or interview venue. For joining PUSH, tell them to share their name + phone + area and "team kita akan hubungi", or point to the link in bio.
- If you genuinely can't answer without info we don't have, keep it short and ask a clarifying question.`;

const FACTS = `ABOUT FATHOPES ENERGY (for grounding, do not dump all of this — use only what's relevant):
- FatHopes buys used cooking oil (minyak masak terpakai / UCO, the minyak hitam lepas menggoreng). Cik jual, kita beli. Payment + reward points via the FatHopes Loyalty App. Free to sign up.
- FatHopes recycles the UCO into Sustainable Aviation Fuel (SAF) — cleaner fuel for planes. Good angle when relevant.
- Recycling & Buy-Back Centre (RBBC): P1 Parking Lot, IPC Shopping Centre (sebelah IKEA, Mutiara Damansara). Open the 2nd & 4th week of every month, 11am–3pm. Bring UCO, timbang with the team, earn on the spot.
- Program PUSH: recruitment of drivers/agents who collect UCO with their own vehicle and get paid. A driving licence (incl. GDL) is welcome. It is NOT salaried employment and does NOT provide accommodation. To join: share name + phone + area, team follows up (or link in bio).
- FatHopes also runs community gotong-royong recycling events in various towns/states from time to time.
- Price is not fixed publicly — always "ikut kadar semasa".`;

const TRIAGE = `Decide how to handle this message, then write Sparron's reply.

Classify "action":
- "auto"  — safe to send automatically: greetings/banter, thanks, "how does it work", where/when/location of a centre or event, the price MECHANISM (kadar semasa, no number), how to join PUSH, simple product/recycling questions, general positive or curious messages.
- "hold"  — must be held for a human to approve: complaints or anger, payment problems or disputes ("belum dibayar", "tak bayar", "scam", "tipu", refunds), press/media/journalist enquiries, business/partnership/wholesale/bulk proposals, anything that needs a specific number, exact address, or a commitment we cannot verify, legal matters, spam, or anything genuinely ambiguous/unclear.

ALWAYS write your best reply in "reply" even when action is "hold" (a human will review/edit it). Keep the same voice and rules.

Respond with ONLY a JSON object, no prose, no code fence:
{"action":"auto"|"hold","reason":"<short why>","reply":"<the reply text>"}`;

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

export interface Triage {
  action: "auto" | "hold";
  reason: string;
  reply: string;
}

const SURFACE_LABEL: Record<Surface, string> = {
  ig_comment: "an Instagram comment",
  fb_comment: "a Facebook Page comment",
  ig_dm: "an Instagram DM",
  fb_dm: "a Facebook Messenger message",
};

export async function triageAndDraft(c: Candidate): Promise<Triage> {
  const system = [VOICE, FACTS, TRIAGE].join("\n\n");
  const convo = c.history.length
    ? `Conversation so far (oldest first):\n${c.history.map((h) => `- ${h}`).join("\n")}`
    : `Message: ${c.incomingText}`;
  const user = `This is ${SURFACE_LABEL[c.surface]} from "${c.authorName || "someone"}".\n\n${convo}\n\nThe latest message you must reply to is:\n"${c.incomingText}"\n\nClassify and write Sparron's reply now.`;

  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 400,
    temperature: 0.7,
    system,
    messages: [{ role: "user", content: user }],
  });
  const raw = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Pull the JSON object out even if the model wrapped it in a fence or prose.
  let parsed: Partial<Triage> = {};
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    /* fall through to guard below */
  }
  let reply = (parsed.reply || "").trim();
  reply = cleanVoice(reply);
  const action: "auto" | "hold" = parsed.action === "auto" ? "auto" : "hold"; // default to safe side
  if (!reply) {
    // Model gave us nothing usable — hold, don't guess.
    return { action: "hold", reason: "empty model reply", reply: "" };
  }
  return { action, reason: (parsed.reason || "").slice(0, 200), reply };
}

// Final voice guard, same spirit as the Threads poster: kill EVERY long dash,
// normalise smart quotes, fix bare "x", don't end on a bare full stop, so an
// auto-reply reads exactly like the owner types. (ES2017 target — no dotAll.)
export function cleanVoice(text: string): string {
  let t = text.replace(/^["'“]([\s\S]*)["'”]$/, "$1").trim();
  // Smart/curly quotes -> straight.
  t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  t = t
    // Any long dash (em —, en –, horizontal bar ―, figure
    // ‒, minus −) OR an ASCII double-hyphen used as a dash -> comma.
    // Single hyphens inside words (buy-back, e-full) are left untouched.
    .replace(/\s*(?:--+|[‒–—―−])\s*/g, ", ")
    .replace(/(^|\s)x(?=\s)/g, "$1tak")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/^,\s*/, "")
    .trim();
  if (t.endsWith(".") && !t.endsWith("..")) t = t.slice(0, -1).trimEnd();
  return t.slice(0, 900);
}

// ---------------------------------------------------------------------------
// Sending.
// ---------------------------------------------------------------------------

export interface SendResult {
  ok: boolean;
  ref?: string;
  error?: string;
}

export async function sendReply(ctx: PageContext, target: ReplyTarget, text: string): Promise<SendResult> {
  if (target.kind === "ig_comment" || target.kind === "fb_comment") {
    // IG replies live under /replies; FB comment replies under /comments.
    const edge = target.kind === "ig_comment" ? "replies" : "comments";
    const r = await graphPost(`${target.replyTo}/${edge}`, { message: text }, ctx.pageToken);
    if (r.error) return { ok: false, error: r.error.message };
    return { ok: true, ref: r.id };
  }
  // DM — standard reply works inside Meta's 24h window.
  const body = {
    recipient: JSON.stringify({ id: target.psid }),
    message: JSON.stringify({ text }),
    messaging_type: "RESPONSE",
  };
  const r = await graphPost(`${ctx.pageId}/messages`, body, ctx.pageToken);
  if (r.error) return { ok: false, error: `${r.error.code ? `#${r.error.code} ` : ""}${r.error.message}` };
  return { ok: true, ref: r.id };
}

// ---------------------------------------------------------------------------
// Orchestration.
// ---------------------------------------------------------------------------

export interface HandledItem {
  surface: Surface;
  author: string | null;
  incoming: string;
  outcome: "sent" | "drafted" | "capped" | "skipped" | "failed";
  reply?: string;
  reason?: string;
  error?: string;
}

export interface SparronRun {
  scanned: number;
  sent: number;
  drafted: number;
  capped: number;
  skipped: number;
  failed: number;
  items: HandledItem[];
}

/**
 * One full pass. `dry` triages + drafts but sends nothing (for previewing the
 * voice / triage decisions without touching the public account).
 */
export async function runSparron(opts: { dry?: boolean } = {}): Promise<SparronRun> {
  await ensureTables();
  const ctx = await getPageContext();
  const candidates = await collectCandidates(ctx);

  const run: SparronRun = { scanned: candidates.length, sent: 0, drafted: 0, capped: 0, skipped: 0, failed: 0, items: [] };

  for (const c of candidates) {
    // Dedupe: already answered this exact message?
    if (await alreadyHandled(c.itemId)) {
      run.skipped++;
      run.items.push({ surface: c.surface, author: c.authorName, incoming: c.incomingText, outcome: "skipped", reason: "already handled" });
      continue;
    }
    // Loop guard: had our say too many times in this thread?
    if ((await threadReplyCount(c.threadKey)) >= REPLY_CAP) {
      run.capped++;
      const t = await triageAndDraft(c).catch(() => null);
      if (t?.reply) await saveDraft(c, t.reply, `reply cap (${REPLY_CAP}) reached — needs human`);
      run.items.push({ surface: c.surface, author: c.authorName, incoming: c.incomingText, outcome: "capped", reason: "reply cap reached" });
      continue;
    }

    let t: Triage;
    try {
      t = await triageAndDraft(c);
    } catch (e) {
      run.failed++;
      run.items.push({ surface: c.surface, author: c.authorName, incoming: c.incomingText, outcome: "failed", error: e instanceof Error ? e.message : "triage failed" });
      continue;
    }
    if (!t.reply) {
      run.skipped++;
      run.items.push({ surface: c.surface, author: c.authorName, incoming: c.incomingText, outcome: "skipped", reason: t.reason || "no reply" });
      continue;
    }

    const shouldSend = !opts.dry && (AUTONOMY === "auto" || (AUTONOMY === "hybrid" && t.action === "auto"));
    if (shouldSend) {
      const sent = await sendReply(ctx, c.target, t.reply);
      if (sent.ok) {
        await recordReply(c, t.reply, "auto", sent.ref || null);
        run.sent++;
        run.items.push({ surface: c.surface, author: c.authorName, incoming: c.incomingText, outcome: "sent", reply: t.reply });
      } else {
        // Couldn't deliver (e.g. DM window closed) — hold it so it's not lost.
        await saveDraft(c, t.reply, `auto-send failed: ${sent.error}`);
        run.failed++;
        run.items.push({ surface: c.surface, author: c.authorName, incoming: c.incomingText, outcome: "failed", reply: t.reply, error: sent.error });
      }
    } else {
      await saveDraft(c, t.reply, opts.dry ? "dry run" : t.reason || "held for approval");
      run.drafted++;
      run.items.push({ surface: c.surface, author: c.authorName, incoming: c.incomingText, outcome: "drafted", reply: t.reply, reason: t.reason });
    }
  }
  return run;
}

/**
 * Approve (optionally with an edited body) or reject a held draft. On approve
 * we send it live and log it as an "approved" reply so the loop guard counts
 * it like any other. Used by the drafts route.
 */
export async function resolveDraft(
  id: string,
  action: "approve" | "reject",
  editedText?: string,
): Promise<{ ok: boolean; outcome: string; error?: string }> {
  await ensureTables();
  const rows = await sql`SELECT * FROM mb_sparron_drafts WHERE id = ${id}`;
  if (!rows.length) return { ok: false, outcome: "not_found", error: "draft not found" };
  const d = rowToDraft(rows[0]);
  if (d.status !== "pending") return { ok: false, outcome: d.status, error: `draft already ${d.status}` };

  if (action === "reject") {
    await sql`UPDATE mb_sparron_drafts SET status = 'rejected', updated_at = NOW() WHERE id = ${id}`;
    return { ok: true, outcome: "rejected" };
  }

  const text = cleanVoice((editedText || d.draftText).trim());
  const ctx = await getPageContext();
  const sent = await sendReply(ctx, d.target, text);
  if (!sent.ok) {
    await sql`UPDATE mb_sparron_drafts SET status = 'failed', draft_text = ${text}, updated_at = NOW() WHERE id = ${id}`;
    return { ok: false, outcome: "failed", error: sent.error };
  }
  await sql`UPDATE mb_sparron_drafts SET status = 'sent', draft_text = ${text}, updated_at = NOW() WHERE id = ${id}`;
  await sql`
    INSERT INTO mb_sparron_log (surface, thread_key, item_id, reply_text, mode, reply_ref)
    VALUES (${d.surface}, ${d.threadKey}, ${d.itemId}, ${text}, 'approved', ${sent.ref || null})
  `;
  return { ok: true, outcome: "sent" };
}
