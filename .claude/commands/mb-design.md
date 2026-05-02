Advise on visual design decisions inside MotionBoards — UI changes, marketing pages, exports, social posts, brand applications. Use this when the user wants design feedback, is shipping a new surface, or is about to add color/typography that might fight the current system. Pairs with `/mb-overview` (codebase) and `/ad-story` (creative concepts) — this one handles look-and-feel.

# MotionBoards — Design System Advice

## The aesthetic in one sentence

> **A near-monochrome dark canvas where the only thing carrying color is the user's content.**

Every design decision in this app should reinforce that. The UI gets out of the way. The user's generated images, videos, and audio do the talking.

## The actual design tokens (from `src/app/globals.css`)

| Token | Value | What it is |
|---|---|---|
| `--background` (dark) | `oklch(0.13 0.005 270)` | The canvas. Deep, slightly purple-tinged near-black. |
| `--card` (dark) | `oklch(0.18 0.008 270)` | Panels, modals, cards — one shade lighter than canvas. |
| `--primary` (dark) | `oklch(0.7 0.18 270)` | The lavender-purple action color. Used sparingly. |
| `--secondary` / `--muted` / `--accent` | `oklch(0.24 0.01 270)` | All the same. The "neutral grey" of the dark UI. |
| `--border` (dark) | `oklch(1 0 0 / 10%)` | White at 10% opacity — soft division lines. |
| `--input` (dark) | `oklch(1 0 0 / 15%)` | White at 15% — input field borders. |
| Brand accent (markdown links) | `#f26522` | ADletic orange. The hot color. Reserved for emphasis. |
| Chart colors | `oklch(0.87 0 0)` → `oklch(0.269 0 0)` | All grayscale. No data viz uses brand color. |
| `--radius` | `0.625rem` (10px) | Base radius. `sm` 60% / `md` 80% / `lg` 100% / `xl` 140%. |
| Font stack | `-apple-system, BlinkMacSystemFont, "SF Pro Display"…` | Apple-system first. macOS / iOS native feel. |
| Mono | `"SF Mono", "Menlo", "Monaco", "Consolas"` | Same Apple-first preference. |

The light theme exists, but the canvas product is dark-mode-first. Marketing/landing pages can lean either way; the editor UI lives in dark.

## The two colors that actually carry meaning

Out of everything in the system, only **two colors** carry semantic weight:

1. **Lavender-purple `--primary`** — primary actions, generate buttons, AI agent surfaces, focus rings.
2. **Orange `#f26522`** — brand accents only. Markdown link color. ADletic logo.

Everything else is greyscale. **If you're tempted to add a third color, you're probably about to damage the system.** Resist it. The whole point of the muted UI is that the user's content is what pops.

## Typography rules

| Use | Weight | Size guide |
|---|---|---|
| Body copy | 400 / 500 | 14–16px in UI, 16–18px on marketing |
| Buttons / labels | 500 / 600 | 13–14px UI, 14–16px CTA |
| Headings | 700 | 18–22 (small), 24–32 (mid), 40–64 (hero) |
| Mono | 400 | 12–13px (file paths, code, model IDs) |

**No font additions.** SF Pro covers everything. If you feel the urge to add Inter or Söhne or whatever, the answer is "use SF Pro at a different weight." You only get a second typeface for **specific marketing surfaces** (a hero with hand-lettered display type, e.g.) and even then it should never end up in the editor.

## Spacing — the 4-step scale

Tailwind v4 default scale (4px base) is what's used. **Stick to**:

- `gap-1` (4px) — micro, between icon and label
- `gap-2` (8px) — between tightly related elements
- `gap-3` (12px) — between fields in a form row
- `gap-4` (16px) — between cards / sections
- `gap-6` (24px) — between major UI regions

Anything in between (5, 7, 9, 11) is almost certainly wrong. The product feels coherent because everything snaps to multiples of 4.

## Radius — context-driven, not arbitrary

| Element | Radius |
|---|---|
| Buttons, badges, small inputs | `rounded-md` (~8px) |
| Cards, panels, larger inputs | `rounded-lg` (~10px) |
| Full canvas board items, hero cards | `rounded-xl` (~14px) |
| Modal dialogs | `rounded-xl` |
| Pills (tags, status chips) | `rounded-full` |

**Don't mix `rounded-sm` with `rounded-2xl` in the same view.** Pick one or two from the scale, stick with them.

## Borders — invisibility as a feature

The dark UI uses `oklch(1 0 0 / 10%)` borders — *barely visible*, just enough to define edges in low light without drawing attention. **Never use a hard black or hard white border in dark mode.** Both kill the soft layered feel that lets the user's content jump forward.

For elevation hierarchy without shadows:
- Base canvas: `--background`
- Elevation 1 (panels): `--card`, no border
- Elevation 2 (modals, hover): `--card` + `border` + tiny `bg-white/5` ring
- Don't reach for box-shadow unless it's a temporary overlay (toast, tooltip)

## Iconography

