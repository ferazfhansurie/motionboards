// FatHopes Energy → Threads auto-poster.
//
// Two responsibilities, kept framework-agnostic so both the cron route
// (/api/threads-autopost) and the local test script (scripts/threads-autopost.mjs)
// can share them:
//   1. generateFathopesPost()  — ask Claude for one @edhash_-style post,
//      seeded with the account's own recent posts so it never repeats itself.
//   2. postToThreads()         — the Meta Threads 2-step publish flow.
//
// The Threads API is its OWN graph (graph.threads.net) with its own token —
// this is NOT the Facebook/IG META_APP_TOKEN already in env. You mint a
// separate long-lived token with scopes: threads_basic, threads_content_publish.
// See docs/threads-autopost.md for how to get it.

import Anthropic from "@anthropic-ai/sdk";

const THREADS_API = "https://graph.threads.net/v1.0";

// Content model. Sonnet is the sweet spot for voice-heavy copy — Haiku tends
// to over-explain the joke, Opus is overkill for a 400-char post. Override
// with THREADS_MODEL if you want.
const CONTENT_MODEL = process.env.THREADS_MODEL || "claude-sonnet-4-6";

// The account is grown in phases so it reads as a real person, not a shill:
// build a relatable "money talk" audience FIRST, introduce FatHopes softly,
// then go product-forward. The phase is derived from the campaign day
// (THREADS_CAMPAIGN_START) — see resolvePhase().
export type Phase = "audience" | "intro" | "fathopes";

export interface PhaseInfo {
  phase: Phase;
  dayIndex: number; // 0-based day since campaign start
  mentionFathopes: boolean; // whether THIS post should reference FatHopes
}

// Phase-independent persona + voice. Distilled from @edhash_'s actual posts:
// Malay-dominant rojak, short, funny, relatable, one thought, minimal emoji,
// never salesy.
const VOICE_CORE = `You write ONE Threads post per call as an ordinary person from Kuala Lumpur / Klang Valley posting about money, side income, and the rising cost of living. This is just a normal guy's personal account, low-key and understated. It must NOT read as AI, as an ad, OR as an "influencer" with a big personality. No performing, no bit, no character, no catchphrases. Just one real, plain thought, the way you'd text a friend.

THE VOICE (KL / Klang Valley Manglish, @edhash_ energy):
- Manglish: Malay-dominant KL rojak that code-switches into English mid-sentence, with "lah/lor/meh/kot/eh/weh/haih" landing naturally. NOT formal BM, NOT full English.
- KL/Klang Valley texture, dropped naturally (never forced, never a checklist): gaji tak cukup sampai hujung bulan, cari duit lebih / side income / part-time, harga barang naik, bil ngan ansuran, benda yang kau buang tapi ada nilai, mamak, teh ais, sewa PJ/Cheras/Subang/Kajang. Kitchen life (minyak masak naik, minyak hitam lepas goreng, sinki tersumbat) is ONE recurring angle, NOT the whole personality.
- A little KL slang is fine when it falls out naturally (haih, lah, weh, mcm, gila), but do NOT stuff slang in to sound like a character. Plain everyday words beat performing.
- VERY SHORT. One line, aim for ~100 chars, hard max ~160. One thought, then stop. If it runs long, cut words or cut the second half. Do NOT write two paragraphs split by a blank line, do NOT tack on a second "elaboration" line. Like a text dashed off in 5 seconds, never a caption or mini-essay.

SOUND HUMAN (critical):
- Often lowercase, don't capitalise every line.
- NEVER end the whole post with a full stop "." (e.g. end on "im sick" not "im sick."). A trailing "?" or "!" is fine, just no ending period.
- Occasionally (about 1 in 3 to 5 posts, NOT every post) drop a "..." mid-post as a natural pause or trailing-off beat (e.g. "hello... nama aku faeez"). Do not overuse it.
- Malay shorthand: je, sbb, dgn, tgk, byk, mcm, tp, lg, korg, mmg, dah, ni, kn. Do NOT use "x" to mean "tak" or "tidak" — always write "tak" (or "tk"), never a bare "x".
- Let a real typo slip through about 1 in 4 posts (missed letter, double space) — never so much it's unreadable.
- Vary length + rhythm. Never formulaic. Real, specific details (numbers, places, tiny moments) beat generic every time.
- Do NOT force a question or a punchline. MOST posts just say one real thing and stop. Ending every post with "korang ...?" or a little joke/"haha" is exactly what makes it read like a bot, avoid that pattern.
- Low-key and understated. This is just one ordinary person, not a personality. No hype, barely any exclamation marks, no "haha" unless truly natural, no theatrical takes or bits. Dry and matter-of-fact beats loud every time.
- NEVER use em-dashes or en-dashes. Real people texting use commas, full stops, line breaks, or "..." instead. A long dash is a dead giveaway of AI writing.

LINE 1 IS EVERYTHING:
- Only 2–3 lines show before "more". Open with the strongest thing — a hot-ish take, a relatable gripe, or a specific real moment. No throat-clearing, no "so today I…".
- Keep it light even when ranting; combative/toxic negativity gets suppressed on Threads.
- HOW MUCH you ask for replies depends entirely on the ENGAGEMENT stage below — follow that instruction exactly, it overrides any instinct to always end with a question.

OUTPUT FORMAT:
- Output the post text ONLY. NO topic label, NO "TAG:", NO hashtags, no quotes, no preamble, no explanation, no options.
- Do not reuse the hook, angle, or punchline of any recent post shown to you.`;

