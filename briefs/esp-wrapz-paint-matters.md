# ESP Wrapz — "Your car's paint matters" (the Punchline Reveal cut)

A 14-16s cinematic editorial automotive ad, single Seedance 2.0 I2V multi-reference run.
Concept: same exact car, paint is the only difference. The protagonist's beat-up Civic
becomes a chameleon-wrap show-off via remote-control reveal. The rival's freshly-wrapped
emerald Civic suddenly looks like yesterday's flex.

## Lead emotion triangle

- **Surface:** Pride (the remote reveal)
- **Gut:** Reinvention (same car, new identity)
- **Engine:** Quiet confidence pivoting into playful triumph

The rival ends frozen at a green light. That's the punchline.

## Reference manifest (6 images total — Seedance 2.0 Pro caps at 12)

| Tag | Source | What it locks |
|---|---|---|
| @Image1 | uploaded — glasses + grey crew-neck tee, light goatee | **Protagonist** — relatable everyday KL guy |
| @Image2 | uploaded — full editorial portrait: cream ribbed-knit V-neck polo, gold pendant, taupe pleated wide-leg trousers | **Rival** — polished, "already won" energy |
| @Image3 | uploaded — ESP WRAPZ logo | End-card brand only |
| @Image4 | sourced real photo — short-haired girl, white v-neck | Middle car driver |
| @Image5 | sourced real photo — pink-hijab girl, floral dress | Middle car passenger |
| @Image6 | NB2-generated | Three-car staging backplate, all cabins empty |

**Cast pivot note (May 2):** Firaz pulled himself out of the cast after Seedance's safety classifier kept flagging the run. The new protagonist (glasses guy) reads cleaner for the underdog narrative, and the new rival (beige polo) reads cleaner for the "polished, already won" foil. No jersey wardrobe needed — protagonist wears his own grey tee from @Image1.

## Staging

```
[ EMERALD CIVIC ]    [ WHITE MAZDA 2 ]    [ RUGGED YELLOW CIVIC ]
     left                middle                  right
     rival               the girls               protagonist
   freshly wrapped     distinct silhouette      same Civic, faded
```

Both Civics must read as **the SAME exact car model** — same generation, trim, grille,
headlights, wheels, mirrors. Paint is the only variable. The Mazda 2 sits between them
to keep the eye reading three lanes cleanly.

## Story beats (14-16s arc)

| t | Beat |
|---|---|
| 0.0–1.5s | Wide establish — 3 cars at red light, golden-hour KL |
| 1.5–3.5s | Connection — girls + protagonist eye contact, "hey" |
| 3.5–5.5s | Mercedes-rival reveal — emerald Civic glides in on the left |
| 5.5–7.0s | Shift — rack focus, girls' gaze pulls to the emerald paint |
| 7.0–8.0s | REMOTE — close-up, matte black slim remote, chrome button, half-smile |
| 8.0–9.5s | WRAP-ON WAVE — chameleon roll across the rugged yellow hatch |
| 9.5–11.0s | Girls turn BACK — gaze rips off the rival, smiles re-bloom warmer |
| 11.0–12.0s | Protagonist reaction — relaxed grin, "noted" |
| 12.0–14.0s | Light turns green; chameleon Civic + Mazda 2 drive off; rival frozen |
| 14.0–16.0s | DRONE RISE — overhead aerial, "Your car's paint matters." writes on |

## Hard constraints (the things Seedance loves to break)

- The two Civics must remain visibly the SAME car model from start to finish
- The protagonist's yellow paint stays rugged until the chrome button is pressed; then locks chameleon for the rest of the video — no flicker, no drift, no partial revert
- The rival's emerald Civic does NOT move when the light turns green — must remain stationary while the other two cars accelerate away
- No spoken mouth movement — all reactions implied through expression and posture
- No pedestrians, no other vehicles, no atmospheric haze, no smoke
- No ESP Wrapz branding inside the live action — branding only at the end card
- No identifiable real-world celebrity faces

## Production order

1. Source @Image5 + @Image6 (the girl photos — real, daylight portraits, neutral background)
2. Generate @Image7 in Nano Banana 2 — the 3-car staging backplate (use the prompt in `esp-wrapz-nb2-staging.txt`)
   - Iterate hard until: both Civics are obviously the same car, paint contrast is unmistakable, all cars are clearly stopped at the light
3. Upload all 7 references on the MotionBoards canvas
4. Run Seedance 2.0 I2V with the master prompt in `esp-wrapz-seedance-master.txt` (verified under 2000 chars)
5. Title card and audio touch-up in CapCut / After Effects

## Audio recommendation

Seedance audio toggle ON. Ambient KL street, distant traffic, a single low-end drop on
the chameleon wave reveal. No voice-over. The line "Your car's paint matters." appears
only as the hand-lettered title at the end.

## What to test if Run A doesn't land

If Seedance fights the duration cap, split into:
- **Run A** — establish through girls-turn-back (~9s)
- **Run B** — light-green through drone + title (S2E from last frame of A, ~6s)

Stitch in CapCut on the protagonist reaction beat.

## Files in this brief

- `esp-wrapz-paint-matters.md` — this treatment
- `esp-wrapz-nb2-staging.txt` — paste-ready NB2 prompt for @Image7
- `esp-wrapz-seedance-master.txt` — paste-ready Seedance 2.0 I2V prompt (verified ≤ 2000 chars)
