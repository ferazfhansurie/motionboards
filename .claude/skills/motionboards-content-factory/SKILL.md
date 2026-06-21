---
name: motionboards-content-factory
description: >
  5-stage UGC content pipeline for MotionBoards. Splits every campaign evenly across 5 viral
  formats (UGC Entertainment, Street Interview, Unboxing, Product Review, ASMR) using
  cinematically-structured prompt blocks (shot, action, subject, product, environment,
  lighting, camera motion, pace, palette, reference style, audio, negative) — not vague
  one-liners. Routes each format to the right MotionBoards model (Seedance 2.0, Wan 2.7,
  Veo 3.1, Cinema Studio 3.0, Nano Banana 2, GPT Image 2). Stage 1 researches trends and
  proposes 15+ paste-ready prompts. Stage 2 builds an HTML content plan. Stage 3 generates
  by format with quality-check gates. Stage 4 schedules to Meta Ads. Stage 5 renders an RM
  + USD spend report. Trigger on 'create a campaign', 'build a content plan', 'make videos
  for MotionBoards', 'generate the image pack', 'run the content pipeline', or product
  image + ads request.
---

# MotionBoards Content Factory

A 5-stage pipeline tailored to the MotionBoards canvas: **Research → Plan → Generate → Publish → Report.**

The Higgsfield Content Factory was built around one vendor's preset library. **This skill is built around MotionBoards' own model catalog** — the same models the user already pays for inside their app. Every prompt is structured for the specific model that will render it, not a generic "AI video" string.

**Content focus is UGC-first.** Every campaign defaults to an even split across five UGC formats: **UGC Entertainment · Street Interview · Unboxing · Product Review · ASMR.** Cinematic flexes (Veo 3.1 hero shots, Cinema Studio Video 3.0 narrative) are available but off by default — only fired when the user explicitly asks.

**UX is button-driven.** Every clarifying question is an `AskUserQuestion` with 2–4 concrete options. Free-form typing is reserved for product image attach, brand name, and (when offered) custom video count. Always include a smart default the user can accept with one click.

**User-facing language rule (HARD).** The user is not a developer. Do NOT narrate technical mechanics — no model IDs, no fal.ai endpoint names, no character-limit warnings spelled out, no internal split tables, no "I will now invoke the seedance prompt skill." All of that runs silently.

Send ONE clear stage banner each time a stage starts:

> **🚀 Stage [N]: [friendly name] — starting now**
> *Plain-language description of what's happening, 1–2 sentences max.*

Approved banners (use exactly these unless the user has specified custom phrasing):

| Stage | Banner |
|---|---|
| 1 | **🔍 Stage 1: Research & ideas — starting now.** Scanning what's trending this week in your product's niche across Instagram, TikTok, and YouTube, then turning the trends into 15+ camera-ready prompts for your campaign. |
| 2 | **🗂️ Stage 2: Content plan — starting now.** Building your full plan as a polished HTML document — every video mapped, every prompt cinematically structured and paste-ready into your MotionBoards canvas. |
| 3 | **🎬 Stage 3: Generate in MotionBoards — starting now.** Producing your videos one format batch at a time. I'll ask before each batch fires so you stay in control. |
| 3 (image step) | **🖼️ Image asset pack — starting now.** Generating your social posts, hero banners, and product photoshoot stills via Nano Banana 2 + GPT Image 2. |
| 4 | **📅 Stage 4: Scheduling to Meta Ads — starting now.** Setting up your campaigns and scheduling everything across the calendar you approved. |
| 5 | **💰 Stage 5: Cost report — starting now.** Compiling your MotionBoards spend (RM + USD) versus what this volume would cost via traditional production. |

Between stages: a brief "Stage [N] done — [deliverable]" line, then immediately the next stage banner if the user approved continuation. Clean narrative, not a tool log.

**Internal mechanics — keep silent.** Anywhere this skill describes "probe model availability," "delegate to seedance-prompt skill," "validate char count under 2000," "strip brand names from Seedance prompts," "register product reference image" — those are AGENT-FACING. Execute them, don't narrate them.

---

## ONBOARDING — Always run this first (SINGLE-SHOT, NO PAUSES)

> ⚠️ CRITICAL: Ask EVERY onboarding question — A, B, C, AND D — in ONE single message at the start of the session. Do NOT ask sequentially. The user should answer everything in one reply, then the pipeline runs.
>
> If the user has already provided a product image or URL in their first message, you still ask A/B/C in one message — but skip D, since the product is already in hand.

**Step A — Confirm starting stage** (button question)
- "Stage 1 — Full pipeline (needs a product image)"
- "Stage 2 — Build content plan (I have a brief)"
- "Stage 3 — Generate now (I have a plan)"
- "Stage 4 — Schedule to Meta Ads (content is ready)"
- "Image pack only — skip videos"

**Step B — Set video volume** (any number; types auto-divide proportionally)

The user picks the total. The skill auto-computes the per-format split silently.

Buttons: "20 videos" · "50 videos (Recommended)" · "100 videos" · "200 videos" · *(Other → type any number)*. AskUserQuestion always exposes the "Other" option.

Store as `[VIDEO_COUNT]`. Image asset pack count scales from this (see Stage 3 Step 5).

**Compute the per-format split silently — DO NOT announce it at this step.** The breakdown surfaces naturally inside the Stage 1 brief, framed as a consequence of trends, not a config rule.

**Default video split (5 UGC formats, even):**

| # | Format | Share | Allocation |
|---|---|---|---|
| 1 | **UGC Entertainment** (challenges, dares, blind tries) | 20% | `floor(N/5)` |
| 2 | **Street Interview** (Erewhon-style sidewalk vox-pop) | 20% | `floor(N/5)` |
| 3 | **Unboxing** (premium reveal) | 20% | `floor(N/5)` |
| 4 | **Product Review** (honest talking-head) | 20% | `floor(N/5)` |
| 5 | **ASMR** (sound-led close-ups) | 20% | `floor(N/5)` |

Distribution: `per_format = floor(VIDEO_COUNT / 5)`. Distribute remainder one-per-format starting from format 1.

Worked examples:

| Total | Entertainment | Street Interview | Unboxing | Product Review | ASMR |
|---|---|---|---|---|---|
| **20** | 4 | 4 | 4 | 4 | 4 |
| **50** (Recommended) | 10 | 10 | 10 | 10 | 10 |
| **100** | 20 | 20 | 20 | 20 | 20 |
| **17** (custom, rem 2) | 4 | 4 | 3 | 3 | 3 |

**Step C — Character reference photos** (button question — this is the BIG MotionBoards differentiator)

> Per the user's prompting north star: **real photos for characters, AI for things**. Characters come from uploaded real photos; AI generates objects/environments/backplates only.

- "Yes — I'll upload 2–4 real character photos with my product"
- "No — generate AI characters (lower fidelity, less repeatable)"
- "Hands-only / no faces (ASMR + Unboxing only)"

If "Yes," prompt: *"Drop your 2–4 character reference photos AND product image in this same message. Real photos = consistent cast across the whole campaign."*

**Step D — Get the product (image or URL) IN THE SAME MESSAGE**
The product input is the only non-button interaction in onboarding — and it's still click-based (file attach), not typing. Include this prompt alongside the AskUserQuestion buttons:

> "Attach your product image to this message OR drop a URL — that's all I need to start. If you have brand colors or logo files, drop those too."

If a product image is already attached when the skill triggers, skip D entirely.

**Single-message rule:** Send the AskUserQuestion call (A + B + C buttons) and the product/character-attach prompt in the SAME message. The user clicks + attaches, you proceed straight to the chosen stage with NO additional confirmation.

---

## MOTIONBOARDS MODEL CATALOG — capability ground truth

Every prompt in this skill targets a specific MotionBoards model. The skill picks the right model per format based on (a) what the format needs (audio? lip-sync? cinematic?) and (b) what the user has credits for.

### Video models

| Model | Best for | Duration | Audio | Char limit | Reference inputs |
|---|---|---|---|---|---|
| **Seedance 2.0** ★ | Image-to-video, multi-ref, character-consistent UGC, motion-heavy scenes | 5–10s | No (generated separately or muted) | **2,000** | Image + character ref + style ref |
| **Wan 2.7** | Synchronized audio + lip-sync, character-consistent dialogue | 5s | Yes (lip-synced) | ~3,000 | Image + audio script |
| **Veo 3.1** | Ultra-realistic cinematic, native audio, hero shots | 8s | Yes (ambient + dialogue) | ~5,000 | Image + audio direction |
| **Cinema Studio Video 3.0** | Most advanced cinema-grade, narrative, multi-shot continuity | 10s | Yes | ~8,000 | Image + storyboard |
| **Sora 2** | OpenAI cinematic, strong motion physics | 10s | Yes | ~4,000 | Text or image |
| **Kling 3.0** | Multi-shot sequences, audio sync, motion transfer | 5–10s | Yes | ~3,000 | Image + motion ref |

