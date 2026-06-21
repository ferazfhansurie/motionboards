---
name: Seedance 2.0 prompts must verify under 2000 chars
description: Seedance upstream wrapper truncates at 2000 chars; always output a paste-ready compressed version with `wc -c` verification
type: feedback
originSessionId: fcf27d1d-7a0e-4abc-b16c-b4a4838f2b7e
---
When writing **Seedance 2.0 I2V / S2E / multi-reference** prompts for Firaz, always produce **two versions**:

1. The long-form treatment / brief (any length, lives in a `.md` file or chat for context)
2. A **paste-ready compressed version** that is **verifiably under 2000 characters**, ASCII-only, in a separate fenced block or `.txt` file

**Why:** the upstream wrapper Firaz's MotionBoards uses surfaces a hard error — `"Prompt length 12605 exceeds 2000 characters, truncating to 2000 characters"` — which silently drops the back half of the prompt (usually the constraints block, which is the part you can't lose). He explicitly asked for this two-version workflow after hitting the truncation error on a 12k-char prompt.

**How to apply:**
- Always **`wc -c` the compressed `.txt` file** before declaring it ready
- Strip em-dashes (—), smart quotes (" "), arrows (→) — they cost 2–3 bytes each in UTF-8 and inflate the count
- Watch out for **trailing null bytes** the Write tool sometimes leaves; clean them with `tr -d '\0'` or rewrite with `printf` if `wc -c` reads weirdly high
- The same constraint applies to any other model with a published or user-hit char limit (FLUX Schnell ~1024, others vary). Other models without a known limit can run uncapped.
