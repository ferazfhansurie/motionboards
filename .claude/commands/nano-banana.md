Write or critique a Nano Banana 2 (Gemini 3.1 Flash Image) prompt for still image generation, character/object insertion, scene staging, or backplate creation. Use when the user wants to generate a keyframe for downstream video work, build a staging scene for Seedance multi-reference runs, or fix an image that drifted from intent. Pairs with `/seedance-prompt` — Nano Banana makes the keyframes, Seedance animates them.

# Nano Banana 2 — How to actually prompt it

## What it's for, what it isn't

Nano Banana 2 (NB2) is a **conversational image model**, not a stock-photo generator. Its strength is composition you can describe sentence by sentence — and editing existing images via reference. Its weakness is faithful character generation: faces drift, mouths warp, ethnicities homogenise.

**The rule that saves the most time:**

> Use NB2 for **things, environments, and staging.** Use real photos for **characters.**

If your spot needs a specific person's face, photograph them. If it needs a freshly-painted Mercedes parked at a traffic light at golden hour, NB2 nails it. Mixing the two — generating a character from scratch then trying to lock identity across a video pipeline — is where projects die.

## The composition-first prompt skeleton

NB2 reads spatial language well. Lead with the camera, then geometry, then content, then style.

1. **Camera position** — height, distance, angle. ("Low street level, three-quarter front-left, ~3 metres back, lens 35mm equivalent.")
2. **Frame geometry** — what's in the foreground, mid-ground, background. Use lane / stop-line / horizon language for streets, foreground / mid / background for interiors.
3. **Subjects** — what occupies each zone, in left-to-right or near-to-far order.
4. **Material + paint detail** — the part NB2 is *good* at. Spend tokens here. ("rugged faded sun-bleached yellow paint with visible scuffs on the upper panels and dust on the lower doors")
5. **Lighting** — direction, hour, color temperature.
6. **Style anchor** — one concrete reference. ("editorial automotive photography, late-golden-hour KL")
7. **Negative space** — what NOT to include. NB2 listens to "no people in any other vehicle" better than to vague exclusions.

## What NB2 is great at (lean on these)

- **Vehicles, paint, glass, chrome.** Physically-based material rendering is its money skill. Specify clearcoat, flake, satin vs gloss, weathering — it'll deliver.
- **Architecture and street geometry.** Stop lines, zebra crossings, traffic gantries, kerbs — describe these explicitly to anchor cars in space.
- **Lighting moods.** Golden hour, blue hour, neon backlight, harsh midday — pick one and commit. Don't blend two times of day.
- **Editorial product staging.** Three objects at a counter, four bottles on a shelf, a watch beside a cup — clean spatial layouts.
- **Iterating from an existing image.** Attach a base image and describe only what to *change*. NB2 preserves the rest.

## What NB2 is bad at (work around these)

- **Hand-lettered headlines.** Even Pro mangles cursive script kerning. **Render type in a real tool** (After Effects, CapCut, Figma) and composite over the still.
- **Identical character consistency across multiple generations.** Don't try to generate the same person twice — it won't be the same person. Use real photos for cast.
- **Crowds.** Three people max in a single beat. Beyond that, faces blur and limbs tangle.
- **Tiny text on signage in the background.** Will produce gibberish. Either accept it as background blur, or composite real text in post.
- **Symmetric reflections.** It hallucinates fake content into mirrored surfaces. If you need a clean reflection, mask and re-render.

## Iterating from an existing image (the faster path)

90% of the time, you don't want to regenerate from scratch. You want to **fix one thing** in a near-perfect output. NB2's image-reference mode preserves what you don't mention.

**The correction prompt skeleton:**

```
Use [the attached image] as the base. Preserve [list everything that worked —
character positions, paint, lighting, the building in the back] exactly.

Only change the following: [one focused list of fixes].
```

Examples of fixes that work:
- "Add a freshly painted white stop line across the asphalt at the cars' front bumpers"
- "Replace the off-screen traffic light with an overhead gantry directly above the cars"
- "Soften the shadow under the left car so it matches the lighting on the right car"