★ Seedance 2.0 is the workhorse for UGC. Default to it unless the format specifically needs lip-sync or hero-shot polish.

### Image models

| Model | Best for | Char limit | Reference inputs |
|---|---|---|---|
| **Nano Banana 2** (Gemini 3.1 Flash Image) ★ | Object/environment/backplate stills, character composites with real photos | **13,000** | Up to 6 reference images |
| **GPT Image 2.0** | Polished hero banners, product photography, lifestyle stills | ~4,000 | Up to 4 reference images |
| **Seedream 4** | Reference-driven product stills, on-brand consistency | ~3,000 | Up to 4 reference images |

★ Nano Banana 2 is the default for asset packs — character composites, product backplates, lifestyle scenes.

### Audio models (used for VO + ASMR sound design)

| Model | Best for |
|---|---|
| **Fish TTS** | VO, voice cloning, multi-language |
| **ElevenLabs v3** | Premium VO, ASMR sound design, emotional range |

### Hard production limits (apply to every video generated)

- **Single clip duration:** 5–10 seconds depending on model. A longer narrative is designed as a 2-clip sequence (clip A + clip B, edited inside MotionBoards).
- **Aspect ratios:** 9:16 (default for social) · 1:1 · 4:5 · 16:9 · 21:9
- **Resolution:** 720p baseline · 1080p preferred · 4K only on Cinema Studio Video 3.0
- **Always pass:** product reference image · character reference photos (if Step C = yes)

### Format → Model routing (default)

| Format | Default model | Why | Fallback |
|---|---|---|---|
| **UGC Entertainment** | Seedance 2.0 | Character-consistent, motion-heavy, cheap | Wan 2.7 if dialogue needed |
| **Street Interview** | Wan 2.7 | Lip-sync required (interviewer + stranger) | Veo 3.1 for premium lift |
| **Unboxing** | Seedance 2.0 | Hands-on motion, pacing control | Cinema Studio for premium luxury feel |
| **Product Review** | Wan 2.7 | Talking-head with audio | Veo 3.1 |
| **ASMR** | Veo 3.1 | Native audio, ambient design | Cinema Studio Video 3.0 + ElevenLabs separately |

### What MotionBoards CANNOT do (do not propose)

- ❌ Single clips longer than 10 seconds
- ❌ Multi-character coordinated dialogue with consistent identities across cuts in ONE clip (use 2-clip sequence)
- ❌ Live split-screen day-X-vs-day-Y diary in a single output (compose in canvas)
- ❌ Branded car names ("Honda Civic", "Mazda 2") in Seedance prompts → flagged as sensitive
- ❌ Reliable text rendering inside the video (use Nano Banana 2 for text-on-image, then composite if needed)

### Escape hatch for ideas the catalog can't render

If an idea genuinely needs a 30s narrative or impossible composition, label it **"Outside MotionBoards (compose in editor)"** and design it as a multi-clip storyboard.

---

## 5 UGC FORMAT DEFINITIONS — the campaign mix

Every campaign distributes evenly across these 5 formats. **For each format, the skill provides full cinematic prompt blocks (not vague one-liners) so the user can paste directly into MotionBoards' prompt bar.**

### Prompt block template (used for EVERY video, every format)

This is the core upgrade vs the Higgsfield skill — every prompt is structured, not flat. Each block is one labeled line:

```
SHOT: [shot type · lens equivalent · angle · framing — e.g. "85mm portrait, eye-level, medium close-up"]
ACTION: [present-tense verb sequence, ≤2 actions, observable not implied]
SUBJECT: [age · gender presentation · wardrobe · grooming · expression — sourced from user's character ref photo when available]
PRODUCT: [exact visual: color, packaging material, label legibility, scale relative to hand, condensation/wear state]
ENVIRONMENT: [specific location with 3 sensory details — temperature cue, light source, surface texture]
LIGHTING: [named lighting setup — Rembrandt, ring light, hairlight, motivated practical, golden hour, overhead diffused]
CAMERA MOTION: [static / push-in 5cm / dolly left 30cm / handheld micro-jitter / locked-off tripod]
PACE: [calm / urgent / staccato / slow burn — frame this as edit-feel since each clip is one continuous take]
PALETTE: [3 named or hex colors that anchor the grade]
REFERENCE STYLE: [cinematographer + film/campaign — e.g. "Lance Acord blocking, Erewhon-juice-bar aesthetic"]
AUDIO: [ambient + diegetic + music cue — only for models that support audio: Wan, Veo, Cinema, Sora, Kling]
NEGATIVE: [explicit forbidden list — text, captions, watermarks, slow-mo, whip pans, logo flash]
```

**Why this is better than Higgsfield-style "scene prompt + style cues":**
- Models render structured prompts more reliably than flat ones
- Each block is independently swappable — easy to vary scene-to-scene
- Forces the operator (the skill) to think cinematographically, not vaguely
- Consistent vocabulary across all formats means consistent visual brand

**Character limit guard (silent):**
- Seedance 2.0 → verify total prompt under **2,000 chars** via `wc -c`. If over, compress reference style + audio block first.
- Wan 2.7 → under **3,000 chars**.
- Nano Banana 2 → under **13,000 chars** (rarely an issue).

If a prompt exceeds limit, output BOTH a "long brief" (full structured block) AND a "paste-ready compressed" version under limit. User can pick.

**Brand-name strip for video prompts:**
- Strip car names ("Honda", "Mazda", etc.) and let `@productRef` carry identity.
- Strip celebrity names entirely — substitute with descriptive cast (e.g. "Korean-Malaysian woman, 28, healthcare worker vibe").

---

### Format 1 — UGC Entertainment

- **Vibe:** challenge / dare / entertainment-first. The product is the punchline, not the subject.
- **Default model:** Seedance 2.0
- **Reference inputs:** product image + 1 character photo
- **Duration:** 6–8s
- **Aspect:** 9:16

**6 fully-specified concept seeds (paste-ready):**

**1.1 — Blind Sip Challenge**
```
SHOT: Medium close-up, 50mm equivalent, eye-level, 9:16 vertical
ACTION: A blindfolded young woman takes one sip from an unmarked glass, pauses for 1.5 seconds, then her eyebrows shoot up and she mouths "wait — what IS this"
SUBJECT: From character ref photo — mid-20s woman, athleisure top, hair in low pony, no makeup
PRODUCT: Unmarked tall glass, pale-pink liquid, single ice cube. Original branded bottle visible on counter behind her, slightly out of focus
ENVIRONMENT: Bright sunlit kitchen, white quartz counter, fresh fruit bowl in soft background bokeh, morning light
LIGHTING: Natural window light camera-left, soft white wall fill camera-right, no artificial sources
CAMERA MOTION: Locked-off tripod, zero movement
PACE: Single 7-second take, real-time
PALETTE: pastel pink #F8C8C8, warm white #FAF7F2, soft sage #C7D8B7
REFERENCE STYLE: Lance Acord blocking · Erewhon-juice-bar aesthetic · single take, no edits
AUDIO: One sip swallow, ambient kitchen reverb, fridge hum bed, no music
NEGATIVE: no text overlay, no captions, no slow-mo, no whip pan, no logo flash, no music sting
```

**1.2 — "$100 to Try It" Sidewalk Dare**
```
SHOT: Wide handheld, 24mm equivalent, eye-level, 9:16
ACTION: A man holds out a $100 bill and an unlabeled bottle to a stranger. Stranger laughs, takes the bottle, takes a sip. Beat. Stranger nods, hands back the $100.
SUBJECT: Two people from character refs — interviewer 30s in cap and hoodie, stranger 20s any presentation
PRODUCT: Frosted glass bottle, condensation, label fully visible only on second beat
ENVIRONMENT: Warm late-afternoon Bukit Bintang sidewalk, motion-blur foot traffic in background, asphalt and curb visible
LIGHTING: Golden hour key from camera-right, ambient bounce off concrete
CAMERA MOTION: Handheld micro-jitter, slight push-in 10cm during stranger's sip
PACE: Real-time, 8-second single take
PALETTE: golden honey #E8B86B, asphalt grey #4A4A4A, brand color from product
REFERENCE STYLE: Erewhon Sidewalk style · cinema-vérité · Lance Acord
AUDIO: Street ambient, single laugh, sip swallow, no music
NEGATIVE: no text, no captions, no slow-mo, no transition, no music
```

**1.3 — "Will It Pour" Absurd Drop**
```
SHOT: High-angle medium, 35mm, looking down at counter, 9:16
ACTION: Hands pour the product onto a stack of pancakes. Pause. Cut to face: deadpan stare into camera.
SUBJECT: Hands-only first 4 seconds, then face cut from character ref
PRODUCT: Bottle in clear hands, glug visible, label tilted toward camera
ENVIRONMENT: White diner counter, pancakes stacked 3 high, syrup pitcher in background
LIGHTING: Overhead diffused softbox, cool 5500K
CAMERA MOTION: Locked-off, single cut at the 4-second beat
PACE: 4 seconds pour, 1 second pause, 3 seconds stare = 8s total
PALETTE: maple amber #C68642, white #FFFFFF, brand color
REFERENCE STYLE: Saturday Night Live deadpan · Wes Anderson centered framing
AUDIO: Pour glug, plate clink, deafening silence after the cut
NEGATIVE: no text, no music, no laugh track, no slow-mo
```

