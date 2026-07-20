# MicroMentor — Figma Prototype Build Kit

Everything you need to build a clickable prototype in Figma fast. This matches the deck, so slide 8 ("seven clickable screens") stays accurate.

Frame size: **iPhone 16 / 390 x 844** (Figma has this preset under Frame > Phone). Build 7 frames, then wire them in the Prototype tab.

---

## Design tokens (set these as Figma variables / styles first)

| Token | Hex | Use |
|-------|-----|-----|
| Paper | `#ECEEF7` | app background |
| Ink | `#15182B` | headings, primary text |
| Ink soft | `#4A4F6B` | secondary text |
| Coral | `#FF5A47` | primary buttons, accent |
| Coral deep | `#E8452F` | pressed state |
| Indigo | `#4B4FA6` | links, progress, tabs |
| Indigo soft | `#E9EAFB` | selected / highlight fills |
| Highlighter | `#FFD23F` | streak, badges |
| White | `#FFFFFF` | cards |

Type: **SF Pro** (or Inter). Heading 22 Bold, card title 17 Semibold, body 15 Regular, caption 12. Corner radius: cards 16, buttons 14, chips 999 (pill).

Reusable components to make once and instance everywhere:
- **Status bar** (top, 44h): time left, battery right. Or just hide it.
- **Bottom nav** (72h, white, top border `#E9EAFB`): 4 tabs — Home, Learn, Class, You. Active tab = Indigo, others = Ink soft.
- **Card** (white, radius 16, soft shadow y6 blur20 at 8% Ink), auto-layout, padding 16.
- **Primary button** (Coral fill, white text 16 Semibold, radius 14, height 52, full width).

---

## The 7 screens (exact content)

### 1 — Onboarding · Pick your course
- Title: **"Let's set you up"**
- Sub: "Pick a course. We turn its notes into short lessons."
- 4 selectable course chips (pill, Indigo soft fill, Ink text): `Biology SB015`, `Chemistry SK015`, `Maths QS015`, `Add your own +`. One selected (Coral outline).
- Level toggle: `Beginner · Confident · Exam ready`
- Primary button: **"Continue"** → screen 2

### 2 — Today's lessons (Home)
- Greeting: **"Hi Aina 👋"**  ·  caption: "3 short lessons today. About 10 minutes."
- Streak pill top-right: `🔥 5 day streak` (Highlighter fill, Ink text)
- 3 lesson cards (white), each: small coloured square icon, title, subtitle, duration:
  - `Photosynthesis` · "The light reaction" · `3 min` (this one is the tappable demo)
  - `Cell transport` · "Osmosis basics" · `4 min`
  - `Enzymes` · "How they speed reactions" · `3 min`
- Bottom nav, Home active.
- Tap the Photosynthesis card → screen 3

### 3 — Lesson
- Top: back chevron + progress bar (Indigo, ~40% filled) + `1 of 3`
- Visual block (Indigo soft rounded rect, 180h) with a simple leaf/sun graphic or the caption "Light hits the chloroplast".
- Question: **"Where does the light reaction happen?"**
- 3 answer options (white cards, tappable):
  - `A · Mitochondria`
  - `B · Chloroplast`
  - `C · Ribosome`
- Tap any option → screen 4 (in the demo, B is correct)

### 4 — Feedback
- Big state: **"Correct ✓"** in Coral (or "Not quite" if you want a wrong-answer variant).
- Card: "**Why:** The light reaction happens in the chloroplast, in the thylakoid membrane."
- Streak line: `🔥 Streak +1` · `⭐ 20 XP`
- Callout (Indigo soft): "**Next review · tomorrow 9am** — we'll bring this back right before you'd forget."
- Primary button: **"Next lesson"** → back to screen 2 (or screen 5 to show the social loop)

### 5 — Class wall (Q&A)
- Title: **"BIO SB015 · Class wall"**
- 2–3 question cards: avatar + name + question + reply count:
  - `Faris` · "Why is water the source of electrons?" · `3 replies`
  - `Nurul` · "Anyone got a mnemonic for the stages?" · `5 replies`
- Floating Coral button bottom-right: **"Ask +"**
- Bottom nav, Class active.
- Tap the Leaderboard sub-tab → screen 6

### 6 — Leaderboard
- Title: **"This week"** · toggle `Class only` (opt-in, Indigo)
- Ranked list (opt-in framing, not shaming):
  - `1 · Aina · 320 XP` (highlighted, Highlighter accent)
  - `2 · Faris · 300 XP`
  - `3 · Nurul · 280 XP`
- Caption: "Only people who opt in appear here."
- Tap Learn tab → screen 7

### 7 — Syllabus playlists
- Title: **"Your syllabus"** · caption "Lessons mapped to BIO SB015."
- Topic rows with progress rings:
  - `Photosynthesis · 2 of 5 done`
  - `Respiration · not started`
  - `Genetics · not started`
- Tap any → screen 3. Home tab → screen 2.

---

## Prototype wiring (Prototype tab)

Set all connections to: trigger **On tap**, action **Navigate to**, animation **Smart animate**, 200ms, ease out. (Use **Instant** for tab switches.)

```
1 Onboarding  --Continue-->            2 Home
2 Home        --Photosynthesis card--> 3 Lesson
3 Lesson      --any answer option-->   4 Feedback
4 Feedback    --Next lesson-->         2 Home
2 Home        --Class tab-->           5 Class wall
5 Class wall  --Leaderboard sub-tab--> 6 Leaderboard
6 Leaderboard --Learn tab-->           7 Syllabus
7 Syllabus    --any topic-->           3 Lesson
7 Syllabus    --Home tab-->            2 Home
```

Set the **flow starting point** on screen 1 (Onboarding). Press **▶ Present** to demo the full click-through: onboard → learn a lesson → get feedback → see the class → check the leaderboard → browse the syllabus.

---

## Fastest way to build it (about 60–90 min)

1. Make the tokens (variables) and the 4 components above. This is 80% of the polish.
2. Build screen 2 (Home) fully, since its card + nav are reused. Duplicate it as the base for the others.
3. Fill in screens 1, 3–7 by swapping content into the same layout system.
4. Do all Prototype connections last, in one pass, using the map above.
5. Share link: top-right **Share > Anyone with the link can view**, then copy the **Present** link for your slide/report.

Tip for the report: screenshot each frame at 2x (Export > PNG 2x) for the storyboard and Prototype slides.
