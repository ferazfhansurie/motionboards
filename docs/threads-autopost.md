# FatHopes to Threads Auto-Poster — Operator Manual

A hands-off system that writes one Threads post at a time with Claude, in a Kuala Lumpur /
Klang Valley Manglish voice (the @edhash_ energy), and publishes it through Meta's official
Threads API on a schedule. The account is grown in **phases** and posts with **moods** and
a slow **engagement ramp** so it reads like a real person seeding FatHopes Energy, not a bot
running an ad.

This doc is the single source of truth. After you `git clone` the repo you can read this and
change anything about the account without touching the rest of the app.

Account in use: username `farzmus`, Threads user id `25358256307205104`.

---

## 1. Map of every file

| File | What it holds | Touch it when you want to change... |
|---|---|---|
| `src/lib/threads.ts` | All the logic: voice, phases, engagement ramp, moods, image-free generation, and the 2-step Threads publish. | the voice, the rollout, the moods, anything about the words |
| `src/app/api/threads-autopost/route.ts` | The HTTP endpoint the cron calls. Secret-gated. Supports `?dry=1` preview. | how it is triggered or protected |
| `vercel.json` | The cron schedule (currently 2 per day). | posting times or cadence |
| `scripts/threads-autopost.mjs` | Local runner that calls the same endpoint. `--dry` to preview. | testing before you trust it |
| `docs/threads-autopost.md` | This manual. | keeping notes for future you |

Everything is plain and self-contained. There is no database and no admin screen (see section 9
if you want one).

---

## 2. How it runs (the schedule)

`vercel.json` registers Vercel Cron jobs. Current setting is twice a day:

```json
{
  "crons": [
    { "path": "/api/threads-autopost", "schedule": "0 0 * * *" },
    { "path": "/api/threads-autopost", "schedule": "0 12 * * *" }
  ]
}
```

Cron times are **UTC**. Malaysia is UTC+8, so:

- `0 0 * * *` = 08:00 MYT (morning)
- `0 12 * * *` = 20:00 MYT (evening)

These are peak Threads windows. To change cadence, edit `vercel.json` and redeploy:

- **Once a day:** delete one of the two entries.
- **Different times:** change the cron. Example, 1pm MYT = `0 5 * * *` (5 UTC).
- **More often:** add entries. Threads allows 250 posts per account per day, so you are nowhere
  near the ceiling.

The cron only registers when `vercel.json` is deployed. After editing, push and let Vercel
deploy, then check the Vercel project under Settings, Cron Jobs to confirm the entries.

---

## 3. How to trigger it, or connect to it from anywhere

The endpoint is `GET /api/threads-autopost`. It is protected by the `CRON_SECRET` env var.
Two ways to authorise:

- Header: `Authorization: Bearer <CRON_SECRET>` (this is what Vercel Cron sends automatically)
- Query: `?secret=<CRON_SECRET>` (handy for a browser or curl test)

Modes:

- **Publish for real:** `GET /api/threads-autopost?secret=...`
- **Preview only, no publish:** add `&dry=1`. Returns the post it *would* make, with its phase,
  engagement stage, mood, and topic tag, but does not touch Threads.

Examples:

```bash
# preview one post without publishing
curl "https://<your-domain>/api/threads-autopost?secret=$CRON_SECRET&dry=1"

# publish one post right now
curl "https://<your-domain>/api/threads-autopost?secret=$CRON_SECRET"
```

Because it is just a secret-gated URL, you can trigger it from anything: an external cron, a
phone shortcut, n8n, Zapier, a GitHub Action, another server. Anything that can send an HTTP GET
with the secret can fire a post. If `CRON_SECRET` is not set, the endpoint fails closed and
returns 401, so it is never open to the public.

---

## 4. The content system and where to adjust each part

All four dials live in `src/lib/threads.ts`.

### 4a. Rollout phases (when FatHopes shows up)
Function `resolvePhase()` and `phaseInstruction()`.

| Days | Phase | Content | FatHopes |
|---|---|---|---|
| 1 to 3 | audience | personal KL money and life talk | never |
| 4 to 6 | intro | mostly money talk, FatHopes slipped in about every other day | light |
| 7+ | fathopes | the app as the natural fix, still in voice | yes |