**1.4 — Camera Bump Disaster**
```
SHOT: Selfie-front handheld, 24mm wide, eye-level, 9:16
ACTION: Person opens product, raises it for a sip, gets bumped from frame-right (off-screen), product splashes — recovers, takes the sip anyway, smiles.
SUBJECT: From character ref, athletic-wear, gym setting
PRODUCT: Sport bottle / can, splash visible mid-frame
ENVIRONMENT: Outdoor park bench, joggers passing in soft bokeh background
LIGHTING: Mid-morning natural sun, key from camera-left high
CAMERA MOTION: Handheld with significant jitter on the bump beat
PACE: 3 seconds setup, 1 second bump, 4 seconds recovery
PALETTE: spring green #7FB069, sky blue #B5D6E0, sport-can metallic
REFERENCE STYLE: Old Spice meme · selfie-vlog vernacular
AUDIO: Park ambient, bump grunt, splash, sip, mock-shocked laugh
NEGATIVE: no text, no slow-mo of the splash, no music, no zoom
```

**1.5 — Product-Flying-In Reaction**
```
SHOT: Medium static, 50mm, eye-level, 9:16
ACTION: Person mid-conversation looks down at empty hand. Product flies in from frame-left, lands cleanly in palm. Person looks at camera, single eyebrow raise.
SUBJECT: From character ref, business casual
PRODUCT: Bottle flying in (motion blur), then static in palm, label readable on second beat
ENVIRONMENT: Modern office break room, neutral grey wall, no other products visible
LIGHTING: Overhead office fluorescent + window kicker camera-right
CAMERA MOTION: Locked-off, the only motion is the product itself
PACE: 2s setup, 1s flight, 2s reaction = 5s total tight
PALETTE: corporate grey #888, brand color, skin tone
REFERENCE STYLE: meme deadpan · The Office cold open
AUDIO: Office ambient, single "thunk" of product landing, exhaled "...okay then"
NEGATIVE: no text, no music, no slow-mo of the flight, no logo flash
```

**1.6 — Failed Backflip → Unflappable Hold**
```
SHOT: Wide locked-off, 35mm, low-angle, 9:16
ACTION: Person attempts a backflip, lands on their back, immediately sits up still holding the product perfectly upright, takes a sip.
SUBJECT: From character ref, athletic, casual streetwear
PRODUCT: Product gripped throughout the entire flip — never spills, never drops
ENVIRONMENT: Grass park, soft afternoon light, trees in background bokeh
LIGHTING: Late-afternoon golden hour, soft natural
CAMERA MOTION: Locked-off tripod, nothing else moves
PACE: 5 seconds total — flip, land, sip
PALETTE: park green, golden hour amber, brand color
REFERENCE STYLE: parkour fail compilation · GoPro deadpan
AUDIO: Grass thud, single "oof," exhaled laugh, sip, no music
NEGATIVE: no text, no slo-mo, no music, no replay
```

---

### Format 2 — Street Interview

- **Vibe:** Erewhon-style sidewalk vox-pop. Real people, real reactions, the product appears in conversation.
- **Default model:** Wan 2.7 (lip-sync needed)
- **Reference inputs:** product image + 2 character photos (interviewer + stranger archetype)
- **Duration:** 5s (Wan limit) → consider 2-clip pairing for longer
- **Aspect:** 9:16

**6 concept seeds (paste-ready):**

**2.1 — "Favorite Drink Right Now" Reveal**
```
SHOT: Medium close-up of stranger's face, 50mm, eye-level, 9:16
ACTION: Off-camera voice asks "What's your favorite drink right now?" Stranger thinks for half a beat, reaches into their tote bag, pulls out the product, holds it up.
SUBJECT: Stranger from character ref — late-20s any presentation, casual vibe
PRODUCT: Pulled from a canvas tote, label clean and readable
ENVIRONMENT: Bukit Bintang sidewalk, weekday afternoon, motion-blur passers-by
LIGHTING: Soft daylight, slightly overcast, no harsh shadows
CAMERA MOTION: Locked, eye-level, no zoom
PACE: 5 seconds, real-time vox-pop
PALETTE: warm grey city #BEBEBE, brand color, skin tones
REFERENCE STYLE: Erewhon Sidewalk · Cake Boy interview series · cinema-vérité honesty
AUDIO: Off-camera question (interviewer voice clear), ambient street, single bag rustle, stranger's "uh — this one"
NEGATIVE: no text, no music, no caption, no jump cut, no transition
```

**2.2 — "Sing for the Bottle" Bit**
```
SHOT: Medium two-shot, 35mm, eye-level, 9:16
ACTION: Interviewer holds product. Says "Sing me a 3-second jingle and you can have it." Stranger sings nonsense melody confidently. Interviewer hands over the bottle.
SUBJECT: Two people from character refs — interviewer in cap + hoodie, stranger any age
PRODUCT: In interviewer's hand, then handed across frame to stranger
ENVIRONMENT: Pavilion KL outdoor seating area, lunchtime crowd in soft background
LIGHTING: Diffused outdoor daylight, slight shade from awning above
CAMERA MOTION: Locked-off, two-shot framing
PACE: 5 seconds — request, 3-second sing, hand-off
PALETTE: outdoor mall greys, brand color anchor, warm skin tones
REFERENCE STYLE: Cake Boy NYC sidewalk · vox-pop honesty
AUDIO: Off-camera bid, stranger's confident off-key melody, soft crowd ambient, no music underneath
NEGATIVE: no text, no music bed, no laugh track, no jump cut
```

**2.3 — "Rate This Out of 10"**
```
SHOT: Medium close-up of stranger's face, 50mm, eye-level, 9:16
ACTION: Stranger takes a single sip from product. Stares into the middle distance evaluating. Says one number.
SUBJECT: Stranger from character ref, early-30s, opinionated vibe
PRODUCT: Just-opened bottle, condensation visible
ENVIRONMENT: Outside a kopitiam in PJ, weekend afternoon
LIGHTING: Bright outdoor daylight, slight backlight from sky
CAMERA MOTION: Locked-off, slight handheld breath
PACE: 5 seconds — sip, 2-second pause, "8.5" delivered flat
PALETTE: PJ pavement grey, brand color, soft skin warm
REFERENCE STYLE: Erewhon street rating · deadpan honesty
AUDIO: Single sip swallow, ambient street, stranger's voice clear, no music
NEGATIVE: no text overlay of the score, no music, no celebration sound, no caption
```

**2.4 — "Try This on a Hot Day"**
```
SHOT: Medium close-up, 50mm, slightly low angle to capture sky, 9:16
ACTION: Sweaty stranger, fanning themselves. Interviewer hands over the chilled product. Stranger takes a sip. Closes eyes. "Oh my god."
SUBJECT: Stranger from ref — exhausted urban hiker vibe, slightly sweaty
PRODUCT: Visibly chilled — heavy condensation, bottle wet
ENVIRONMENT: Open KL afternoon, blazing sun, concrete radiating heat
LIGHTING: Full midday sun, harsh shadows acceptable, key from above
CAMERA MOTION: Locked-off, slight handheld jitter
PACE: 5 seconds — handoff, sip, eye-close reaction
PALETTE: hot pavement off-white, brand color, sweaty skin warm
REFERENCE STYLE: heatwave commercial · vérité honesty
AUDIO: Cicada/traffic ambient, sip swallow, exhaled "oh my god"
NEGATIVE: no text, no music bed, no graphics, no slow-mo
```

**2.5 — "Trade Me Your Coffee"**
```
SHOT: Medium two-shot, 35mm, eye-level, 9:16
ACTION: Interviewer holds product. Stranger walks past holding a takeaway coffee. Interviewer offers a trade. Stranger laughs, swaps. Both sip simultaneously.
SUBJECT: Two from refs — interviewer + working professional
PRODUCT: Held by interviewer first, then transferred mid-frame
ENVIRONMENT: Bangsar Village morning, coffee shop signage soft in background
LIGHTING: Morning daylight, soft shadows
CAMERA MOTION: Locked-off two-shot
PACE: 5 seconds — meet, propose, swap, simultaneous sip
PALETTE: morning warm grey, coffee brown, brand color
REFERENCE STYLE: vox-pop swap-bit · honest awkwardness
AUDIO: Morning street ambient, brief negotiation chat, dual sips, soft laugh
NEGATIVE: no text, no music, no caption, no transition
```

