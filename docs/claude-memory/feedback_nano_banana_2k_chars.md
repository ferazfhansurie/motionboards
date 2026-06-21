---
name: Nano Banana 2 has a 13000-character prompt limit
description: NB2's practical prompt cap is 13K chars (NOT 2K) — much higher than Seedance, write full briefs without aggressive compression
type: feedback
originSessionId: 184edf56-56d8-442e-8b49-43c5c0bdbfa9
---
Nano Banana 2 (Gemini 3.1 Flash Image) has a **practical ~13000-character prompt limit**, NOT 2000. This is much more generous than Seedance 2.0's 2000-char ceiling.

**Why:** Firaz hits truncation / quality degradation only past ~13K chars in production. Google's docs claim 131K input tokens (~524K chars) but the practical limit is 13K — beyond that NB2 drops trailing instructions and text-rendering quality starts collapsing. Below 13K the model honours the full brief reliably.

**How to apply:**
1. Write NB2 prompts at their natural length — full creative brief with all layout zones, text blocks, do-not items, and style notes. No aggressive compression needed.
2. Only verify with `wc -c` if the prompt feels unusually long (approaching 13K). Most NB2 prompts (2K–6K chars) sit comfortably under the cap.
3. `src/lib/models.ts` `maxPromptChars` for `gemini-3.1-flash-image-preview` is set to **13000** — the UI counter + server-side truncation respect that cap.
4. Do NOT confuse with Seedance 2.0's 2000-char rule — Seedance prompts still need wc -c verification + compression. The two models have different ceilings.

**Earlier wrong values I tried (avoid):**
- 8000 (original, based on Google's stated token cap — wrong)
- 2000 (overcorrected when user said "nano banana has 2k limit" — actually meant resolution context)
- 13000 (correct — confirmed by user)