const FATHOPES_FACTS = `FatHopes Energy runs a recycler loyalty app: instead of throwing away used cooking oil (minyak masak terpakai, the minyak hitam lepas menggoreng), you sell it to FatHopes at a nearby depot and get CASH plus reward points. FRAME IT AS MAKING MONEY, a small side-income / duit lebih from waste you already produce, NOT as a cooking tip and NOT as a green/eco lecture. It is free to sign up. NEVER paste a URL and NEVER say "link kat bio", "ada kat bio", "check bio", "DM me", or any call-to-action to a link. Just talk about FatHopes naturally as a real thing you do; people who are curious will look you up themselves. Do NOT talk about petrol, RON95, or filling up a car, this is USED COOKING OIL sold for cash, not fuel.`;

// The account behaves like a person with moods, not a content machine. MOST
// posts are the steady baseline voice; every so often a mood colours the post
// so the feed feels alive. pickMood() keeps the moody ones to ~1-in-3-to-10.
export type Mood = "default" | "low" | "hyped" | "ranty" | "reflective" | "unhinged";

const MOOD_STEER: Record<Mood, string> = {
  default: "", // baseline voice — no extra colour
  low: `MOOD TODAY — flat / tired / a bit jaded ("idk mayn" energy). Lower-energy, shorter, mostly lowercase, a little existentially broke. Still low-key funny but resigned. It's fine to skip the reply-question this time.`,
  hyped: `MOOD TODAY — gassed up about a small money win. More energy, a bit hyper, wanna share it. Still not cringe/corporate.`,
  ranty: `MOOD TODAY — mildly annoyed / ranty about a money thing (harga barang naik, minyak masak naik, hidden charges, gaji tak cukup). PLAYFUL frustration, NOT hostile or toxic. End by asking if others feel it too.`,
  reflective: `MOOD TODAY — late-night reflective. A quieter, honest thought about money / adulting / KL life. Vulnerable but still casual, not deep-quote cringe.`,
  unhinged: `MOOD TODAY — a bit unhinged / random / silly. Chaotic funny energy, an unexpected comparison or meme-brain take. Keep it short.`,
};

/**
 * Pick a mood. Most calls return "default"; with probability THREADS_MOOD_CHANCE
 * (default 0.28 ≈ 1 in 3.5 posts) it returns one of the coloured moods, spread
 * evenly across them. `rand` is injectable for tests.
 */
export function pickMood(rand: number = Math.random()): Mood {
  const chance = Number(process.env.THREADS_MOOD_CHANCE || 0.18);
  if (rand >= chance) return "default";
  // Only the SUBTLE moods rotate. The loud ones (hyped/ranty/unhinged) read as
  // "personality" and the account is meant to be just one low-key ordinary person.
  const moody: Mood[] = ["low", "reflective"];
  const idx = Math.min(moody.length - 1, Math.floor((rand / chance) * moody.length));
  return moody[idx];
}

