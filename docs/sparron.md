# Sparron — FatHopes Energy AI social media manager

Sparron watches the FatHopes Energy Facebook Page + Instagram and replies to
comments and DMs in the FatHopes voice (KITA for us, "cik" for the customer),
across four surfaces:

- Instagram comments
- Instagram DMs
- Facebook Page comments
- Facebook Messenger

She runs on a cron (`/api/sparron`, every 5 min) so replies land **inside
Meta's 24-hour messaging window** — the reason the always-on service exists.

## How she decides (hybrid autonomy)

Every new message is triaged by Claude into one of two buckets:

- **auto** — safe to send herself: banter, thanks, "how does it work",
  where/when a centre or event is, the price *mechanism* (kadar semasa, never a
  number), how to join PUSH, simple product questions.
- **hold** — parked as a **draft for you to approve**: complaints, payment
  disputes, press, business/partnership proposals, anything needing a specific
  number / exact address / commitment we can't verify, legal, spam, or anything
  ambiguous.

She also writes a suggested reply for the held ones so you just approve/edit.

## Thread-aware + loop guard

- She looks at the **last message in each thread**. If it's from someone other
  than us, it needs a reply — so a reply *to her reply* re-triggers her and she
  continues the conversation; once she's had the last word she goes quiet.
- **Reply cap:** up to `SPARRON_REPLY_CAP` (default **3**) of her own replies in
  a thread within a rolling `SPARRON_CAP_WINDOW_HOURS` (default **24h**), then
  she stops and hands the thread to a human (queued as a draft). Stops runaway
  public back-and-forth with a chatty commenter or troll, without muzzling a
  genuine ongoing DM relationship.
- **Dedupe:** every reply is logged (`mb_sparron_log`), so a double cron tick
  can't double-post the same message.
- **Freshness:** on first deploy she won't necro-reply the whole back-catalogue
  — only messages newer than `SPARRON_MAX_AGE_HOURS` (default **72h**).

## Environment

Reuses the existing Meta + Anthropic setup — no new tokens to mint:

| Var | Required | Default | Purpose |
|---|---|---|---|
| `META_APP_TOKEN` | yes | — | Long-lived Meta USER token (already set). Page token derived per run, never persisted. |
| `ANTHROPIC_API_KEY` | yes | — | Triage + reply generation. |
| `CRON_SECRET` | yes | — | Gates `/api/sparron` and the drafts route. If unset, the endpoints are disabled (fail closed). |
| `DATABASE_URL` | yes | — | Neon — stores the reply log + draft queue. |
| `SPARRON_AUTONOMY` | no | `hybrid` | `hybrid` \| `draft` (hold everything) \| `auto` (send everything). |
| `SPARRON_REPLY_CAP` | no | `3` | Max Sparron replies per thread in the window. |
| `SPARRON_CAP_WINDOW_HOURS` | no | `24` | Rolling window for the cap. |
| `SPARRON_MAX_AGE_HOURS` | no | `72` | Ignore inbound messages older than this. |
| `SPARRON_MEDIA_SCAN` | no | `10` | Recent media/posts scanned for comments per run. |
| `SPARRON_MODEL` | no | `claude-sonnet-4-6` | Model for triage + replies. |
| `FATHOPES_PAGE_ID` | no | `102967319775538` | FatHopes Energy FB Page (IG derived from it). |

Token scopes required (already present on `META_APP_TOKEN`):
`pages_messaging`, `pages_manage_engagement`, `pages_read_engagement`,
`pages_read_user_content`, `instagram_manage_comments`,
`instagram_manage_messages`, `instagram_basic`.

## Endpoints

- `GET /api/sparron?secret=<CRON_SECRET>` — run one sweep.
- `GET /api/sparron?secret=<CRON_SECRET>&dry=1` — **dry run**: triage + queue
  drafts but send nothing. Use this to preview her voice and auto/hold calls
  before going live.
- `GET /api/sparron/drafts?secret=<CRON_SECRET>` — list pending drafts (the
  approval queue).
- `POST /api/sparron/drafts?secret=<CRON_SECRET>` with
  `{ "id": "...", "action": "approve"|"reject", "text": "optional edit" }` —
  approve (sends it live, your `text` edit wins) or reject a draft.

## Cadence & Vercel plan

`vercel.json` schedules `/api/sparron` at `*/5 * * * *` (every 5 min). Per-minute
crons require **Vercel Pro**. On the Hobby plan crons run at most once/day and
you're limited to 2 cron jobs — in that case remove the cron entry and instead
ping the endpoint from an external scheduler (cron-job.org, GitHub Actions,
etc.):

```
curl -s "https://<your-domain>/api/sparron?secret=$CRON_SECRET"
```

## Going live safely

1. Deploy, then **dry-run** first:
   `curl "https://<domain>/api/sparron?secret=$CRON_SECRET&dry=1"` — inspect the
   returned `items[]` (each shows the incoming message, her draft, and the
   auto/hold decision).
2. Check the draft queue: `GET /api/sparron/drafts`.
3. When happy, let the cron run for real (drop `dry=1`). Start in `hybrid`;
   switch to `auto` only once you trust her calls, or `draft` if you want to
   approve everything.

## Notes / limits

- **24h window:** standard DM replies only send within 24h of the person's last
  message. The 5-min cron keeps new DMs well inside it. A stale backlog (older
  than 24h) can't be answered via API — reply in Meta Business Suite manually,
  or request the `HUMAN_AGENT` App-Review feature for a 7-day window.
- **IG DMs edge** is heavy and occasionally rate-errors; collection is
  best-effort per surface (one flaky edge won't sink the run) and retries next
  tick.
