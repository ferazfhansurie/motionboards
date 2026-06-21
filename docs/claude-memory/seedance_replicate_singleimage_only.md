---
name: Replicate's Seedance 2.0 only takes ONE image — @ImageN syntax is provider-specific
description: The @Image1..@ImageN multi-reference syntax is a Volcengine/Ark-direct feature. Replicate's bytedance/seedance-2.0 only accepts one `image` field. Don't use @-mentions in MotionBoards Seedance prompts.
type: technical
originSessionId: fcf27d1d-7a0e-4abc-b16c-b4a4838f2b7e
---
**Critical caveat for any Seedance 2.0 prompt going through MotionBoards:**

MotionBoards routes Seedance through **Replicate** (`bytedance/seedance-2.0` and `bytedance/seedance-2.0/i2v` / `/s2e`). Replicate's Seedance integration only accepts:
- `image` (single image, for I2V)
- `first_frame_url` + `last_frame_url` (for S2E)

It does **NOT** accept multi-image references via `@Image1`..`@ImageN` syntax. That syntax is a feature of ByteDance's direct Volcengine/Ark API (and tools like FlashBoards / yaroflasher's canvas), not Replicate.

**Why this matters:**
- Prompts written with `@Image1`, `@Image2`, etc. work fine on Volcengine but on Replicate the `@` mentions become meaningless text in the prompt
- Worse, the `@`-mention pattern can trigger upstream safety classifiers as a suspected adversarial-prompt pattern (some classifiers flag @-tokens as injection attempts), causing E005 sensitive-content rejections that look mysterious because the actual content is fine

**How to write Seedance prompts in MotionBoards:**
- For I2V: use plain English referring to "the person/object in the source image" — do NOT use `@Image1` syntax
- The single image is automatically passed as the source — describe motion, beats, camera, lighting, but identity should reference "the source image"
- For S2E: same plain English; the two frames are passed as `first_frame_url` and `last_frame_url`

**Updates needed in `.claude/commands/seedance-prompt.md`:**
The yaroflasher multi-reference pattern is documented there as a goal, but it should be flagged that this only works on Volcengine-direct integrations, NOT Replicate. Add a callout that on MotionBoards (Replicate), multi-reference is not available and prompts should use single-image conventions.

**Future:** if MotionBoards adds a Volcengine/Ark provider integration (mentioned as `provider: "byteplus"` for Seedance Fast which is currently disabled in models.ts), multi-reference becomes possible. Until then, single-image only.
