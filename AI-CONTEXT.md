# AI-CONTEXT.md — Session handoff for the next AI

> Purpose: this file exists so another AI assistant can `git clone` this repo and
> pick up the full context of the work Firaz (faeez@fathopesenergy.com) has been
> doing with Claude. It summarises decisions, formulas, and live status across
> every workstream. Claude's own memory normally lives outside the repo at
> `~/.claude/projects/.../memory/` — a copy is included here under
> [`docs/claude-memory/`](docs/claude-memory/).

Last updated: 2026-06-21.

---

## 1. Who the user is

- **Firaz** — runs **ADletic Agency**, builds **MotionBoards** (this repo: an AI
  video/image generation app on fal.ai models), and does marketing for
  **FatHopes Energy** (used-cooking-oil → Sustainable Aviation Fuel).
- Produces **Malaysian-localised ad content**. Voice/captions are **KL Manglish**,
  often **~80% Bahasa Melayu** with light English mixed in.
- See [`docs/claude-memory/user_role.md`](docs/claude-memory/user_role.md).

---

## 2. FatHopes — Used Cooking Oil (UCO) collection program

FatHopes collects used cooking oil and turns it into SAF. Two public-facing arms:

- **PUSH** — recruiting men as "usahawan hijau" (green entrepreneurs / agents) who
  collect UCO with a mini-tanker. Ad promise: "EARN UP TO RM10,000". Recruitment
  ads run on Meta (see §5).
- **Community collection roadshows** — booths at malls / kampung / FELCRA padang
  where the public brings UCO and gets paid (RM2.90/kg seen at one event) +
  "Kumpul FatPoints" via the FatHopes app.

### Events completed (for recap content)
- **Cahaya Alam, Encorp Mall** — community UCO collection. **50 KG collected.**
  Co-branded with Encorp.
- **Padang FELCRA Ramuan China, Melaka** — UCO recycling event with **Madani /
  Sukarelawan Siswa (Student Volunteers)**. **115 KG collected.** Two deals closed:
  - ✅ **Koperasi FELCRA** → new collection Hub
  - ✅ **Bomba Masjid Tanah** → collection + possible future event

### Singapore branch (NEW)
- **FatHopes Energy (S) Pte. Ltd.** launched in Singapore (Tuas South Ave 3).
- Tagline: "GET PAID FOR YOUR USED COOKING OIL — Proper · Licensed · Documented."
- Benefits messaging: Higher Payout, Instant Payment, Free Collection, Proper
  Records, Eco-Friendly. Contact: WhatsApp/Call **+65 9711 1785**,
  info@fathopesenergy.com, www.fathopesenergy.com.

---

## 3. Video content formula (LOCKED)

### Event-recap videos — the house format
A repeatable **kinetic-typographic recap** built from **real event photos**:

- **9:16 vertical**, FatHopes **lime-green / white / black** brand.
- Clean **Apple-keynote motion-graphics** feel, warm & celebratory.
- **Static photos + animated infographic**: the user's strong preference is that the
  **real photos stay 100% untouched and do NOT move** — only the typographic
  infographic (cards, labels, check-marks, the big stat number) animates.
- **Hero stat card**: the KG-collected number scales up hard on the strongest beat
  (e.g. `50KG`, `115KG`). Big numbers read reliably; long text warps.
- **Deal wins** shown as animated check-mark rows.
- Copy = **Manglish, ~80% Melayu** (e.g. "minyak terpakai dikumpul hari ni!",
  "Koperasi FELCRA jadi Hub kutipan baru", "Jumpa lagi, Melaka!").
- **Recaps have NO CTA** (just a "Terima kasih / Jumpa lagi" sign-off). The
  Singapore *launch* video DID end on a CTA + contact card.

### Tooling: Seedance 2.0
- Model used on MotionBoards: **`Seedance 2.0 Omni`** (multi-image, **bracket**
  syntax `[Image1] [Image2]…`, up to 9 refs). Basic `Seedance 2.0 I2V` = 1 image.