**2.6 — Two Strangers Blind Opinion**
```
SHOT: Medium two-shot, 35mm, low-angle eye-level, 9:16
ACTION: Two strangers at a small table, both blindfolded. Interviewer (off-screen) places product in front of each. They sip simultaneously, then describe the taste in one word each.
SUBJECT: Two strangers from refs — different ages/presentations for diversity
PRODUCT: Two identical unlabeled bottles in front of each
ENVIRONMENT: Outdoor Sentul Depot bench, midday natural light
LIGHTING: Soft diffused daylight from above, shaded
CAMERA MOTION: Locked-off two-shot
PACE: 5 seconds — sip, pause, two single words
PALETTE: depot industrial grey, brand color, neutral skin tones
REFERENCE STYLE: Erewhon blind-test · Buzzfeed taste-test honesty
AUDIO: Two sip swallows synced, two single-word reactions ("clean," "real"), ambient
NEGATIVE: no text, no music, no laughter, no caption
```

---

### Format 3 — Unboxing

- **Vibe:** premium reveal energy. Hands, packaging, the discovery moment.
- **Default model:** Seedance 2.0 (motion-heavy, no dialogue needed)
- **Reference inputs:** product image + packaging photo (if available) + 1 hands-only ref
- **Duration:** 7–10s
- **Aspect:** 9:16

**6 concept seeds (paste-ready):**

**3.1 — Trio Reveal in Pastel Paper**
```
SHOT: Top-down 90° overhead, 35mm, 9:16
ACTION: Manicured hands lift a box lid. Pastel tissue paper falls away. Three product variants nestled inside, lined up perfectly.
SUBJECT: Hands-only, soft natural manicure, no jewelry
PRODUCT: Three flavor variants of the product, equal spacing, ribbon-tied
ENVIRONMENT: Cream linen table surface, dried flower in corner of frame
LIGHTING: Soft window daylight from upper-left, subtle bounce fill
CAMERA MOTION: Locked-off overhead rig
PACE: 7 seconds — lift, paper-fall (real time), product reveal hold
PALETTE: cream #F5F0E8, dusty pink #DABDB0, sage #C9D6BB, brand colors
REFERENCE STYLE: Aesop unbox aesthetic · Glossier reveal · soft natural
AUDIO: Paper rustle, single ribbon-pull squeak, no music, ambient room
NEGATIVE: no text, no captions, no music sting, no zoom, no logo flash
```

**3.2 — Single-Bottle Slow Ribbon Pull**
```
SHOT: Medium overhead 60° angle, 50mm, 9:16
ACTION: One hand grasps a satin ribbon end. Slowly pulls. Bow comes undone. Ribbon slides off. Box top lifts a few cm to reveal the bottle inside.
SUBJECT: One hand only, well-groomed
PRODUCT: Single hero bottle in matte cardboard sleeve
ENVIRONMENT: Dark walnut wood surface, single ceramic vase out of focus
LIGHTING: Single warm key from camera-right, deep falloff to the left, mood lighting
CAMERA MOTION: Static, locked-off
PACE: 8 seconds, slow burn — ribbon pull is the entire shot
PALETTE: walnut #5C4033, satin gold #B8860B, deep burgundy #5E1F1F, brand bottle color
REFERENCE STYLE: luxury fragrance unbox · Tom Ford ad · Roger Deakins low-key
AUDIO: Single satin slide sound, soft cardboard friction, deep silence underneath
NEGATIVE: no text, no music, no graphic flourishes, no fast cuts
```

**3.3 — Subscription Box Drop with Brand Note**
```
SHOT: Medium close-up, 35mm, slight overhead 30°, 9:16
ACTION: Hands open a kraft cardboard box. Lift away packing material. Product visible nestled with a hand-written note card.
SUBJECT: Hands-only, casual
PRODUCT: Single product in protective sleeve, accompanied by branded note card
ENVIRONMENT: Apartment dining table, morning light, coffee cup edge in soft background
LIGHTING: Window daylight from camera-right, ambient bounce
CAMERA MOTION: Locked-off, gentle 5cm push-in on the note reveal
PACE: 8 seconds — lift, packing-away, note reveal, product hand-pickup
PALETTE: kraft brown #B8896E, cream #F5F0E8, brand color
REFERENCE STYLE: Birchbox unbox · The Sill aesthetic · honest morning ritual
AUDIO: Cardboard friction, paper rustle, soft pickup, no music
NEGATIVE: no text overlay, no music sting, no logo zoom
```

**3.4 — Premium Gift Set with Hand-Written Tag**
```
SHOT: Medium overhead 75°, 50mm, 9:16
ACTION: Hands untie a wax-sealed twine. Twine falls away. Lift the parchment cover. Three products revealed plus a hand-written tag dangling from one bottle.
SUBJECT: Hands-only, refined
PRODUCT: Three-product gift set, sleek packaging
ENVIRONMENT: Polished marble table, dried lavender sprig in corner
LIGHTING: Single soft top key, deep negative-fill on either side, dramatic
CAMERA MOTION: Locked-off, no movement
PACE: 9 seconds — slow, ceremonial
PALETTE: marble white #F0EDEA, wax red #8B0000, brand colors
REFERENCE STYLE: Diptyque gift unbox · ritual luxury · Wes Anderson symmetry
AUDIO: Wax crack, twine slide, parchment lift, no music
NEGATIVE: no text overlay, no music, no logo flash, no zoom
```

**3.5 — Hangtag Macro Series**
```
SHOT: Macro close-up, 100mm equivalent, 9:16, super shallow DOF
ACTION: Three hangtags swing gently in slight breeze. Camera pulls focus from tag #1 to tag #2 to tag #3. Each tag has a single legible word: "ingredient," "origin," "story."
SUBJECT: No people — product hangtags only
PRODUCT: Three product bottles standing upright with hangtags from neck strings
ENVIRONMENT: Outdoor table on patio, soft afternoon breeze, natural background bokeh
LIGHTING: Late-afternoon golden hour, key from camera-right
CAMERA MOTION: Locked-off, only the focus pull moves
PACE: 9 seconds — tag #1 (3s), pull to #2 (3s), pull to #3 (3s)
PALETTE: golden hour amber #E8B86B, kraft tag beige, brand bottle color
REFERENCE STYLE: Apple product hero · macro patience · Roger Deakins falloff
AUDIO: Soft breeze, distant birds, no music
NEGATIVE: no text overlay (tag text is legible IN the shot — that's allowed), no music, no logo flash
```

**3.6 — Crate Reveal "Picked Today"**
```
SHOT: Medium overhead 60°, 35mm, 9:16
ACTION: Hands lift a wooden crate lid. Inside: product bottles surrounded by raw fresh ingredients (fruit, herbs depending on product). One hand picks up one bottle.
SUBJECT: Hands-only, hint of forearm — farmer aesthetic
PRODUCT: 4–6 bottles standing in straw or wood-chip bedding
ENVIRONMENT: Outdoor wood table, early-morning farm context
LIGHTING: Cool morning daylight, soft golden underbalance
CAMERA MOTION: Locked-off, small downward tilt at the hand-pickup beat
PACE: 9 seconds — lid lift, reveal hold, single bottle pickup
PALETTE: weathered wood #8B7355, fresh produce greens, morning blue #C8D4DD
REFERENCE STYLE: Farmgirl Flowers · farm-to-table reveal · honest agricultural
AUDIO: Wooden lid creak, straw rustle, single bottle lift, distant rooster optional
NEGATIVE: no text, no music, no slow-mo, no logo flash
```

---

### Format 4 — Product Review

- **Vibe:** honest talking-head. Bottle in hand, ingredients read aloud, ranking, side-by-side comparisons.
- **Default model:** Wan 2.7 (lip-sync required)
- **Reference inputs:** product image + 1 character photo (the reviewer)
- **Duration:** 5s (Wan limit) → most concepts are 2-clip sequences
- **Aspect:** 9:16

**6 concept seeds (paste-ready, each is a 2-clip sequence where noted):**

**4.1 — Two-Ingredient Test (single 5s)**
```
SHOT: Medium close-up, 50mm, eye-level, 9:16
ACTION: Reviewer holds bottle. Reads label aloud: "Two ingredients." Raises one eyebrow. Sips.
SUBJECT: Reviewer from character ref — 28, neutral wardrobe, no makeup
PRODUCT: Bottle held in foreground, label parallel to camera, fully readable
ENVIRONMENT: Reviewer's apartment kitchen, plant in soft background bokeh
LIGHTING: Window daylight key, soft bounce fill
CAMERA MOTION: Locked-off
PACE: 5 seconds — single take, label read, eyebrow, sip
PALETTE: apartment warm wood, plant green, brand color
REFERENCE STYLE: TikTok product reviewer authenticity · @hauschka style honesty
AUDIO: Reviewer voice clear: "Two ingredients?" Single sip swallow.
NEGATIVE: no text, no music, no graphic, no caption
```

