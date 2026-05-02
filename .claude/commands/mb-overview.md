Codebase orientation for MotionBoards. Use this at the start of any non-trivial task so you don't waste turns rediscovering the architecture.

# MotionBoards — codebase map

A Next.js 16 (App Router, Turbopack) creative canvas where users generate AI images / videos / audio via 30+ models and stitch them together visually. Auth + payments are real (Stripe + Neon Postgres + Vercel Blob/R2 storage). Deployed to Vercel Pro.

## The 90-second tour

| Concern | Lives in |
|---|---|
| **Canvas + items** | `src/components/board/canvas.tsx` (root) → `board-item.tsx` (single item) |
| **Prompt bar (manual mode)** | `src/components/board/prompt-bar.tsx` — `handleGenerate` is the heart |
| **AI Agent panel** | `src/components/board/ai-prompt-panel.tsx` — chat UI + tool dispatcher |
| **Zustand store** | `src/lib/store.ts` — items, panels, AI agent mode, autosave to localStorage + IndexedDB + `/api/boards` |
| **Model catalog** | `src/lib/models.ts` — single source of truth. Adding a model = one entry. |
| **Pricing module** | `src/lib/pricing.ts` — markup calc, USD→RM conversion. See `/mb-pricing`. |
| **Agent tool registry** | `src/lib/agent-tools.ts` — one entry per tool. See `/mb-add-agent-tool`. |
| **In-house event tracking** | `src/lib/track.ts` (client) + `src/app/api/track/route.ts` (write) + `mb_events` table |
| **Funnel admin page** | `src/app/logs/logs-client.tsx` + `/api/admin/funnel/route.ts` |

## API routes that matter

```
src/app/api/
  generate/                  start a generation (sync providers + async kickoff)
  generate/status/           poll async generations (Veo, Sora, Seedance, Replicate)
  ai-prompt/                 ADletic AI chat — Claude Haiku 4.5, NDJSON tool-use stream
  stripe/subscribe/          monthly subscription checkout (price built dynamically)
  stripe/topup/              one-off credit top-ups
  stripe/webhook/            grant credits / activate subscription on payment success
  admin/funnel/              registration funnel + revenue + impressions metrics
  track/                     write events to mb_events
  files/[id]/                serve binary blobs from Neon
```

## Provider routing inside `/api/generate`

The route branches on `modelInfo.provider`:
- `gemini` — image (sync) or video (async, Vertex AI preferred)
- `openai` — Sora video (async), gpt-image-2 (sync), TTS (sync)
- `replicate` — async via Replicate predictions
- `segmind` — sync
- `fish` — voice clone + TTS, sync 2-step
- `byteplus` — Seedance video, async
- `comfy` — ComfyUI cloud, async

Veo uses dedicated env vars (`GEMINI_VEO_*`); Nano Banana uses shared `GEMINI_API_KEY`.

## Key invariants

- **Generations are charged AFTER success**, not upfront. See `chargeForGeneration` in `db.ts`. Pre-flight check uses `estimateChargeForModel` from `pricing.ts`.
- **Async items resume on page refresh**: any item with `status: "processing"` + `requestId` + `pollProvider` is picked up by `prompt-bar.tsx`'s mount-time poller.
- **Two paths run generations**: manual (prompt-bar `handleGenerate`) and AI Agent (`runAgentGeneration` in `lib/agent-generation.ts`). The agent path is simpler — accepts URLs directly, skips canvas-tagged refs.
- **Mobile is first-class**. AI panel goes full-screen, minimap is collapsed by default, all drag/resize use `onPointerDown` not `onMouseDown`. See `/mb-ios-checklist`.

## Settings model

User-level prefs live in:
- `mb_users.settings` (JSONB) — accessed via `getUserAIInstruction` / `getUserAIModel` etc. in `db.ts`
- `localStorage` — UI prefs (panel widths, AI agent mode, minimap state)
- Zustand store — runtime state, autosaved to localStorage + `/api/boards`

## Stack notes

- TypeScript strict, no path aliases beyond `@/`
- Tailwind v4
- Drizzle-style raw SQL via `@neondatabase/serverless` (not an ORM)
- Stripe SDK 2026-02-25.clover api version
- Anthropic SDK ≥ 0.89 for ADletic AI
- Lucide icons throughout (`lucide-react`)
- Markdown via `react-markdown` + `remark-gfm` + `remark-breaks`

## When working in this codebase

- **Run `npx tsc --noEmit 2>&1 | grep -E "^src/"`** after any non-trivial edit. The `^src/` filter excludes the sibling `adletic-inbox/` project that's checked into the same folder and has unrelated TS errors.
- **Don't `git add -A`** — sibling repos `adletic-inbox/` and `adleticagency/` are not part of this project. Add specific files.
- **iOS Safari is in the test matrix.** Anything that uses `onMouseDown`, `IntersectionObserver` inside CSS transforms, or relies on `<img loading="lazy">` will break there. See `/mb-ios-checklist`.
- **No emojis in code/files** unless the user explicitly asks. UI emojis are fine when they're part of the design.