Tune the lengths with env vars `THREADS_AUDIENCE_DAYS` and `THREADS_INTRO_DAYS`. Day 1 is set by
`THREADS_CAMPAIGN_START` (YYYY-MM-DD). Reword each phase in `phaseInstruction()`.

### 4b. Engagement ramp (how much it asks the reader back)
Function `engagementInstruction()`, with a hard guard in `removeEarlyAudiencePrompts()`.

| Days | Behaviour |
|---|---|
| 1 to 2 | short personal statements only. No "korang?" questions, no advice-thread energy. On these days any question line is stripped in code and topic tags are turned off. |
| 3 to 4 | mostly statements, a casual question only if it feels like a friend texting |
| 5 to 7 | light conversation, about half the posts can invite replies |
| 8+ | community mode, reply-pulling questions are fine, still not bait |

The reasoning: a brand-new account with no followers that acts like an influencer reads as fake.
It earns the right to ask questions. To shift the thresholds, edit the `day <= N` checks in
`engagementInstruction()` and the guard in `removeEarlyAudiencePrompts()`.

### 4c. Moods (so the feed feels alive)
`MOOD_STEER` and `pickMood()`. Most posts are the steady baseline. With probability
`THREADS_MOOD_CHANCE` (default 0.28, about 1 in 3.5) a post takes on a mood: `low` (tired),
`hyped`, `ranty`, `reflective`, or `unhinged`. Set `THREADS_MOOD_CHANCE=0` to switch moods off,
or `1` to always be moody. Add or reword moods in `MOOD_STEER`.

### 4d. Voice and virality rules
`VOICE_CORE`. This holds the KL Manglish voice, the human tics (lowercase, Malay shorthand,
occasional typo, no long dashes), and the Threads algorithm levers (hook in line 1, replies
matter more than likes). Em and en dashes are also stripped in code after generation, because a
long dash is a tell for AI writing. `FATHOPES_FACTS` holds the product one-liner used only in the
intro and fathopes phases.

### 4e. Images (optional per post)
Image publishing is not wired into the auto-poster yet. Posts are text only. The content planner
(section 9) drafts Nano Banana 2 image prompts and references for the roughly 1 in 4 posts that
benefit from a photo. To go live with images you would generate the image, host it, and switch the
publish call in `postToThreads()` from `media_type=TEXT` to `media_type=IMAGE` with an `image_url`.
Ask for this to be built when you want it.

---

## 5. Environment variables

Set these in `.env.local` for local runs, and in the Vercel project (Settings, Environment
Variables) for production. Put them in the **same** Vercel project that already has `DATABASE_URL`
and `ANTHROPIC_API_KEY`, not a new project.

| Var | Required | Purpose |
|---|---|---|
| `THREADS_USER_ID` | yes | Threads account numeric id (`25358256307205104` for farzmus) |
| `THREADS_ACCESS_TOKEN` | yes | long-lived (60 day) Threads token, scopes `threads_basic` + `threads_content_publish` |
| `CRON_SECRET` | yes | any long random string, gates the endpoint. Vercel Cron sends it automatically. |
| `ANTHROPIC_API_KEY` | yes | writes the posts. Copy from Vercel or console.anthropic.com |
| `THREADS_CAMPAIGN_START` | recommended | YYYY-MM-DD, day 1 of the rollout |
| `THREADS_AUDIENCE_DAYS` | optional | length of the no-FatHopes phase (default 3) |
| `THREADS_INTRO_DAYS` | optional | length of the soft-intro phase (default 3) |
| `THREADS_MOOD_CHANCE` | optional | 0 to 1, chance a post is moody (default 0.28) |
| `THREADS_MODEL` | optional | content model (default `claude-sonnet-4-6`) |

Secrets (the token, the cron secret, the API key) live only in env, never in the repo.

---

## 6. Local testing

```bash
npm run dev
node scripts/threads-autopost.mjs --dry   # generate + preview, does NOT publish
node scripts/threads-autopost.mjs         # generate + PUBLISH one real post
```

The script reads `.env.local`, hits your local endpoint, and prints the phase, engagement stage,
mood, tag, and text. Run `--dry` a few times to sanity-check the voice, then do one real publish.
Set `THREADS_BASE_URL` to your production URL to fire the live site instead of localhost.

---

## 7. The token expires every 60 days

The Threads long-lived token lasts 60 days. Refresh it before it dies:

```
GET https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=<CURRENT_TOKEN>
```

The response returns a fresh token and a new `expires_in` of about 5.18 million seconds. Put the
new token in `THREADS_ACCESS_TOKEN` (env.local and Vercel). If you want this to be truly hands-off
past 60 days, it can be auto-refreshed and stored in the Neon database; ask and it can be built.

Note: the dashboard "Generate access token" button already returns a long-lived token, so the
`th_exchange_token` exchange will fail with "Session key invalid". That is expected. Use refresh,
not exchange.

---

## 8. First-time setup (only needed on a fresh Meta app)

1. Threads runs on an Instagram login. Pick the IG account, open threads.com, finish the profile,
   and put the FatHopes signup link in the **bio** (posts never paste a URL, they say "link kat bio").
2. At developers.facebook.com create an app with the "Access the Threads API" use case. Add the
   Threads product and request scopes `threads_basic` and `threads_content_publish`. Add your
   account as a Threads Tester and accept the invite. Dev mode can publish to your own account
   without full App Review.
3. Generate the token, confirm it is long-lived with the refresh call above, and read the user id:
   `GET https://graph.threads.net/v1.0/me?fields=id,username&access_token=<TOKEN>`.
4. Set the env vars from section 5, deploy, and confirm the cron jobs registered.

---

## 9. Previewing and (optionally) a real drafts screen

There is no stored draft queue. The cron generates a fresh post at post-time and publishes it, so
nothing sits waiting for review. To see content you have three options: the `?dry=1` preview
(one post it would make now), the Vercel function logs (what was posted), and Threads itself.

A visual preview of a full rollout can be generated on demand with the content planner (12 real
sample posts across the phases, moods, and image plans). If you want a proper drafts and schedule
screen (generate days ahead, review or edit, approve, then auto-publish the approved ones), that
needs a small Neon table plus a page in the app. It is a clean next step; ask when you want it.

---

## 10. Quick recipes

- **Change posting times or frequency:** edit `vercel.json`, push, redeploy.
- **Make FatHopes appear sooner or later:** set `THREADS_AUDIENCE_DAYS` / `THREADS_INTRO_DAYS`.
- **Restart the campaign from day 1:** set `THREADS_CAMPAIGN_START` to today, redeploy.
- **Calmer or wilder feed:** lower or raise `THREADS_MOOD_CHANCE`.
- **Tweak the voice:** edit `VOICE_CORE` in `src/lib/threads.ts`.
- **Reword a phase or the FatHopes pitch:** edit `phaseInstruction()` / `FATHOPES_FACTS`.
- **Pause everything:** remove the crons from `vercel.json` (or unset `CRON_SECRET` to hard-disable
  the endpoint), then redeploy.
- **Fire a post right now:** hit the endpoint with the secret (section 3).

---

## 11. One daily relevant-post discovery reply

`/api/threads-discovery-reply` is the only scheduled Threads workflow for
`@farzmusa`. It searches recent public Threads posts around Singapore food,
hawkers, restaurants, used cooking oil, food waste, and sustainability; scores
them for relevance; and makes at most **one** contextual reply each calendar day
at **13:00 Malaysia time**. It never reads or responds to replies received by
`@farzmusa`.

Safety rules are built in: no bulk replies, no links, no hashtags, no invented
personal stories, no engagement-bait, and a FatHopes mention is only permitted
when directly relevant and clearly disclosed (for example, “we at FatHopes”).

### Required env and permission

The token must be freshly authorized with all three Threads scopes:

```text
threads_basic, threads_content_publish, threads_keyword_search
```

Then set these in Vercel Production (and `.env.local` when testing locally):

```text
THREADS_DISCOVERY_ENABLED=true
THREADS_USER_ID=<farzmusa Threads user ID>
THREADS_ACCESS_TOKEN=<fresh token with keyword search permission>
DATABASE_URL=<existing Neon database URL>
ANTHROPIC_API_KEY=<existing key>
CRON_SECRET=<existing secret>
```

Keep `THREADS_DISCOVERY_ENABLED` unset or `false` to pause publishing. A dry run
is still safe and can be used to check the permission and draft quality:

```bash
npm run dev
node scripts/threads-discovery-reply.mjs --dry
```

After that is approved, the same script without `--dry` sends the single reply
for the day. The daily cron uses exactly the same route.