**4.2 — Cold Side of the Fridge (single 5s)**
```
SHOT: Medium, 50mm, eye-level, 9:16
ACTION: Reviewer opens fridge. Pulls product from the back-left "cold corner." Looks at camera. "Always [variant], don't @ me."
SUBJECT: Reviewer from ref, lounge wear, late-evening vibe
PRODUCT: Pulled from back of fridge, condensation forming
ENVIRONMENT: Apartment fridge interior visible, ambient warm room behind
LIGHTING: Cold fridge interior light + warm room key, mixed temperatures intentional
CAMERA MOTION: Slight pull-back as reviewer turns to face camera
PACE: 5 seconds, conversational
PALETTE: fridge cold blue #B8D4E0, warm room amber, brand color
REFERENCE STYLE: confessional reviewer · selfie-vlog vernacular
AUDIO: Fridge open, bottle clink, voice clear, no music
NEGATIVE: no text, no music, no graphic, no transition
```

**4.3 — Side-by-Side (2-clip sequence)**
```
CLIP A (5s):
SHOT: Medium two-product, 35mm, 9:16
ACTION: Reviewer's hands place generic competitor bottle and the hero product side by side on counter. Picks up competitor.
SUBJECT: Hands + lower face only
PRODUCT: Both bottles visible, hero on right, competitor on left
ENVIRONMENT: Reviewer's kitchen counter, neutral wall behind
LIGHTING: Soft overhead diffused
CAMERA MOTION: Locked
PACE: 5s
PALETTE: kitchen neutrals, brand color
AUDIO: "So I bought both."
NEGATIVE: no text, no music

CLIP B (5s):
SHOT: Same setup
ACTION: Reviewer takes a sip from hero product. Looks at camera. "Yeah."
SUBJECT: Same reviewer, full face now visible
PRODUCT: Hero in hand, competitor still on counter
LIGHTING: Same
CAMERA MOTION: Locked
PACE: 5s
PALETTE: same
AUDIO: Sip swallow, single "yeah," ambient
NEGATIVE: no text, no music, no logo flash

EDIT IN MOTIONBOARDS: Hard cut Clip A → Clip B, no transition.
```

**4.4 — 7-Day Diary (2-clip sequence)**
```
CLIP A (5s):
SHOT: Wide, 35mm, 9:16
ACTION: Reviewer's hand sets one empty product bottle on counter. We see the camera widen — there are 6 already lined up.
SUBJECT: Hand only
PRODUCT: 7 empty bottles total, all the hero product
ENVIRONMENT: Counter, morning daylight
LIGHTING: Window key
CAMERA MOTION: Locked, but the framing reveals the line as the camera "pulls back" via a single zoom-out beat
PACE: 5s
AUDIO: Bottle set down, ambient
NEGATIVE: no text, no music

CLIP B (5s):
SHOT: Medium close-up of reviewer
ACTION: Reviewer looks at camera. "I drank one a day for a week. Here's my honest review."
SUBJECT: Reviewer from ref, full face
LIGHTING: Same window key
CAMERA MOTION: Locked
PACE: 5s
AUDIO: Voice clear, ambient kitchen
NEGATIVE: no text, no music

EDIT: A → B hard cut, captions added in MotionBoards as an OPTIONAL overlay (not in the video itself).
```

**4.5 — Beauty-Editor Mirror Review (single 5s)**
```
SHOT: Medium, 50mm, eye-level, 9:16, reviewer looks slightly off-camera (into mirror)
ACTION: Reviewer applies / uses the product (skincare, lip product, etc.). One beat hold. Single eyebrow raise.
SUBJECT: Reviewer from ref, soft natural, bathroom vanity context
PRODUCT: Held in hand, used on-camera
ENVIRONMENT: Bathroom vanity, mirror visible at edge of frame, soft tile
LIGHTING: Vanity-mirror bulbs above, even soft front
CAMERA MOTION: Locked
PACE: 5s — apply (3s), pause (1s), eyebrow (1s)
PALETTE: bathroom warm white, soft pink, brand product color
REFERENCE STYLE: beauty-editor honesty · @intothegloss aesthetic
AUDIO: Pump click or product sound, ambient room, no music, no voice (or single quiet "hm")
NEGATIVE: no text, no music, no logo flash
```

**4.6 — Final Flavor Ranking (2-clip sequence for products with variants)**
```
CLIP A (5s):
SHOT: Top-down overhead, 35mm, 9:16
ACTION: All flavor variants lined up in a row. Reviewer's hand enters frame and rearranges them — clearly ranking from worst to best.
SUBJECT: Hands only
PRODUCT: All variants, equal spacing
ENVIRONMENT: White table surface, neutral
LIGHTING: Soft overhead
CAMERA MOTION: Locked overhead
PACE: 5s
AUDIO: Bottle slides on table, no voice
NEGATIVE: no text, no music

CLIP B (5s):
SHOT: Medium, 50mm, eye-level
ACTION: Reviewer picks up the #1 ranked variant from the new lineup. "Don't @ me."
SUBJECT: Reviewer from ref, full face
PRODUCT: One variant in hand, others soft in background
LIGHTING: Same warm key
CAMERA MOTION: Locked
PACE: 5s
AUDIO: "Don't @ me." Sip. Ambient.
NEGATIVE: no text, no music

EDIT: A → B with a 100ms hold black between clips for emphasis (in MotionBoards).
```

---

### Format 5 — ASMR

- **Vibe:** sound-led close-ups. Caption only / no music / audible product handling.
- **Default model:** Veo 3.1 (native audio is the killer feature)
- **Reference inputs:** product image + 1 hands-only ref
- **Duration:** 8s
- **Aspect:** 9:16 (also produce 1:1 + 4:5 variants for IG feed)

**6 concept seeds (paste-ready):**

**5.1 — Macro Cap Unscrew + Glug Pour**
```
SHOT: Macro close-up, 100mm equivalent, 9:16, ultra-shallow DOF
ACTION: Hand twists bottle cap off — slow, deliberate. Cap lifted away. Bottle tilted. Liquid glugs into a tall glass with a single ice cube.
SUBJECT: Hand only — neutral skin tone, well-groomed but unmanicured
PRODUCT: Hero bottle, full label on, condensation visible
ENVIRONMENT: Marble surface, hint of greenery soft in background
LIGHTING: Single soft top key, dramatic falloff into deep shadow
CAMERA MOTION: Locked-off macro rig, no movement
PACE: 8 seconds — twist (2s), lift (1s), pour (5s)
PALETTE: marble white #F5F0EA, brand liquid color, ice clear
REFERENCE STYLE: ASMR oddly satisfying · Apple macro hero · Roger Deakins moody
AUDIO: Cap twist crackle, single foam pop, glass clink, slow glug pour, ice settle. NO MUSIC.
NEGATIVE: no text, no music, no voice, no graphic, no logo flash
```

**5.2 — Condensation Bead Slide**
```
SHOT: Macro, 100mm, 9:16
ACTION: Single condensation bead slides down the side of a chilled bottle. Reaches the bottom. Bottle tilts slightly toward camera, bead drops onto surface.
SUBJECT: No people, just product and bead
PRODUCT: Full bottle, frosted with condensation, label slightly obscured by frost
ENVIRONMENT: Dark slate surface, deep negative space behind
LIGHTING: Single hard rim from camera-right, very dramatic
CAMERA MOTION: Locked-off
PACE: 8 seconds — bead at top (1s), slow slide (5s), drop (1s), settle (1s)
PALETTE: deep slate #2A2A2A, water clear, brand bottle color
REFERENCE STYLE: ASMR macro · luxury cocktail commercial · Tom Ford coldness
AUDIO: Soft drip, surface ambient hum, NO MUSIC, NO VOICE
NEGATIVE: no text, no music, no voice, no fast cut
```

**5.3 — Spoon-Clink + Ice-Drop Pour**
```
SHOT: Macro slightly wider, 50mm, 9:16
ACTION: Hand drops one ice cube into a tall glass — clink. Drops a second cube — clink. Then pours product slowly over the ice.
SUBJECT: Hand only
PRODUCT: Bottle in hand, label readable
ENVIRONMENT: White marble bar, soft greenery soft background
LIGHTING: Soft overhead key, gentle bounce
CAMERA MOTION: Locked
PACE: 8 seconds — clink (1s), clink (1s), pour (6s)
PALETTE: marble white, glass clear, brand liquid
REFERENCE STYLE: ASMR cocktail · Erewhon bar · clean and bright
AUDIO: Two ice clinks distinct, slow glug pour, ambient bar room. NO MUSIC.
NEGATIVE: no text, no music, no voice
```

**5.4 — Bottle Tap + Rotate**
```
SHOT: Macro, 85mm, 9:16
ACTION: Hand lifts bottle, taps it twice on marble surface — tap, tap. Then rotates it slowly 360°, revealing label from all sides.
SUBJECT: Hand only
PRODUCT: Hero bottle, fully labeled, key visual detail visible in rotation
ENVIRONMENT: Marble surface, no background
LIGHTING: Single soft top key, even all-around for the rotation
CAMERA MOTION: Locked, only the bottle rotates
PACE: 8 seconds — tap (1s), tap (1s), 360° rotation (6s)
PALETTE: marble white, brand bottle color
REFERENCE STYLE: ASMR product worship · Apple unbox · clean macro
AUDIO: Two glass-on-marble taps, faint bottle-rotation friction, NO MUSIC
NEGATIVE: no text, no music, no voice, no graphic
```