- **2000-character ceiling** on prompts — always verify with `wc -c`, ASCII only
  (no em-dashes / smart quotes / arrows). See
  [`docs/claude-memory/feedback_seedance_charlimit.md`](docs/claude-memory/feedback_seedance_charlimit.md).
- **CRITICAL LEARNING:** Seedance (and any generative video model) **re-renders
  every frame, so it CANNOT keep real people's faces pixel-identical** — it morphs
  them. For recaps that must use the *actual* photos of real people:
  1. Best fidelity within Seedance = **one image per beat** (single ref) so the model
     has nothing to blend, then stitch beats in an editor.
  2. **Guaranteed-exact route = NOT Seedance**: build in **CapCut / After Effects**
     (Ken-Burns-off static photo + animated text overlays) or an **animated HTML**
     page that's screen-recorded. Photos stay literally untouched; Malay text + the
     stat number are always correct.
- Draft prompts produced this session live in the scratchpad (not committed):
  Singapore launch, Cahaya Alam 50KG, FELCRA Melaka 115KG (5-img, 3-img, and
  single-image-volunteers variants).

### Other prompting references in memory
- `reference_yaroflasher.md` — the multi-ref Seedance prompting north star.
- `feedback_real_photos_for_characters.md` — real photos for characters, AI only for
  objects/environments. `feedback_nano_banana_2k_chars.md` — NB2 ≈ 13K char cap.
- `feedback_no_branded_cars_in_video_prompts.md` — strip car brand names (Seedance
  flags them).

---

## 4. PUSH recruitment poster prompts (Nano Banana 2)

A set of **5 paste-ready NB2 poster prompts** was produced (9:16 recruitment posters,
"usahawan hijau", Manglish + light **Kelantan dialect** — keep "GOMO/DEMO/KELATE"
spellings exact). Each uses: a style-template ref + a real PUSH-people photo
(`public/fathopes/PUSH-people/…`, which is **gitignored** as large footage) + the
FatHopes logo. Rule: **never AI-generate the people** — real men + real lorry only;
NB2 builds background/typography around them.

---

## 5. Meta Ads (connected via MCP)

- Connected account: **"Disable acc"**, ID **`725484841474739`**, currency **MYR**
  (Malaysia). Note: a separate **FatHopes Singapore (SGD)** ad account is NOT
  accessible under the current Facebook login.
- The MCP exposes **campaign management + analytics only** — it **cannot pull raw
  lead-form submissions** (names/phones). For actual PUSH applicant data use Meta
  **Leads Center / Instant Forms CSV**, a CRM/Zapier pipe, or the `/leads` Graph API.

### Audit done this session (last 30 days)
- **105 "active" campaigns but only 8 actually spent** (~MYR 1,615 total). The other
  ~97 are dormant clutter (not costing money but hard to read).
- **Lead-objective campaigns beat traffic (LINK_CLICKS) campaigns** on cost per
  application. Traffic campaigns were the biggest spenders with **0 trackable leads**.
- 🏆 **PUSH Week 37 – Targetted to Kelantan** = best in account: **~RM0.99 CPL,
  5.28% CTR** — but underfunded (RM30/day, only ~RM8.88 delivered). **SCALE THIS.**
- **PUSH Week 37 – Copy 2** = volume engine: 168 leads at **RM3.15 CPL**. Keep/scale.
- **KILL list:** PUSH Week 35 (LINK_CLICKS, RM500, 0 leads), RANGER Week 37 (LEADS but
  0 leads, 0.70% CTR — broken creative), Recycler Week 21 (old), PUSH Week 34 (old).
- Recommended: pause the 4 kills, move ~RM775/mo into the Kelantan + Copy 2 lead
  campaigns. **Not yet executed — awaiting user go-ahead.**

