Write or critique a Seedance 2.0 video prompt for Image-to-Video (I2V) or Start-to-End frame (S2E) modes. Use when the user wants to animate an image, build a transition between two frames, or fix a prompt that's giving jittery / off-vibe output.

# Seedance 2.0 — How to actually prompt it

## The mental shift before you write a single word

Stop describing the picture. The image already does that. **You are directing what happens next.** Talk to Seedance like you're talking to an editor on the timeline: "hold the frame, let her turn her head, then push in slowly." Not "a beautiful woman in a dress." It already sees the woman.

The single biggest rule, the one almost everyone breaks: **separate what the camera does from what the subject does.** Two sentences, never one. The moment you write "she runs as the camera shakes wildly," you've handed Seedance a blender and it gives you jitter.

## I2V — instruct the motion, lock the look

Skeleton, in this order:

1. **What the subject does** — one verb, beat by beat. Imperative voice.
2. **What the camera does** — one move. One. Pick from: hold, push in, pull out, pan, track, orbit, handheld, aerial.
3. **What stays the same** — "preserve composition and colors," or "keep wardrobe and lighting locked."
4. **Atmosphere cue** — lighting first, everything else second.
5. **Don't list** — "avoid jitter, avoid bent limbs, avoid extra fingers."

40–80 words. The image carries the rest.

**Bad (info-dump, robotic):**
> A woman with red hair in a leather jacket standing in a neon-lit alleyway, cyberpunk style, cinematic, 4k, beautiful, dramatic, fast camera movement, amazing atmosphere

**Good (directive, conscious):**
> She turns her head slowly toward the camera, exhales once, then breaks into a small smile. Camera holds fixed framing — no zoom, no pan. Neon signs flicker behind her, casting cyan and magenta across her jacket. Preserve her hair color and wardrobe. Avoid jitter and bent fingers.

## S2E — describe the journey, not the destinations

Start-to-End frame gives Seedance the first image and the last image. **It already knows where to start and where to end.** Stop describing either frame. Describe the *transition*. The verbs in between.

Skeleton:

1. **Anchor**: "@Image1 as the first frame, @Image2 as the last frame."
2. **The arc** — one sentence on the transformation. Cause and effect.
3. **The middle beats** — 2–3 things that happen between. Numbered if you want.
4. **One camera move** that supports the arc.
5. **Pacing** — "smooth," "deliberate," or "snap-cut at the midpoint." Not "fast."

**Bad:**
> Start frame shows a closed flower. End frame shows an open flower. Make a video.

**Good:**
> @Image1 as the first frame, @Image2 as the last frame. The bud trembles, splits along one seam, then unfurls petal by petal as morning light strengthens across it. Camera pushes in slowly throughout — no cuts. Pacing is patient, almost meditative. Preserve the dewdrops and stem color from the source images.

## The 8 camera moves (pick exactly one)

| Move | Use it for |
|---|---|
| Hold (fixed) | Subject does the work; portraits, dialogue, reactions |
| Push in | Emotional focus, reveal of detail, intensity ramp |
| Pull out | Reveal scale, end of a story beat, "step back" feeling |
| Pan | Scanning a room, following sideways motion |
| Track | Following a subject who is moving (walking, running, driving) |
| Orbit | Product hero shots, portraits with depth, 360 reveals |
| Handheld | Documentary feel, urgency, raw POV — micro-jitter is intentional |
| Aerial | Establishing shot, scale, landscape, opening or closing beat |

## Two traps that ruin output

**The "fast" trap.** Fast camera + fast subject + busy scene = guaranteed garbage. Pick one engine to run hot. If the subject is sprinting, the camera holds. If the camera whip-pans, the subject is still.

**The adjective dump.** "Cinematic, beautiful, epic, dramatic, 4k, masterpiece." Delete all of it. Replace with one specific reference: *"Wes Anderson symmetry,"* *"Apple keynote lighting,"* *"35mm grain, slight halation."* One concrete anchor beats ten vibes.

## The lighting cheat

If you only add one sentence, add lighting. *"Hard rim light from camera-left, deep shadow on the right side of her face."* That single line does more work for quality than every other word combined.

## VFX inline syntax

For effects that need to happen mid-clip, drop them in brackets at the moment they trigger:
> She raises her hand. [VFX: branching electric circuits pulse white-blue across her palm.] Camera holds.

## Multi-reference mode (the yaroflasher pattern)

Seedance 2.0 Pro accepts up to **12 reference images** in a single I2V run, addressed inline as `@Image1`, `@Image2`, … `@ImageN`. This is the move that separates one-shot generations from finished ad work — the entire arc of a 10–12s spot lives in one prompt with the cast and props locked in by reference.

