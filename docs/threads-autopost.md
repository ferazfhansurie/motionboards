# FatHopes → Threads auto-poster

Generates one Threads post per day with Claude — in a KL/Klang Valley Manglish voice
(@edhash_ energy) — and publishes it via Meta's official API. Runs on Vercel Cron.
The account is grown in **phases** and posts with **moods** so it reads as a real person,
not a marketing bot, and is written to trigger the signals Threads' algorithm rewards.

## Files
- `src/lib/threads.ts` — voice, phase logic, mood logic, generate (Claude) + publish
- `src/app/api/threads-autopost/route.ts` — cron endpoint (secret-protected, `?dry=1`)
- `vercel.json` — daily cron at `0 12 * * *` UTC = **8:00pm MYT**
- `scripts/threads-autopost.mjs` — local test driver (`--dry` to preview)

## How the content works

**Phases (trust-first rollout)** — derived from `THREADS_CAMPAIGN_START`:
| Days | Phase | Content | FatHopes? |
|---|---|---|---|
| 1–3 (`THREADS_AUDIENCE_DAYS`) | audience | personal KL money/life statements first, then relatable money talk | no |
| 4–6 (`THREADS_INTRO_DAYS`) | intro | mostly money talk; FatHopes slipped in ~every other day as one tip | light |
| 7+ | fathopes | app as the natural fix, still in-voice | yes |

**Engagement ramp** — because a brand-new account should not act like an influencer:
| Days | Behaviour |
|---|---|
| 1–2 | short personal statements only; no "korang?" questions, no advice-thread energy |
| 3–4 | mostly statements; only a casual question if it feels like a friend texting |
| 5–7 | light conversation; about half the posts can invite replies |
| 8+ | community mode; reply-pulling questions are okay, still not bait |

**Moods** — most posts are the steady baseline; with probability `THREADS_MOOD_CHANCE`
(default 0.28 ≈ 1 in 3.5) a post takes on a mood: `low` (tired/"idk mayn"), `hyped`,
`ranty`, `reflective`, or `unhinged`. Keeps the feed feeling alive, not machine-made.

**Virality levers baked into the prompt** (from Threads 2026 algorithm behaviour —
replies > likes, early velocity, hook in first 2 lines):
- Hook must land in line 1 (only 2–3 lines show before "more").
- Reply questions ramp up slowly: none on days 1–2, light by day 5, normal community mode after day 8.
- One optional topic tag per post (model emits `TAG: …`, published via `topic_tag`).
- Recent posts are fed back in each run so it never repeats a hook/angle.

## One-time setup

### 1. Create the Threads account
Threads runs on an Instagram login. Make/pick the IG account you want to post as,
open [threads.com](https://www.threads.com), log in, finish the profile, and put your
loyalty-app signup link in the **bio** (posts never paste URLs — they say "link kat bio").

### 2. Make a Meta app with Threads access
This is a **separate** token from the `META_APP_TOKEN` already in env — different graph
(`graph.threads.net`), different scopes.

1. [developers.facebook.com](https://developers.facebook.com) → **Create App** → use case
   **"Access the Threads API"**.
2. In the app, add the **Threads** product. Under its permissions request:
   `threads_basic` and `threads_content_publish`.
3. App → **App roles → Roles**: add your Threads account as a **Threads Tester**, then
   accept the invite from the account's Threads settings (Account → Website permissions,
   or the invite that appears). In dev mode you can publish to your own account without
   full App Review.

### 3. Get a long-lived token + user id
- In the app's Threads settings, the **"Generate access token"** button gives you a token
  for the connected account. NOTE: in this app's setup that button already returns a
  **long-lived (60-day) token** — so the `th_exchange_token` exchange will FAIL with
  "Session key invalid" (you can't exchange an already-long-lived token). That's expected.
- Confirm it's long-lived and reset its 60-day clock with a refresh:
  ```
  GET https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=<TOKEN>
  ```
  A successful response (with a new `access_token` + `expires_in` ~5.18M sec) = it's
  long-lived. Use the returned token.
- Get your Threads user id:
  ```
  GET https://graph.threads.net/v1.0/me?fields=id,username&access_token=<TOKEN>
  ```
  (Current setup: id `25358256307205104`, username `farzmus`.)

> **Token expires in 60 days.** Refresh before then:
> ```
> GET https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=<LONG_LIVED_TOKEN>
> ```
> Update `THREADS_ACCESS_TOKEN` with the new value. (Ask to have this auto-refreshed +
> stored in Neon if you want it truly hands-off past 60 days.)

### 4. Set env vars (env.local **and** Vercel project settings)
Put these in the **same Vercel project this app deploys to** (the one that already has
`DATABASE_URL` / `ANTHROPIC_API_KEY`) — not a new project.
```
THREADS_USER_ID=<from step 3>
THREADS_ACCESS_TOKEN=<long-lived token>
CRON_SECRET=<any long random string>
THREADS_CAMPAIGN_START=YYYY-MM-DD     # day 1 of the phased rollout
# optional tuning:
# THREADS_AUDIENCE_DAYS=3             # length of the no-FatHopes phase
# THREADS_INTRO_DAYS=3               # length of the soft-intro phase
# THREADS_MOOD_CHANCE=0.28           # 0 = never moody, 1 = always moody
# THREADS_MODEL=claude-sonnet-4-6    # content model override
# ANTHROPIC_API_KEY                  # required; copy from Vercel or console.anthropic.com
```
Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>`, so setting
`CRON_SECRET` in the Vercel project is what wires the schedule to the endpoint.

## Test before you trust it
```
npm run dev
node scripts/threads-autopost.mjs --dry   # generate + preview, DOES NOT publish
node scripts/threads-autopost.mjs         # generate + PUBLISH one real post
```
Run `--dry` a few times to sanity-check the voice, then do one real publish.

## Go live
Deploy. The cron fires daily at 8pm MYT. Limit is 250 posts/account/day — nowhere near it.

**Cadence:** growth mode on Threads is 1–3 posts/day at peak windows (7–9am, 12pm, 7–9pm).
For faster audience building, add a second daily cron (e.g. morning) in `vercel.json`:
```json
{ "crons": [
  { "path": "/api/threads-autopost", "schedule": "0 0 * * *" },   // 8am MYT
  { "path": "/api/threads-autopost", "schedule": "0 12 * * *" }   // 8pm MYT
] }
```
The biggest growth lever isn't posting — it's **replying**. Spend 15 min/day replying to
others in the money/lifestyle niche; the algorithm weights reply activity heavily.

## Tuning the voice
Everything lives in `src/lib/threads.ts`: `VOICE_CORE` (KL voice + human + virality rules),
`phaseInstruction()` (per-phase steer), `MOOD_STEER` / `pickMood()` (moods). It pulls the
account's last ~15 posts each run and tells Claude not to repeat them, so posts self-vary.