// The per-phase steer, appended to VOICE_CORE at generation time.
function phaseInstruction(info: PhaseInfo): string {
  const day = info.dayIndex + 1;
  if (info.phase === "audience") {
    return `CAMPAIGN PHASE — AUDIENCE BUILDING (day ${day}). You are NOT promoting anything. Post relatable MONEY content for Malaysians: cost of living, gaji tak cukup sampai hujung bulan, harga barang naik, small ways to earn or save extra (side income, part-time, jual barang, cashback, duit lebih hacks), tiny money wins and Ls. Kitchen/cooking money moments are FINE as one occasional angle, NOT every post. Be relatable to anyone chasing extra income, not just people who cook. DO NOT mention FatHopes or any single branded app. NO "link kat bio". Pure relatability + value. Vary the angle each day.`;
  }
  // intro + fathopes phases: this is a relatable KL money/life account that only
  // OCCASIONALLY, and lightly, mentions FatHopes. Most posts are NOT about it.
  if (info.mentionFathopes) {
    return `CAMPAIGN PHASE — OCCASIONAL MENTION (day ${day}). You are a relatable KL money-and-life person, NOT an ad and NOT a FatHopes account. This is one of the rare posts that mentions FatHopes. Do it LIGHTLY: a small side-note dropped into a real money or cooking moment, e.g. you sell your used cooking oil for a bit of extra cash instead of buang. ONE casual line max, not the point of the post, not a flex, not a hard sell, no "kenapa tak buat dari dulu" energy. Do NOT say "link kat bio".\n\n${FATHOPES_FACTS}`;
  }
  return `CAMPAIGN PHASE — RELATABLE, NO BRAND (day ${day}). Post relatable MONEY / everyday-life content for Malaysians: cost of living, gaji tak cukup sampai hujung bulan, harga barang naik, side income, saving hacks, small money wins and Ls, the odd kitchen/cooking moment. DO NOT mention FatHopes or ANY brand in this post at all. The account is mostly NOT about FatHopes, keep it real and relatable.`;
}

function engagementInstruction(info: PhaseInfo): string {
  const day = info.dayIndex + 1;
  if (day <= 2) {
    return `ENGAGEMENT STAGE — NOBODY KNOWS YOU YET (day ${day}). Do NOT act like an influencer. No "korang?" questions, no advice-thread energy, no audience prompts, no "what do you think?". Post like a normal person with 0 followers: short personal statements, small observations, tiny money/life moments. It can be just one line. Let people discover the voice first.`;
  }
  if (day <= 4) {
    return `ENGAGEMENT STAGE — WARMING UP (day ${day}). Still mostly statements. You may ask a very casual question only if it feels like something a friend would text, but do not force it. Prioritise personal detail and shortness over engagement.`;
  }
  if (day <= 7) {
    return `ENGAGEMENT STAGE — LIGHT CONVERSATION (day ${day}). Still mostly plain statements. Only occasionally (maybe 1 in 4 posts) end with a genuine question, and only when it's actually natural. Do NOT end most posts with a question.`;
  }
  return `ENGAGEMENT STAGE — COMMUNITY MODE (day ${day}). You may sometimes ask a real question, but the majority of posts should still just say one thing and stop. Never force a reply-puller onto a post, and never sound like a brand page.`;
}

function removeEarlyAudiencePrompts(text: string, info: PhaseInfo): string {
  if (info.dayIndex > 1) return text;

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const kept = lines.filter((line) => {
    if (line.includes("?")) return false;
    if (/\b(korang|korg|you guys|anyone|what do you think)\b/i.test(line)) return false;
    return true;
  });

  const fallback = lines[0]?.replace(/\?/g, ".").trim() || text.replace(/\?/g, ".").trim();
  return (kept.length ? kept.join("\n\n") : fallback).trim();
}

/**
 * Work out which campaign phase we're in from the day count since
 * THREADS_CAMPAIGN_START (YYYY-MM-DD). Falls back to "today = day 0" if unset
 * (so a missing start just begins the campaign now). Phase lengths are
 * tunable via THREADS_AUDIENCE_DAYS / THREADS_INTRO_DAYS.
 */