Things to avoid in correction prompts:
- Asking for more than 3 fixes in one pass — it will start drifting on the things you said to preserve
- Re-describing things that are already correct — you're just giving NB2 room to re-interpret them
- Vague language like "make it better" or "make it look more cinematic"

## The 8000-character UI cap (the practical limit)

NB2 (Gemini 3.1 Flash Image) supports 131k tokens (~524k characters) at the API level, but **most UI integrations cap inputs at 8000 characters** — which is more than you need anyway. Aim for 800–1500 characters per prompt. Beyond that, you're adding noise that pulls the generation in conflicting directions.

If your prompt is over 1500 chars, you're probably:
- Repeating the same constraint in three different ways (delete two)
- Listing 10 negative prompts (NB2 isn't great at long negative lists — keep it to 3 max)
- Describing things the image will already imply from earlier sentences

## The 3-success-criteria rule

Before generating, write down 3 things that must be true for the image to be usable. If the output fails any one, regenerate. Don't move forward with "good enough."

Example for a 3-car staging scene:
1. The two outer cars read as the **same exact car model** — paint is the only difference
2. The protagonist's car paint reads visibly **rugged / faded / weathered**, not just "yellow"
3. All three cars are unambiguously **stopped at a red light** — stop line + crosswalk in the foreground

If any of those is ambiguous, the downstream Seedance run will compound the problem.

## Negative prompting that actually works

NB2 listens to specific negative instructions, ignores vague ones.

| Works | Doesn't work |
|---|---|
| "no pedestrians, no other vehicles in the frame" | "no clutter" |
| "no text or branding on any vehicle" | "clean look" |
| "no smoke, no rain, no atmospheric haze" | "no weather effects" |
| "no characters inside any cabin — all cars are empty" | "no people" (it'll add empty bystanders) |

Always be explicit about what you don't want. NB2 fills empty spec slots with stock-photo defaults.

## When to attach reference images vs describe in words

Attach a reference when:
- You want material consistency (existing paint job, existing logo)
- You're iterating on a previous generation
- You need exact wardrobe / face for a real-photo character

Describe in words when:
- You want full creative control over composition
- You're staging a scene that doesn't exist yet
- The reference would constrain you more than help (e.g. "I want a Mercedes but not *that* Mercedes")

NB2 supports up to **3 reference images** per generation in most UIs. Beyond that, it starts averaging them in unexpected ways.

## How to apply this

When the user asks for an NB2 image prompt:

1. Ask **what role** this image plays — keyframe for video? backplate? hero still? product shot? Each has a different success bar.
2. Ask if they want to **iterate from an existing image** or **generate from scratch**. Prefer iteration if a near-fit exists.
3. Ask for the **3 success criteria**. If they can't name 3, ask leading questions until they can.
4. Build the prompt with the composition-first skeleton. 800–1500 chars target.
5. Output two things: (a) the prompt itself in a fenced block, (b) a checklist of what to verify in the output before moving on.

When critiquing an existing NB2 prompt:

1. Find the **camera position sentence**. If missing, that's the diagnosis.
2. Count adjectives. Strike anything vague. Replace with one concrete material/lighting reference.
3. Find the **negative-prompts section**. If it's vague ("no clutter"), rewrite as specific exclusions.
4. Check character count. If over 1500, suggest cuts.
5. Identify if a real photo + correction-prompt iteration would be faster than a fresh generation — and recommend that path if so.

## Default 3-line iteration block (paste-ready)

When you have a near-perfect output and want to fix the intersection / staging / one specific thing, hand the user this template:

```
Use the attached image as the base. Preserve [character positions, paint colors,
lighting, all background elements] exactly — do not redraw or re-interpret them.

Only change the following: [the one focused fix].

Maintain the same camera position, frame geometry, golden-hour lighting,
and material rendering as the base image.
```

It's about 350 characters and works ~80% of the time on the first iteration.