### Application-data tallies (from Meta lead ads, pasted manually)
Format the user likes: `<date> — <N> applications for PUSH (<D> D, <rest> GDL & E-Full)
Kelantan : <n> Johor : <n>`. Logic: **D** = D-licence only; **GDL & E-Full** = anyone
with GDL or E-Full; dedupe by phone number. Applicants concentrated in **Kelantan,
Johor, Melaka** — which is why the Kelantan-targeted ad set performs best.

---

## 6. PUSH Life — mockumentary series (separate content stream)

Office/Parks-&-Rec-style single-cam comedy for the PUSH/UCO world. Tone bible + cast
in [`docs/claude-memory/project_pushlife_office_sitcom.md`](docs/claude-memory/project_pushlife_office_sitcom.md).
Call sheets exist (PUSH Life Ep1 "Hantu"; In The Field × Trash Hero KL). Grounded in
the real oil-collection world, NOT generic gen-z skits. See also
`feedback_content_genz_funny_serious.md`.

---

## 7. Google Ads — MCP integration IN PROGRESS (not finished)

Goal: connect Google Ads (server: `git+https://github.com/googleads/google-ads-mcp`)
so the AI can read/manage the FatHopes Google Ads account.

- **pipx installed** (runtime). Config will launch via `python -m pipx run …` to dodge
  PATH issues. Target file: `.mcp.json` (which is gitignored — see §8).
- Values gathered so far:
  - **MCC (Manager) account ID:** `162-977-0601` (use digits-only `1629770601` as
    `login-customer-id`). The user created their own Manager account because **API
    Center only appears on Manager accounts**.
  - **Developer token:** obtained from the MCC's API Center. **NOT stored in this repo
    (secret).** ⚠️ It was pasted in chat once — user should **regenerate it** in API
    Center to be clean. Likely still **Test access** (sandbox) until **Basic access**
    is approved (1–2 day Google form) → live data won't return until then.
  - **GCP Project ID:** ❌ STILL NEEDED. The user kept landing on the **Organization**
    ID (`714912879699`) by mistake — that is NOT a project. Next step: Cloud Console →
    project picker → **"All"** tab → row where **Type = "Project"** → copy that ID
    (string like `fathopes-ads-xxxxx`), or create a New project + enable Google Ads API.
  - **OAuth Client ID/Secret:** created (Desktop app). Secret must be filled directly
    into `.mcp.json` by the user, never pasted in chat.
- The FatHopes Google Ads account access: user **has access** and was guided to
  **accept the manager link** (FatHopes account → Admin → Access and security →
  Managers → Accept). Requires Admin-level access on that account.
- **Remaining to finish:** get Project ID → write `.mcp.json` entry → user does
  one-time browser OAuth Authorize → (apply for Basic access for live data).

---

## 8. Repo / git notes

- Pushed to `origin` = https://github.com/ferazfhansurie/motionboards (branch `main`).
- **Intentionally NOT committed / gitignored:**
  - `.mcp.json` — will hold Google Ads secrets; keep out of git.
  - `.claude/settings.local.json`, `.claude/scheduled_tasks.lock` — local-only.
  - `src/components/board/.next/` — build output.
  - `adleticagency/` (108M) and `adletic-inbox/` — **separate nested git repos**,
    not part of MotionBoards.
  - `/public/fathopes/`, `/fathopes-footages/` — large source footage (regenerate
    with `scripts/sync-fathopes-media.mjs`).
- This repo is "**not the Next.js you know**" — read `AGENTS.md` and the bundled docs
  in `node_modules/next/dist/docs/` before writing app code.

---

## 9. How to use this file (next AI)

1. Read this file + [`docs/claude-memory/`](docs/claude-memory/) for full context.
2. For video tasks → follow §3 (static photos, Manglish 80% Melayu, Seedance Omni
   under 2000 chars, but use an editor when real faces must stay exact).
3. For Meta Ads → account `725484841474739`; the kill/scale plan in §5 is pending.
4. To finish Google Ads → §7, the blocker is the **GCP Project ID**.