- **Lucide React** is the only icon library. Don't introduce Heroicons, Phosphor, custom SVGs unless absolutely required for brand.
- Icon size: 16px (in dense UI), 20px (in buttons), 24px (in mobile primary actions).
- Stroke width: 1.5 default, 2 if the icon needs more visual weight (rare).
- Icon color: inherit from text. Don't tint icons unless they're a status indicator.

## Where to use the orange `#f26522`

The orange is **reserved**. Cheap to overuse, expensive once it's everywhere.

| Approved uses |
|---|
| ADletic agency logo |
| Markdown link color in the AI chat |
| Brand callouts on marketing pages (max 1–2 per page) |
| The "live / streaming / generating" pulse indicator |

| Forbidden uses |
|---|
| Primary buttons (use `--primary` purple) |
| Body text emphasis (use `font-weight`) |
| Borders or backgrounds at scale |
| Icon tints on regular UI |

When in doubt, the answer is "no orange." Pretend you're rationing it.

## Surface design checklist (any new screen / page / panel)

Before you ship a new surface, run this five-line check:

1. **Color test** — close your eyes, open them, count distinct colors. Should be ≤4 (background, foreground, muted, primary). If it's 5+, you've got a problem.
2. **Hierarchy test** — squint at the page. Can you tell the most important thing in 1 second? If three things compete, two of them need to dim.
3. **Density test** — is there at least one block of negative space ≥ 64px tall? Dense panels are fine; *every* panel being dense isn't.
4. **Motion test** — does anything move when nothing's happening? If yes, kill it. (Subtle pulses on "generating" status are exempt.)
5. **Mobile test** — pull the panel to 375px wide. Does anything overflow, clip, or stack ugly? Fix before merging.

## Marketing pages — looser rules

Marketing pages (`/`, `/pricing`, demos, the empty-state hero) can:

- Use larger typography variants (display weights, condensed serifs)
- Lean harder on motion (marquee text, video backgrounds, scroll-driven anims)
- Show one extra accent color *on a single page only* (a feature spotlight, e.g.)
- Use the orange more freely — but still under 10% of total visual weight

The rule: **anything you do on marketing must not bleed into the editor.** Different surfaces, different rules.

## Social and exports

For social cards, OG images, exports:

- Stick to the dark canvas + user content composition
- Brand mark goes corner, small, never centered
- Use SF Pro Display Bold for headlines on cards
- Always 9:16 portrait OR 1:1 OR 16:9 — never weird custom ratios
- Export at 2x density minimum for retina

A good MotionBoards social card has the user's generated content at 80% of the visual weight. The brand at most 5%. Copy and CTA filling the rest.

## Things to push back on

When a user (or you) is tempted to add any of the below, push back:

- **A second brand color.** "Just for this one page." It always spreads.
- **Drop shadows.** Almost always replaceable with one shade lighter on the layer above.
- **Gradients.** Used only as accents on hero text or progress states. Never a full background.
- **Skeuomorphic effects.** Glassmorphism is fine in moderation, neumorphism is dead, do not bring it back.
- **Custom font.** "Inter is more modern" — SF Pro is more native. Don't.
- **Outlined buttons everywhere.** Outlines are for secondary, ghost are for tertiary. Primary is filled.
- **Square corners.** They fight every other corner in the system.

## How to apply this

When the user asks for design feedback / a new surface / a brand application:

1. **Confirm the surface** — is this the editor (strict rules), marketing (looser), or social/export (different rules entirely)?
2. **Run the surface checklist** against their proposal (5 lines, fast).
3. **Identify the worst offender** — usually one color or one font addition that breaks the system.
4. **Propose the fix** in tokens that are already in `globals.css`. Don't introduce new tokens unless the existing system genuinely can't express what's needed.
5. **Verify the orange** is rationed. If they used it more than 1–2 times, suggest where to pull it back.
6. **Show before/after** in plain words, not just abstract advice. ("Replace the bright cyan badge with `bg-muted text-muted-foreground` and a `border-border` outline — it'll feel native instead of bolted on.")

When critiquing a screenshot or page:

1. Count colors. Flag if ≥5.
2. Count fonts. Flag if ≥2.
3. Find the orange. Flag if it's doing semantic work that should be the purple primary.
4. Run the squint test. Tell the user what jumps first — and whether that's what *should* jump first.
5. Give 3 edits ranked by impact, leading with the structural one (color/hierarchy) before the polish one (radius/spacing).

## Quick lookups

```ts
// dark canvas backgrounds
"bg-[oklch(0.13_0.005_270)]"   // base canvas
"bg-[oklch(0.18_0.008_270)]"   // card / panel
"bg-[oklch(0.24_0.01_270)]"    // muted / secondary

// borders
"border-white/10"              // soft division
"border-white/15"              // input

// brand accents
"text-[#f26522]"               // orange link
"bg-[oklch(0.7_0.18_270)]"     // primary purple
```

In Tailwind/shadcn idiomatic form, prefer `bg-card`, `bg-muted`, `border-border`, `text-primary`, etc. The arbitrary values above are only for one-off cases where the semantic token doesn't quite fit.
