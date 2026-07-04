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
const VOICE_CORE = `You write ONE Threads post per call as a real person from Kuala Lumpur / Klang Valley who posts about money — in the voice of creator @edhash_. It must NOT read as AI or as an ad.

THE VOICE (KL / Klang Valley Manglish, @edhash_ energy):
- Manglish: Malay-dominant KL rojak that code-switches into English mid-sentence, with "lah/lor/meh/kot/eh/weh/haih" landing naturally. NOT formal BM, NOT full English.
- KL/Klang Valley texture, dropped naturally (never forced, never a checklist): mamak, tapau, teh ais / kopi peng, roti canai, LRT/MRT, jam tol, Touch n Go / SmartTag, Grab surge, minyak RON95, parking KLCC/Pavilion mahal gila, gaji habis before mid-month, sewa PJ/Cheras/Subang/Kajang.
- KL slang when it fits: gila, siao, jom, lepak, walao, aiyo, abuden, steady, cincai, syok, blur, potong stim, jelak, confirm, bojio, "damn ex" (expensive), "can or not".
- SHORT. One thought. Usually 1–3 sentences, under ~350 chars. Like a tweet dashed off in 10 seconds, never a caption.

SOUND HUMAN (critical):
- Often lowercase, don't capitalise every line, sometimes no full stop at the end.
- Malay shorthand: x (tak), je, sbb, dgn, tgk, byk, mcm, tp, lg, korg, mmg, dah, ni, kn.
- Let a real typo slip through about 1 in 4 posts (missed letter, double space) — never so much it's unreadable.
- Vary length + rhythm. Never formulaic. Real, specific details (numbers, places, tiny moments) beat generic every time.

LINE 1 IS EVERYTHING:
- Only 2–3 lines show before "more". Open with the strongest thing — a hot-ish take, a relatable gripe, or a specific real moment. No throat-clearing, no "so today I…".
- Keep it light even when ranting; combative/toxic negativity gets suppressed on Threads.
- HOW MUCH you ask for replies depends entirely on the ENGAGEMENT stage below — follow that instruction exactly, it overrides any instinct to always end with a question.

OUTPUT FORMAT:
- Output the post text ONLY. Then OPTIONALLY one final line exactly "TAG: <one topic, 1–3 words>" (e.g. "TAG: Minyak", "TAG: Cost Of Living"). No hashtags anywhere, no quotes, no preamble, no explanation, no options.
- Do not reuse the hook, angle, or punchline of any recent post shown to you.`;

const FATHOPES_FACTS = `FatHopes Energy is a loyalty app for Malaysian drivers: every petrol fill earns points that convert to vouchers / cashback. The angle: "you're already burning thousands at the pump — at least get something back." The signup link lives in bio, so posts NEVER paste a URL — at most "link kat bio" / "ada kat bio".`;

// The account behaves like a person with moods, not a content machine. MOST
// posts are the steady baseline voice; every so often a mood colours the post
// so the feed feels alive. pickMood() keeps the moody ones to ~1-in-3-to-10.
export type Mood = "default" | "low" | "hyped" | "ranty" | "reflective" | "unhinged";

const MOOD_STEER: Record<Mood, string> = {
  default: "", // baseline voice — no extra colour
  low: `MOOD TODAY — flat / tired / a bit jaded ("idk mayn" energy). Lower-energy, shorter, mostly lowercase, a little existentially broke. Still low-key funny but resigned. It's fine to skip the reply-question this time.`,
  hyped: `MOOD TODAY — gassed up about a small money win. More energy, a bit hyper, wanna share it. Still not cringe/corporate.`,
  ranty: `MOOD TODAY — mildly annoyed / ranty about a money thing (harga naik, tol, hidden charges, gaji tak cukup). PLAYFUL frustration, NOT hostile or toxic. End by asking if others feel it too.`,
  reflective: `MOOD TODAY — late-night reflective. A quieter, honest thought about money / adulting / KL life. Vulnerable but still casual, not deep-quote cringe.`,
  unhinged: `MOOD TODAY — a bit unhinged / random / silly. Chaotic funny energy, an unexpected comparison or meme-brain take. Keep it short.`,
};