**5.5 — Paper Rustle + Reveal (ASMR-Unboxing crossover)**
```
SHOT: Macro overhead, 100mm, 9:16
ACTION: Hand pulls back tissue paper. Paper rustles audibly. Underneath: the product, label face-up.
SUBJECT: Hand only
PRODUCT: Single bottle nestled in pastel tissue
ENVIRONMENT: Cardboard box edge visible, neutral table
LIGHTING: Single warm key from camera-right
CAMERA MOTION: Locked overhead
PACE: 8 seconds — slow paper pull (6s), reveal hold (2s)
PALETTE: pastel pink tissue, kraft cardboard, brand bottle
REFERENCE STYLE: ASMR unbox · Glossier reveal patience
AUDIO: Crisp paper crinkle the entire time, no music, no voice
NEGATIVE: no text, no music, no voice, no fast cut
```

**5.6 — Two Bottles Clinking Gently**
```
SHOT: Macro two-shot, 85mm, 9:16
ACTION: Two bottles standing next to each other on marble. Hand enters frame, gently clinks them together (cheers gesture without people).
SUBJECT: Hand only briefly
PRODUCT: Two identical hero bottles
ENVIRONMENT: Marble bar, minimal background
LIGHTING: Single soft top key, warm
CAMERA MOTION: Locked
PACE: 8 seconds — bottles still (3s), hand enters (1s), clink (1s), hold (3s)
PALETTE: marble warm white, brand bottle, soft amber light
REFERENCE STYLE: ASMR celebration · luxury liquor · Wes Anderson symmetry
AUDIO: Single gentle glass clink, ambient room. NO MUSIC.
NEGATIVE: no text, no music, no voice, no celebration sound
```

---

## STAGE 1 — Trend Research & Viral Idea Generation

> ⚠️ MANDATORY. All research from live web searches. Every idea validated against MotionBoards model capability. Default to UGC-first weighting.

### Step 0 — Probe MotionBoards model availability *(internal — silent)*

> Send the Stage 1 banner before checking. Don't list model IDs to the user.

The skill assumes the user has access to: Seedance 2.0, Wan 2.7, Veo 3.1, Nano Banana 2, GPT Image 2. If the user mentions any model is unavailable in their plan, fall back per the routing table. Otherwise proceed.

### Step 1 — Identify the product & niche *(auto-detect — DO NOT ask the user to confirm)*

The skill auto-derives everything Stage 1 needs from the product image and/or URL. There is no clarifying card.

**Auto-detection routine (silent):**

1. **From the product image**: infer category, variants, packaging style, color palette, target demographic cues.
2. **From the product URL** (if provided): `web_fetch` the page; extract product name, official category, brand voice, claims, regional cues.
3. **Niche keyword:** plain-English category descriptor.
4. **Target market:** default **"Malaysia (Klang Valley + KL)"** since the user's network is Malaysian SMEs. Override only if packaging clearly indicates a different market.
5. **Primary goal:** default **"Mixed (awareness + conversion)"**.
6. **Active models:** apply the format → model routing table.

**User-facing output — one short status line, NOT a question:**

> "Got it — looks like a [niche descriptor] with [variants if any]. I'll target a [market] audience and lean into what's actually moving in this category right now — [descriptive trend cluster: challenge clips, sidewalk vox-pops, premium unboxings, honest reviews, and audio-first ASMR pours]."

Then proceed straight to Step 2. **No AskUserQuestion at this step.**

### Step 2 — Run mandatory trend research *(internal — silent)*

> Status line "Pulling this week's trends…" is fine; no search-query enumeration.

Replace `[niche]` and `[current month year]`:

1. `[niche] TikTok trending videos this week [current month year]`
2. `viral [niche] content Instagram Reels [current month year]`
3. `[niche] YouTube Shorts trending [current month year]`
4. `[niche] brand content going viral [current month year]`
5. `top [niche] ads performing Meta [current month year]`
6. `[niche] UGC content trend [current month year]`
7. `[niche] hooks that stop the scroll [current month year]`
8. `Malaysia / Southeast Asia [niche] viral campaigns [current month year]` *(swap in for the local-market angle since target is Klang Valley)*

Extract per result: format, hook patterns, visual style, brands, engagement.

### Step 3 — Fetch at least 2 source pages (in parallel)

`web_fetch` the 2 most useful URLs. Pull specific examples, hook lines, creative patterns.

### Step 4 — Synthesize the Viral Content Brief (UGC-first, structured prompts)

**Reveal the format split naturally inside the brief — never as a config card.** Include a "Recommended Content Mix" section that names the per-format counts (e.g. "10 challenge-style UGC clips · 10 sidewalk interviews · 10 unboxings · 10 honest reviews · 10 ASMR pours") AS A CONSEQUENCE of trends.

For every idea, REQUIRED — use the **full structured prompt block** template (the 12-line block above). NOT a one-line "scene prompt." Each idea is a complete paste-ready prompt.

```
N. **[Title]** · Format: [1–5] · Model: [Seedance 2.0 | Wan 2.7 | Veo 3.1 | …]
SHOT: …
ACTION: …
SUBJECT: …
PRODUCT: …
ENVIRONMENT: …
LIGHTING: …
CAMERA MOTION: …
PACE: …
PALETTE: …
REFERENCE STYLE: …
AUDIO: …
NEGATIVE: …
---
Inspired by: [specific trend / competitor from research]
Why viral now: [specific reason tied to research]
Char count: [N chars — confirm under model's limit]
```

### Producibility self-check (before adding any idea to the brief)

1. **Duration ≤ model's max?** Seedance 10s · Wan 5s · Veo 8s · Cinema 10s. If no, design as 2-clip sequence.
2. **Model routing matches strength?** Lip-sync → Wan 2.7. Audio + ambient → Veo 3.1. Motion-heavy character action → Seedance 2.0.
3. **Character ref needed?** If user provided refs in onboarding, use them. Otherwise design for hands-only or generic.
4. **Brand-name strip applied?** No "Honda Civic," etc. in Seedance prompts.
5. **Char count under model limit?** Seedance < 2000.
6. **Forbidden patterns?** No lip-sync attempted on Seedance, no multi-character dialogue inside one clip, no off-canvas split-screen.
7. **UGC-first ratio honored?** All 5 formats are UGC family by default.

### Brief structure

- Trends table · Competitor table
- Hook patterns observed in research
- Format momentum (filtered to producible)
- **Recommended Content Mix** — per-format counts framed as trend consequence
- **15+ seed ideas** — every one a full structured prompt block
- **Cinematic upgrade slot (optional)** — one Veo 3.1 hero shot OR one Cinema Studio Video 3.0 narrative, mentioned as "we can also produce one premium hero piece if you want — costs more credits but has feed-stopping power." Off by default.

### Step 5 — Approval (button-driven)

Present the brief, then call AskUserQuestion:

> "Brief is UGC-first and producible in MotionBoards. What next?"
> - "Looks good — proceed to Stage 2 (Recommended)"
> - "Add a cinematic hero piece (Veo 3.1)"
> - "Swap one or more concept seeds"
> - "Adjust the mix ratios"

Only on user click does the skill proceed.

---

## STAGE 2 — Video Content Plan

### Goal
One HTML deliverable: the **Video Content Plan** — [VIDEO_COUNT] entries, every row with a paste-ready structured prompt. The HTML is designed to be opened, scrolled, and have prompts copied directly into the MotionBoards prompt bar.

### Steps

**1. Confirm campaign details (single AskUserQuestion call — all buttons, smart defaults)**

Auto-derive defaults from the brief and product image. Single AskUserQuestion covering only campaign-level questions:

- Campaign name → "Use auto: [Brand] [Season/Theme] Campaign [current month year]" / "Different name"
- Date range → "Next 30 days (Recommended)" / "Next 60 days" / "Next 90 days" / "Custom"
- Variants/SKUs → multiSelect listing detected variants

**Do NOT include a "preset breakdown" question.** The format split was already revealed in the Stage 1 brief.

**2. Generate Video Content Plan HTML — 5-format even split**

- [VIDEO_COUNT] videos distributed per the 5-format default: `floor(N/5)` per format.
- **Every row contains the full structured prompt block** (not a one-line description). The HTML is designed for copy-paste — each prompt block is in a `<pre>` with a "Copy" button.
- Group rows by format bucket in this order: (1) UGC Entertainment → (2) Street Interview → (3) Unboxing → (4) Product Review → (5) ASMR.
- Within each format, vary the concept seed (from the 6 listed per format) so no two videos in the same format are identical.
- Distribute dates evenly across the campaign window — interleave formats day-to-day so the feed doesn't dump 10 reviews back-to-back.
- Multi-clip sequences listed as "(1/2)" and "(2/2)" with an "EDIT IN MOTIONBOARDS" note at the end.