**The pattern that yaroflasher (Yaro Flasher, founder of Motion Design School / FlashBoards) uses on his canvas:**

1. **Top of prompt — reference manifest.** One sentence per image, what it locks. Always start with `Use @Image1 as the …` and explicitly say what to preserve (face / wardrobe / car geometry / paint condition / logo).
2. **Middle — the arc.** One unbroken cinematic sentence per beat, no hard cuts, camera move per beat, pacing words.
3. **Bottom — constraints.** Hard `do not` lines for the things Seedance loves to break: blending two characters' faces, drifting paint colors, opening mouths to "speak," changing wardrobe mid-shot, adding pedestrians, branding inside the live action.

**Reference manifest skeleton:**

```
Use @Image1 as [character A's] face, hairline, [distinguishing feature].
Use @Image2 as [character A's] wardrobe only — do not use as a reference for any [other thing].
Use @Image3 as [character B's] face and wardrobe identity.
Use @Image4 only at the very end as the [logo / title] reference — never inside the live action.
Use @Image5 as the master staging backplate — preserve [composition / colors / car positions]
exactly throughout the video. The cabins are empty in @Image5; populate them as follows.
```

**Identity lock language that actually works** (use verbatim):
- "preserve [her shoulder-length wavy brown hair, white v-neck lace top, gold pendant] exactly"
- "do not blend, swap, or homogenise their looks — [one is X, the other is Y], that visual contrast is intentional"
- "preserve composition, colors, character identity, and lighting from the source images"

**What the reference image actually carries** (don't waste tokens describing what's already in it):
- The image already has the face, the wardrobe, the car. You don't need to redescribe.
- Spend the tokens on what changes — motion, beats, camera arc, the moments where Seedance might drift.

## The 2000-character ceiling

**Most upstream wrappers truncate Seedance prompts at 2000 characters.** If you write 12,000, the back end keeps the first 2,000 and silently drops the rest — usually the constraints block, which is exactly what you can't lose.

Two-version workflow:

1. **The reference doc** — long-form prose, no character limit. Write the full creative treatment in a `.md` brief. This is for you, not the model.
2. **The paste-ready prompt** — under 2000 characters, ASCII only (no em-dashes, no smart quotes, no arrows — they each cost 2–3 bytes). This is what you actually send to Seedance.

Compress in this order until under 2000:
1. Strip every adjective that isn't doing structural work ("beautiful", "epic", "cinematic" alone go first)
2. Collapse "the camera does X then does Y then does Z" into "camera arc: X → Y → Z"
3. Cut redundant constraints (if "do not blend the girls' faces" is in the arc, it doesn't need to repeat in the constraints block)
4. Replace em-dashes (—) with hyphens, smart quotes with straight quotes, arrows (→) with `to`
5. Drop the camera-language summary at the end if the beats already imply it

**Verify with `wc -c`** before pasting. Trailing newlines and BOM count.

## How to apply this

When the user asks for a Seedance prompt:

1. Ask **mode**: I2V (one image), S2E (two images, transition), or **multi-reference I2V** (up to 12 refs, full arc in one run — the yaroflasher pattern).
2. Ask **what should happen** — the action / arc — in plain English. Don't ask for adjectives.
3. Ask **the vibe anchor** — one reference (a director, a film, a brand aesthetic). Reject vibe-soup answers like "epic, cinematic, beautiful" and ask for one concrete reference instead.
4. For multi-reference: ask for the **reference manifest** — what each `@ImageN` locks (face, wardrobe, car, logo, staging backplate). Make the user assign tags before you write the prompt.
5. Build the prompt using the skeleton above. Keep simple I2V at 40–80 words; S2E at 50–100 words; multi-reference at whatever the arc requires, but **always verify under 2000 chars before handing it off**.
6. Show the prompt, then explicitly call out: which camera move you picked, which engine is "hot" (camera or subject), and what you locked with "preserve."
7. If it's a multi-reference run, also output a **paste-ready compressed version** in a separate fenced block — ASCII-only, under 2000 chars, verified with character count.

When critiquing an existing Seedance prompt:

1. Find the camera/subject conflict — flag any sentence that mixes both.
2. Count adjectives — strike anything vague ("beautiful," "epic," "cinematic" alone).
3. Find missing lighting — add one rim/key/practical light line.
4. Check for "fast" — if multiple things are fast, slow all but one.
5. Rewrite, then explain the three changes that mattered most.