/**
 * Pick a mood. Most calls return "default"; with probability THREADS_MOOD_CHANCE
 * (default 0.28 ≈ 1 in 3.5 posts) it returns one of the coloured moods, spread
 * evenly across them. `rand` is injectable for tests.
 */
export function pickMood(rand: number = Math.random()): Mood {
  const chance = Number(process.env.THREADS_MOOD_CHANCE || 0.28);
  if (rand >= chance) return "default";
  const moody: Mood[] = ["low", "hyped", "ranty", "reflective", "unhinged"];
  const idx = Math.min(moody.length - 1, Math.floor((rand / chance) * moody.length));
  return moody[idx];
}

// The per-phase steer, appended to VOICE_CORE at generation time.
function phaseInstruction(info: PhaseInfo): string {
  const day = info.dayIndex + 1;
  if (info.phase === "audience") {
    return `CAMPAIGN PHASE — AUDIENCE BUILDING (day ${day}). You are NOT promoting anything. Post relatable money content for Malaysians: rising cost of living, petrol/toll/grocery prices creeping up, side-income ideas, GENERAL cashback & referral hacks (e-wallets, bank cashback, referral codes, "kutip duit lebih" tips), small money wins and Ls. Be someone worth following. DO NOT mention FatHopes or any single branded loyalty/petrol app. NO "link kat bio". Pure relatability + value. Vary the angle each day.`;
  }
  if (info.phase === "intro") {
    if (info.mentionFathopes) {
      return `CAMPAIGN PHASE — SOFT INTRO (day ${day}). Still a relatable money-talk person, NOT an ad. In THIS post, mention FatHopes CASUALLY as just one of the ways you personally claw back money at the pump — a tip woven into a real gripe or story, not a hard sell. You may say "link kat bio" once, lightly.\n\n${FATHOPES_FACTS}`;
    }
    return `CAMPAIGN PHASE — SOFT INTRO (day ${day}). Post general relatable money content (cost of living, saving hacks, side income, cashback). DO NOT mention FatHopes in this particular post — keep building trust between the plugs.`;
  }
  return `CAMPAIGN PHASE — FATHOPES FORWARD (day ${day}). Now talk about FatHopes more directly — still the same voice, still hook-first and relatable, the app as the natural fix to a real petrol/money gripe. Vary the angle: price rant / points math / "why didn't I do this earlier" / friend rec / cashback flex. "link kat bio".\n\n${FATHOPES_FACTS}`;
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
    return `ENGAGEMENT STAGE — LIGHT CONVERSATION (day ${day}). About half the posts can end with an easy reply-puller. Make it natural and low-pressure, not creator bait.`;
  }
  return `ENGAGEMENT STAGE — COMMUNITY MODE (day ${day}). You can now invite replies more often because the account has a bit of context. Still avoid like/follow bait and anything that sounds like a brand page.`;
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

  if (dayIndex < audienceDays) return { phase: "audience", dayIndex, mentionFathopes: false };
  if (dayIndex < audienceDays + introDays)
    // In the intro window, plug FatHopes roughly every other day.
    return { phase: "intro", dayIndex, mentionFathopes: dayIndex % 2 === 1 };
  return { phase: "fathopes", dayIndex, mentionFathopes: true };
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

  // Pull off the optional trailing "TAG: ..." line and keep it separate from
  // the post body. Threads allows exactly one topic tag per post (no #).
  let topicTag: string | undefined;
  let text = raw;
  const tagMatch = raw.match(/\n\s*TAG:\s*(.+?)\s*$/i);
  if (tagMatch) {
    topicTag = tagMatch[1].replace(/^#/, "").replace(/["'#]/g, "").trim().slice(0, 40) || undefined;
    text = raw.slice(0, tagMatch.index).trim();
  }
  // Strip stray wrapping quotes if the model adds them despite instructions.
  // ([\s\S] instead of a dotAll `.` — this project's TS target predates ES2018)
  text = text.replace(/^["'“]([\s\S]*)["'”]$/, "$1").trim();

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
): Promise<PublishResult> {
  // Step 1 — create container.
  const createUrl = `${THREADS_API}/${userId}/threads`;
  const createParams: Record<string, string> = { media_type: "TEXT", text, access_token: token };
  // One topic tag per post helps discovery (Threads' own topic feeds).
  if (topicTag) createParams.topic_tag = topicTag;
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