**3. Save the video plan HTML**

`/mnt/user-data/outputs/[brand]-motionboards-content-plan.html`

The HTML structure:

```
<!-- Title bar with brand color -->
<header>[Brand] Content Plan · [Date Range] · [VIDEO_COUNT] videos</header>

<!-- Per-format section -->
<section data-format="1">
  <h2>Format 1 — UGC Entertainment · [N] videos</h2>
  <article data-row="1">
    <h3>Video #1 · 2026-06-01 · Model: Seedance 2.0 · Duration 7s · 9:16</h3>
    <div class="caption">Social caption: "POV: you accidentally became a [niche] critic at lunch ✨"</div>
    <pre class="prompt-block" id="p1">
      SHOT: …
      ACTION: …
      [full block]
    </pre>
    <button onclick="copyPrompt('p1')">Copy prompt</button>
  </article>
  <!-- repeat -->
</section>
```

Include a tiny inline JS to make the Copy buttons work (clipboard API). Style: brand-color header band, monospace for prompt blocks, large readable font.

Present the video plan and ask for feedback via button before Stage 3.

---

## STAGE 3 — Generate Content in MotionBoards

> ⚠️ CRITICAL: Ask permission before generating EACH format batch. Do not run a full batch without explicit user confirmation.

### Goal
Walk the user through generating the videos batch-by-batch in their MotionBoards canvas. The skill itself doesn't fire fal.ai calls (that happens inside MotionBoards) — instead, the skill orchestrates: paste-ready prompts, character ref images, batch ordering, quality-check gates.

### Steps

**1. Confirm assets are uploaded to MotionBoards canvas** *(button check)*

> "Before we start — are your character ref photos and product image already loaded into your MotionBoards canvas?"
> - "Yes — all uploaded"
> - "Not yet — show me how"
> - "Skip refs, generate without"

If "Show me how": one short numbered list — "1. Open MotionBoards. 2. Drag character photos onto canvas. 3. Drag product image onto canvas. 4. They auto-tag as `@char1`, `@char2`, `@product`. Come back when done."

**2. Per-batch permission gates (REQUIRED — do not skip)**

Process the video plan in this order — one per format — asking permission before each batch:

| Order | Format | Default Model | Why this order |
|---|---|---|---|
| 1 | **UGC Entertainment** | Seedance 2.0 | High-energy, leads the campaign |
| 2 | **Street Interview** | Wan 2.7 | Lip-sync content for trust |
| 3 | **Unboxing** | Seedance 2.0 | Premium reveal moments |
| 4 | **Product Review** | Wan 2.7 | Conversion-driving reviews |
| 5 | **ASMR** | Veo 3.1 | Save-driver close-ups |

Each batch is `floor(VIDEO_COUNT / 5)` videos.

For each format batch, before generating ANYTHING in that batch, call AskUserQuestion:

> "Ready to generate the **[N] [format]** videos? (Model: [model], 9:16, audio [on/off])"
> - "Yes — generate all [N]"
> - "Start with [3] for a quality check first (Recommended)"
> - "Skip this batch for now"
> - "Change settings before generating"

If "Quality check first," walk the user through generating exactly 3 videos in MotionBoards (paste these 3 prompts), have them review, then re-ask for the remaining `[N-3]`.

**3. Per-prompt instructions to user (each video):**

For each video the user is about to generate, show in chat:

```
**Video #[N] of [TOTAL]** · Format [F] · Model: [MODEL]

In MotionBoards prompt bar:
1. Select model: [Seedance 2.0 | Wan 2.7 | Veo 3.1]
2. Attach: @product + @char1 (or as noted in SUBJECT block)
3. Aspect: 9:16 · Duration: [Ns] · [Audio: on/off]
4. Paste this prompt:

[full structured prompt block, monospace]

5. Click Generate. ETA: [X–Y minutes].
```

Wait between videos for the user to confirm "done" or "next." Don't carpet-bomb the chat.

**4. After each batch:**

- Acknowledge completion: "Batch [F] done — [N] videos generated."
- Auto-prompt next batch: "Ready for the next batch ([next format]) or pause here?"
  - "Generate next batch"
  - "Pause — review what we have"
  - "Re-do one or more from this batch"

**5. Image asset pack — auto-generated via Nano Banana 2 + GPT Image 2 (last step of Stage 3)**

After all video batches are done and approved, fire ONE permission gate to generate the image asset pack — scaled to match the campaign's video volume.

**Image pack count = `floor(VIDEO_COUNT / 5)`** — one image per five videos. Breakdown:
- **40% Social** (1:1 lifestyle) → Nano Banana 2 (better at character composites)
- **20% Hero Banner** (16:9 cinematic) → GPT Image 2 (better at polished hero)
- **20% With-People shots** → Nano Banana 2 (uses character refs)
- **20% Without-People shots** → Nano Banana 2

| Video count | Image pack | Social | Hero | With-people | Without-people |
|---|---:|---:|---:|---:|---:|
| 20 | 4 | 2 | 1 | 1 | 0 |
| 50 | 10 | 4 | 2 | 2 | 2 |
| **100 (Recommended)** | **20** | **8** | **4** | **4** | **4** |
| 200 | 40 | 16 | 8 | 8 | 8 |

> Single AskUserQuestion gate:
> "Videos done. Ready to generate the image asset pack — [N] images (mix of Nano Banana 2 + GPT Image 2)?"
> - "Yes — generate all [N] (Recommended)"
> - "Yes — but skip with-people shots (use product-only if no character refs)"
> - "Skip image pack entirely"

**Image prompt template (for paste into MotionBoards image gen panel):**

Same structured block as video, but adapted:

```
SHOT TYPE: [1:1 social / 16:9 hero / 4:5 feed]
SCENE: [single sentence — what the image shows]
SUBJECT: [character ref reference — "@char1 holding @product" / "hands only with @product" / "@product solo"]
PRODUCT DETAIL: [color, label, packaging, scale — anchor visual fidelity]
ENVIRONMENT: [specific location with 3 sensory details]
LIGHTING: [named lighting setup]
COMPOSITION: [rule of thirds / centered / negative-space top-third / overhead flat-lay]
PALETTE: [3 colors]
REFERENCE STYLE: [photographer + brand reference]
NEGATIVE: [no text overlay, no logo composites, no watermark, no Polaroid frame]
```

For each prompt, include: product description (color, packaging, label details), brand identity cues, asset's specific scene. Pass `@product` and `@char` refs as appropriate.

Save all images to `/mnt/user-data/outputs/[brand]-asset-pack/` with descriptive filenames:
- `social-01-watermelon-kitchen.png`
- `hero-02-lifestyle.png`
- `with-people-01-friends-clinking.png`
- `without-people-01-studio-trio.png`

Show the saved files and offer a final button: "All set — proceed to Stage 4 (Meta Ads scheduling)" / "Re-do specific assets" / "Pause here".

---

### Standalone image-pack mode

When the user explicitly asks for an image pack without running the full pipeline — phrases like "Generate me the full image pack," "make the static visuals," "image asset pack only" — bypass Stages 1–2 and Stage 3's video batches.

**Standalone routine:**

1. **Confirm product + character refs are uploaded to MotionBoards canvas.**
2. **Auto-detect product details** (silent).
3. **Pick the image-pack size** via single AskUserQuestion: "10 images (Light)" / "20 images (Recommended)" / "30 images" / "40 images"
4. **Fire the same image-pack generation** as Stage 3 Step 5 — same 40/20/20/20 breakdown.
5. **Save to `/mnt/user-data/outputs/[brand]-asset-pack/`**.
6. **No Stage 4 / Stage 5 follow-up** unless asked.

---

### Failure handling

If a generation fails inside MotionBoards (out of credits, model error, char-limit warning), the skill:
- Asks user to paste the error message
- Diagnoses (most common: char count, missing ref, wrong model selected)
- Offers a fixed prompt and "Retry" / "Skip" / "Switch to fallback model" buttons

---

## STAGE 4 — Schedule & Publish to Meta Ads

### Steps

**1a. Meta MCP connection check — FIRST question, always**

Before asking anything else in Stage 4, fire a single AskUserQuestion that checks whether the Meta Ads MCP is actually connected.

> "Quick check before we schedule — is your Meta MCP connected to Meta Ads?"
> - "Yes — Meta MCP is connected (Recommended)"
> - "Not connected — help me install it now"
> - "Skip the live scheduling — give me an exportable calendar instead"

**If "Not connected":** Use `search_mcp_registry` and `suggest_connectors` to surface the install card.

**If "Skip":** Drop the live integration and export `[brand]-content-calendar.csv` with columns: Date · Time · Format · Model · Video filename · Image filename · Caption · Goal · Notes. Save to `/mnt/user-data/outputs/`. Skip rest of Stage 4 and proceed directly to Stage 5.