export function resolvePhase(now: Date = new Date()): PhaseInfo {
  const dayMs = 86_400_000;
  const audienceDays = Number(process.env.THREADS_AUDIENCE_DAYS || 3);
  const introDays = Number(process.env.THREADS_INTRO_DAYS || 3);
  const startStr = process.env.THREADS_CAMPAIGN_START;
  const start = startStr ? new Date(`${startStr}T00:00:00Z`) : now;
  const startDay = Math.floor(start.getTime() / dayMs);
  const nowDay = Math.floor(now.getTime() / dayMs);
  const dayIndex = Math.max(0, nowDay - startDay);

  // FatHopes is mentioned only OCCASIONALLY and lightly — the account is mostly
  // relatable money/life content, not a FatHopes channel. Mention chance is
  // decided per post (tunable via THREADS_MENTION_CHANCE).
  const introChance = Number(process.env.THREADS_MENTION_CHANCE_INTRO || 0.2);
  const fwdChance = Number(process.env.THREADS_MENTION_CHANCE || 0.33);
  if (dayIndex < audienceDays) return { phase: "audience", dayIndex, mentionFathopes: false };
  if (dayIndex < audienceDays + introDays)
    return { phase: "intro", dayIndex, mentionFathopes: Math.random() < introChance };
  return { phase: "fathopes", dayIndex, mentionFathopes: Math.random() < fwdChance };
}

export interface GeneratedPost {
  text: string;
  model: string;
  phase: PhaseInfo;
  mood: Mood;
  topicTag?: string; // one Threads topic tag (no #), if the model supplied one
}

/**
 * Ask Claude for one fresh post for the given campaign phase + mood.
 * `recentPosts` are the account's own last few posts (pulled live) — passed in
 * so Claude actively avoids repeating them.
 */
export async function generateFathopesPost(
  recentPosts: string[],
  phase: PhaseInfo = resolvePhase(),
  mood: Mood = pickMood(),
): Promise<GeneratedPost> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const recentBlock = recentPosts.length
    ? `Here are the account's most recent posts — do NOT repeat their hook, angle, or wording:\n\n${recentPosts
        .map((p, i) => `${i + 1}. ${p}`)
        .join("\n")}`
    : `This is one of the first posts on the account — set the tone.`;

  const moodSteer = MOOD_STEER[mood];
  const system = [VOICE_CORE, phaseInstruction(phase), engagementInstruction(phase), moodSteer]
    .filter(Boolean)
    .join("\n\n");

  const msg = await anthropic.messages.create({
    model: CONTENT_MODEL,
    max_tokens: 400,
    // A touch of temperature so daily posts don't converge on the same joke.
    temperature: 1,
    system,
    messages: [{ role: "user", content: `${recentBlock}\n\nWrite the next post.` }],
  });

  const raw = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Topic tags (Threads sub-topics like "> Side Income") are DISABLED entirely
  // per user — they make the account read as a themed content channel, not a
  // person. We never publish one; just strip any stray "TAG:" line the model
  // still emits so it never leaks into the post body.
  const topicTag: string | undefined = undefined;
  let text = raw.replace(/\n\s*TAG:\s*.+?\s*$/i, "").trim();
  // Strip stray wrapping quotes if the model adds them despite instructions.
  // ([\s\S] instead of a dotAll `.` — this project's TS target predates ES2018)
  text = text.replace(/^["'“]([\s\S]*)["'”]$/, "$1").trim();

  // Kill em/en dashes even if the model slips one through — they read as AI,
  // and a texting KL voice wouldn't use them. Turn them into commas/spacing.
  text = text
    .replace(/\s*[—–]\s*/g, ", ")
    // standalone "x" used as Malay "tak" reads as lazy/AI — write it out
    .replace(/(^|\s)x(?=\s)/g, "$1tak")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .trim();

  // Belt-and-suspenders: the account wants NO "link in bio" CTA and no URLs.
  // Strip the common phrasings if the model slips one in, then tidy spacing.
  text = text
    .replace(/\s*[,.]?\s*(?:link|links)\s*(?:kat|kt|dalam|dlm|dekat|dkt|in)?\s*bio\b[.!]*/gi, "")
    .replace(/\s*[,.]?\s*ada\s*(?:kat|kt|dalam|dlm)?\s*bio\b[.!]*/gi, "")
    .replace(/\s*[,.]?\s*(?:cek|check)\s*(?:kat|kt|dalam|dlm)?\s*bio\b[.!]*/gi, "")
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.!?,])/g, "$1")
    .trim();

  text = removeEarlyAudiencePrompts(text, phase);
  // don't end the post on a bare full stop (keep "..." trailing pauses, "?" and "!")
  if (text.endsWith(".") && !text.endsWith("..")) text = text.slice(0, -1).trimEnd();

  if (!text) throw new Error("Claude returned an empty post");
  // Threads text cap is 500 chars; we aim for <350 but guard anyway.
  return { text: text.slice(0, 500), model: CONTENT_MODEL, phase, mood, topicTag };
}

