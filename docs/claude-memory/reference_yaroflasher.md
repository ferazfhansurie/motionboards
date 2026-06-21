---
name: Yaroflasher prompting style reference
description: Yaro Flasher (Motion Design School / FlashBoards) is the prompting-style North Star for Firaz's Seedance + NB2 work — long single-prompt multi-reference runs
type: reference
originSessionId: fcf27d1d-7a0e-4abc-b16c-b4a4838f2b7e
---
**Yaro Flasher** = Yaroslav (handle: yaroflasher), founder of **Motion Design School** and builder of **FlashBoards** (flashboards.yaroflasher.com) — a "Creative AI Canvas" conceptually identical to MotionBoards.

His public prompting workflow — referenced by Firaz as the pattern to match — is the source of these defaults:

**Pattern: single long-prompt multi-reference Seedance 2.0 I2V run.** Up to 12 reference images per generation, addressed inline as `@Image1` … `@ImageN`. The whole arc of a 10–12s spot lives in one prompt, not split across multiple S2E seams.

**Pattern: real photos for characters, AI for things.** Faces, wardrobe, identity = uploaded real photos. Cars, environments, staging backplates = generated in Nano Banana 2 first, then attached as references.

**Pattern: explicit identity lock language at the top, then the arc, then constraints at the bottom.**
- Top: `Use @Image1 as [character A's] face… preserve [specific wardrobe]… do not blend two characters' looks…`
- Middle: one cinematic sentence per beat, one camera move per beat, no hard cuts
- Bottom: hard `do not` lines (the things Seedance loves to break — speaking mouths, drifting paint colors, added pedestrians, in-scene branding)

**Pattern: two versions of every prompt** — a long-form `.md` brief for the human (no char limit), and a paste-ready compressed `.txt` under 2000 chars (ASCII only, no em-dashes, no smart quotes, no arrows) for the actual run.

These patterns are baked into the `/seedance-prompt` and `/nano-banana` slash commands in `.claude/commands/`.