**1b. Confirm Meta Ads campaign details (only if Meta MCP connected — single AskUserQuestion — all buttons)**

- Campaign objective: "Awareness" / "Traffic" / "Conversions" / "Mixed"
- Budget tier: "RM 2,000 / ~USD 450" / "RM 6,500 / ~USD 1,500 (Recommended)" / "RM 22,000 / ~USD 5,000" / "Custom"
- Date range: "Match the content plan dates (Recommended)" / "Next 30 days" / "Custom"

Ad Account ID detected from the Meta Ads MCP — only ask if multiple accounts.

**2. Content calendar review (button approval)**
Present the calendar, then AskUserQuestion: "Schedule looks good?" — buttons:
"Yes — schedule everything" / "Yes — but start with week 1 only" / "Adjust dates first".

**3. Create campaigns via Meta Ads MCP**
For each batch:
- Create Ad Campaign with the objective
- Create Ad Sets with targeting (audience details prompted via AskUserQuestion buttons — e.g. "Auto-target lookalike from product image" / "Use saved audience" / "Define new")
- Upload generated MotionBoards videos/images as creatives
- Schedule per the plan's dates

**4. Confirm scheduling**
Summary table by week. Final AskUserQuestion: "Scheduling done — continue to Stage 5?" buttons: "Yes — render the cost report (Recommended)" / "Pause one of the campaigns" / "Skip Stage 5 — close pipeline".

---

## STAGE 5 — MotionBoards Spend Report (RM + USD)

### Goal
Render an HTML report comparing **actual MotionBoards spend (RM + USD via the in-app pricing module)** against the **estimated cost of producing the same volume traditionally**.

### Steps

**1. Pull MotionBoards spend**

Ask the user to either (a) paste their MotionBoards usage summary from the app, or (b) provide approximate credit totals per model. Then convert using the MotionBoards pricing module rates (USD baseline + RM at current conversion).

If the user can't provide exact numbers, use these MotionBoards baseline rates (USD per generation, mid-2026):
- Seedance 2.0 (10s, 1080p): ~$0.40
- Wan 2.7 (5s, 720p): ~$0.50
- Veo 3.1 (8s, 1080p, audio): ~$1.20
- Cinema Studio Video 3.0 (10s, 4K): ~$2.50
- Nano Banana 2 (single image): ~$0.04
- GPT Image 2 (single image, 2K): ~$0.08

Convert to RM at current rate (~RM 4.40/USD as of mid-2026; query if outdated).

**2. Apply traditional production cost model (RM + USD)**

| Asset type | RM Low | RM Mid | RM High | Why the range |
|---|---:|---:|---:|---|
| UGC creator video (TikTok/Reels) | 1,100 | 3,300 | 6,600 | Creator fee + light production |
| Product Review video | 1,300 | 4,000 | 8,800 | Talent + setting + edit |
| Unboxing video | 1,300 | 3,500 | 6,600 | Box + shoot + edit |
| Street Interview video | 2,200 | 5,500 | 11,000 | Location permit + cast + crew |
| ASMR macro video | 2,000 | 5,500 | 11,000 | Macro lens day rate + edit |
| Cinema hero spot (15s) | 65,000 | 220,000 | 660,000 | Production + DOP + cast + post |
| Social post (1:1 lifestyle still) | 440 | 1,100 | 2,200 | Photographer half-day rate |
| Hero banner (16:9 cinematic) | 4,400 | 11,000 | 22,000 | Studio + retouching |
| Photoshoot WITH people | 2,200 | 6,600 | 13,200 | Half-day with talent |
| Photoshoot WITHOUT people | 880 | 3,100 | 6,600 | Studio product photographer |

Multiply by USD conversion (~RM 4.40 = USD 1) for the dual-currency view.

**Time-savings benchmark:**

| Channel | MotionBoards turnaround | Traditional turnaround |
|---|---|---|
| 50 mixed videos | 4–8 hours render time | 4–12 weeks production |
| 10 image asset pack | 30–60 minutes render time | 1–3 weeks photographer + retouch |
| Scheduling | Minutes via Meta MCP | Days of trafficking |

**3. Compute savings**

- `traditional_low / mid / high` = sum across asset types
- `motionboards_total` = sum of all generations × per-model rate
- `savings_pct_mid = 1 − motionboards_total / traditional_mid` (cap at 99.99%)
- `time_savings = traditional_weeks − motionboards_hours / (24×7)`

**4. Render the HTML report**

Save to `/mnt/user-data/outputs/[brand]-motionboards-cost-report.html`. Required sections:

1. **Hero number card** — "[Brand] [Theme] Campaign delivered for **RM X (USD Y)** instead of **RM Z–W**. You saved **N%** and **W weeks** of production time."
2. **Volume summary table** — what was generated by format
3. **MotionBoards spend breakdown** — per model: count × rate (RM + USD)
4. **Traditional cost breakdown** — same volumes priced low/mid/high (RM + USD)
5. **Side-by-side comparison** — MotionBoards total vs traditional mid vs high; horizontal bars in HTML/CSS
6. **Time savings panel** — hours vs weeks
7. **Methodology footer** — disclose: traditional costs are 2026 Klang Valley industry-average estimates; USD/RM at quoted rate; prices vary by region/agency

Visual style: brand-color header, clean data tables. Title: `[Campaign name] — MotionBoards Cost Report`.

**5. Present the report (button confirm)**

> "Cost report ready. What next?"
> - "Done — close the pipeline (Recommended)"
> - "Email this report to my team"
> - "Adjust the traditional-cost rate card and re-render"
> - "Run the pipeline again for another product"

---

## General Guidelines

- **Button-driven rule (HARD):** Every clarifying question is an AskUserQuestion call with 2–4 concrete option buttons. Free-form typing is NEVER required to navigate. Only product image upload (file attach), character ref upload, and product URL paste are acceptable non-button inputs.
- **No-pause rule:** Bundle every clarifying question into a single AskUserQuestion call.
- **5-format split (HARD):** Every campaign distributes evenly across 5 UGC formats. Allocate `floor(VIDEO_COUNT / 5)` per format; remainder starts at format 1. Cinematic flexes (Veo 3.1 hero, Cinema Studio Video 3.0 narrative) are OFF by default.
- **Real photos for characters, AI for things (HARD):** Always ask for character ref photos in onboarding. Use `@char1`, `@char2` references in prompts. AI generates objects/environments/backplates only.
- **Brand-name strip for video prompts (HARD):** Strip car names ("Honda Civic," "Mazda 2") and celebrity names from Seedance prompts — flagged as sensitive. Use generic descriptors + let `@product` carry identity.
- **Char limit verification (silent):** Always verify Seedance prompts < 2000 chars via `wc -c` (or equivalent counting). For prompts approaching 13K with Nano Banana 2, also verify.
- **Producibility rule:** Every idea must be producible inside an active MotionBoards model within its duration cap, OR explicitly labeled "Outside MotionBoards (compose in editor)."
- **Per-batch permission gate (Stage 3):** ALWAYS ask before generating each format's batch. Never auto-run the full plan.
- **Hook vs caption clarity:** A "social caption" is the post copy uploaded with the video. It is NEVER rendered as on-screen text inside the video itself.
- **Multi-variant brands:** Distribute content evenly across SKU variants within each format.
- **Visual identity consistency:** Same color palette, character refs, product reference image throughout the campaign.
- **Failure handling:** Log failed video IDs and offer "Retry / Skip / Switch model / Pause" buttons.
- **Output naming convention:** Always `[brand]-motionboards-[deliverable].html` so multiple runs don't overwrite each other.
- **Localisation defaults:** Target Klang Valley + KL by default (the user's market). Use Bahasa Malaysia caption variants where the brand identity supports it. Halal-aware framing for F&B / lifestyle brands.

---

## What changed vs the Higgsfield Content Factory

For users (or future maintainers) coming from the Higgsfield version:

1. **Model catalog** — replaced Higgsfield Marketing Studio presets with MotionBoards' actual model lineup (Seedance, Wan, Veo, Cinema, Nano Banana, GPT Image).
2. **Format → model routing** — every format now has a default model + fallback explicitly mapped.
3. **Prompts are STRUCTURED CINEMATIC BLOCKS** (12-line format) — not flat one-liners. This is the single biggest upgrade.
4. **6 paste-ready prompt examples per format** (30 total) — every concept fully specified, no operator interpretation needed.
5. **Real character photos required** in onboarding — per the user's prompting north star.
6. **Brand-name strip rule** baked in for Seedance.
7. **Char-limit validation** baked in (Seedance 2K, Nano Banana 13K).
8. **RM + USD dual currency** in the cost report (Klang Valley audience).
9. **Cost rate card calibrated to Malaysian market** rates, not US rates.
10. **MotionBoards canvas integration** — prompts are designed to paste into the prompt bar, character refs use `@char1`/`@product` syntax that matches the app.
