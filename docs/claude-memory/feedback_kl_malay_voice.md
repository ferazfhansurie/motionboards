---
name: feedback_kl_malay_voice
description: "FatHopes/Malaysian VO must be Kuala Lumpur conversational Manglish, not Indonesian-sounding AI TTS"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9e31b8b8-255a-4e53-a506-8b1e5ac4fc69
---

For FatHopes (and any Malaysian) video content, AI-generated voices come out sounding Indonesian and obviously synthetic, which feels off to a KL audience. Firaz wants natural Kuala Lumpur conversational Manglish.

**Why:** TTS/video-audio models have far more Indonesian than Malaysian training data and treat "Malay" as one bucket — defaulting to Bahasa Indonesia pronunciation (hard final vowels "ap-a/say-a", sing-song intonation, rolled r's) and Indonesian vocabulary.

**How to apply:**
1. Surest fix = decouple voice from video. Generate mouth movement only (prompt: "moves mouth as if speaking, no audio"), then dub. For the hero pilot, use REAL Malaysian voices (even phone-quality WhatsApp voice notes) — biggest quality jump, kills both the AI and Indonesian tells. Reserve in-model TTS / ElevenLabs Malaysian voice for high-volume weekly shorts.
2. If keeping dialogue in-model, add accent directive: "spoken in a natural casual Kuala Lumpur Malaysian accent — fast, relaxed, flat urban KL Manglish; final 'a' softened to schwa; NOT Indonesian, no Indonesian intonation or vocabulary."
3. Write lines with KL markers (these alone push off Indonesian): tak (not tidak/nggak), nak (not mau), camne/macam mane (not gimana), tengok (not lihat), cakap (not ngomong), boleh (not bisa), pegi (not pergi), korang (not kalian); particles la/weh/kot/je/dah/eh/oii; KL slang gua/lu/bro/boss/abang; free English mixing (Manglish); schwa spelling ape/kenape/mane/jumpe.

Relates to [[feedback_tiktok_unscripted]] and the FatHopes superhero series work.