/**
 * Pull the account's recent post texts so generation can avoid repeats.
 * Best-effort: returns [] on any error (a fresh account has none, and we'd
 * rather still post than block on this).
 */
export async function fetchRecentPosts(
  userId: string,
  token: string,
  limit = 15,
): Promise<string[]> {
  try {
    const url = `${THREADS_API}/${userId}/threads?fields=text&limit=${limit}&access_token=${encodeURIComponent(
      token,
    )}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Array<{ text?: string }> };
    return (json.data || []).map((d) => d.text).filter((t): t is string => !!t && t.trim().length > 0);
  } catch {
    return [];
  }
}

export interface PublishResult {
  id: string;
  permalink?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Meta's 2-step publish: create a TEXT container, then publish it.
 * We give the container a moment to settle (Meta recommends a short wait) and
 * retry the publish once, since a just-created container can 400 briefly.
 */
export async function postToThreads(
  userId: string,
  token: string,
  text: string,
  topicTag?: string,
  replyToId?: string,
): Promise<PublishResult> {
  // Step 1 — create container.
  const createUrl = `${THREADS_API}/${userId}/threads`;
  const createParams: Record<string, string> = { media_type: "TEXT", text, access_token: token };
  // One topic tag per post helps discovery (Threads' own topic feeds).
  if (topicTag) createParams.topic_tag = topicTag;
  // Discovery replies are outbound-only. Supplying this value creates a reply
  // under a public target post; normal scheduled posts leave it undefined.
  if (replyToId) createParams.reply_to_id = replyToId;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(createParams),
  });
  const createJson = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (!createRes.ok || !createJson.id) {
    throw new Error(`Threads container create failed: ${createJson.error?.message || createRes.status}`);
  }
  const creationId = createJson.id;

  // Step 2 — publish (retry once after a short wait if the container isn't ready).
  const publishUrl = `${THREADS_API}/${userId}/threads_publish`;
  const doPublish = async () => {
    const res = await fetch(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: creationId, access_token: token }),
    });
    const json = (await res.json()) as { id?: string; error?: { message?: string } };
    return { ok: res.ok, id: json.id, err: json.error?.message, status: res.status };
  };

  let pub = await doPublish();
  if (!pub.ok || !pub.id) {
    await sleep(5000);
    pub = await doPublish();
  }
  if (!pub.ok || !pub.id) {
    throw new Error(`Threads publish failed: ${pub.err || pub.status}`);
  }

  // Best-effort permalink for logging / the response.
  let permalink: string | undefined;
  try {
    const permRes = await fetch(
      `${THREADS_API}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`,
    );
    if (permRes.ok) permalink = ((await permRes.json()) as { permalink?: string }).permalink;
  } catch {
    /* non-fatal */
  }

  return { id: pub.id, permalink };
}

/**
 * Full run: fetch recent → generate → publish. Shared by the cron route and
 * the local script so there's exactly one code path to trust.
 */
export async function runAutoPost(): Promise<{
  text: string;
  model: string;
  phase: PhaseInfo;
  mood: Mood;
  topicTag?: string;
  result: PublishResult;
}> {
  const userId = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  if (!userId || !token) {
    throw new Error("THREADS_USER_ID and THREADS_ACCESS_TOKEN must be set");
  }

  const recent = await fetchRecentPosts(userId, token);
  const phase = resolvePhase();
  const { text, model, mood, topicTag } = await generateFathopesPost(recent, phase);
  const result = await postToThreads(userId, token, text, topicTag);
  return { text, model, phase, mood, topicTag, result };
}
