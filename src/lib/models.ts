export type ModelType =
  | "t2v" | "i2v" | "s2e" | "t2i" | "i2i" | "v2v" | "upscale" | "lipsync" | "audio" | "a2a" | "sfx";

export type ModelCategory =
  | "Image" | "Video" | "Sound Effects" | "Voice";

export interface ModelInput {
  name: string;
  type: "text" | "image" | "video" | "audio";
  required: boolean;
  description: string;
  // Maximum file size (MB) the upstream provider accepts for THIS specific
  // slot. Empty = no known limit (the generic platform-wide ceiling still
  // applies). Enforced client-side before a generate call so the user sees
  // a clear "Lipsync 2 Pro caps videos at 20 MB - yours is 47 MB" toast
  // instead of an opaque 413 from the model.
  maxMB?: number;
  // Maximum number of files the upstream model accepts for THIS slot when
  // it's a multi-ref input (reference_images, image_urls, reference_videos,
  // reference_audios). Empty = single-file slot, or no known cap. Enforced
  // both in the canvas attach UI (block past the limit) and in /api/generate
  // before the upstream call - prevents the silent truncation / 422 errors
  // some providers throw when you over-pack a reference array.
  //
  // Verified caps (with source):
  //   - Seedance 2.0 Omni (Replicate, multi-ref): 9 images, 3 videos, 3
  //     audios, per the Replicate model schema.
  //   - Kling 3.0 Omni (Replicate): 7 reference images, per the Replicate
  //     model schema.
  //   - Nano Banana 2 (Gemini, image_urls): 6 source images, per the
  //     Gemini imagen-3 / nano-banana-2 docs.
  maxCount?: number;
}

export interface ModelOption {
  values: string[];
  default: string;
  label: string;
}

export interface ModelOptionBool {
  default: boolean;
  label: string;
}

export interface ModelOptions {
  aspect_ratio?: ModelOption;
  duration?: ModelOption;
  resolution?: ModelOption;
  generate_audio?: ModelOptionBool;
}

export interface PerSecondRate {
  noAudio720p: number;
  withAudio720p: number;
  noAudio4k: number;
  withAudio4k: number;
}

export interface AIModel {
  id: string;
  name: string;
  provider: "openai" | "replicate" | "segmind" | "gemini" | "fish" | "byteplus" | "comfy";
  type: ModelType;
  category: ModelCategory;
  description: string;
  cost: string;
  creditCost: number;
  speed: string;
  inputs: ModelInput[];
  stable: boolean;
  options?: ModelOptions;
  perSecond?: PerSecondRate;
  // When true, the model is visible in the picker but can't be selected.
  // Use for tiers that exist upstream but aren't hooked up on our side
  // (e.g. Seedance Fast, which lives on ByteDance Ark not Replicate).
  disabled?: boolean;
  disabledReason?: string;
  // Maximum prompt length (characters) the upstream provider accepts for
  // the `prompt` text input. Enforced client-side in the prompt bar before
  // dispatching a generation, so the user sees a live counter and a clean
  // error before we waste a paid API call. Empty = no known limit (no UI
  // counter shown).
  //
  // SOURCING POLICY:
  //   Each value below MUST be either a) verified from the provider's
  //   official docs, or b) a reproducible user-hit limit (e.g. an upstream
  //   wrapper truncation message). Don't guess — if unknown, leave
  //   undefined and let the model run uncapped until we hit a real wall.
  //
  // Verified caps (with source):
  //   - Seedance 2.0 (T2V/I2V/S2E, ByteDance Ark wrapper): 2000 chars,
  //     confirmed by the wrapper's own truncation message:
  //     "Prompt length N exceeds 2000 characters, truncating to 2000".
  //   - GPT Image 2 (OpenAI): 32000 chars, per OpenAI API reference
  //     (developers.openai.com/api/reference/resources/images).
  //   - Nano Banana 2 / Gemini 3.1 Flash Image (Google): 13000 chars,
  //     user-hit practical cap. Google's docs claim 131k input tokens
  //     (~524k chars) but in production NB2 prompts past ~13k chars start
  //     dropping trailing instructions and degrading text-rendering
  //     quality. Below 13k the model honours the full brief reliably.
  //     This is much higher than Seedance's 2000-char ceiling, so when
  //     authoring NB2 prompts there's no need to compress aggressively
  //     unless approaching 13k — write the full creative brief and ship.
  //   - FLUX Schnell (Black Forest Labs): T5 encoder hard cap at 256
  //     tokens (vs FLUX-dev's 512). ~4 chars/token = ~1024 chars.
  //
  // Models intentionally LEFT UNDEFINED (no published char cap found, and
  // no user-hit upstream rejection yet — per the sourcing policy):
  //   - Veo 3.1 Lite/Fast (T2V/I2V/S2E): Google docs only give best-
  //     practice word counts (200-500 words), no hard cap.
  //   - Wan 2.2 Animate (replace + animation): no published cap.
  //   - Sync Lipsync 2 / 2 Pro: prompt is short style guidance ("person
  //     speaking naturally"); no published cap.
  //   - MMAudio, Stable Audio 2.5, MiniMax Music, ACE-Step: audio gen
  //     models with prompt-quality guidance but no published char cap.
  //   - tts-1, fish-voice-clone-tts: TTS — `prompt` IS the text being
  //     spoken, conceptually different; no UI cap.
  //   - Demucs: audio source separation, no text prompt at all.
  // When any of these throws an upstream truncation, capture the cap and
  // add it here with the source.
  maxPromptChars?: number;
  // Practical usage guide — markdown rendered in the model details dialog.
  // Cover what works, what doesn't, common gotchas, and example prompts.
  // Keep it actionable: "use 5–10s clips", "no cuts inside the source video",
  // not generic marketing copy.
  guide?: string;
}

// Helpers
// -------

// Find the multi-ref slot on `model` that accepts the given file kind, if
// any. A multi-ref slot is one whose input name ends with _urls, _images,
// _videos, or _audios AND declares a maxCount. Used by the canvas-side
// attach UI to block the user from over-packing a slot (and by the API
// route to reject the same condition defensively).
export function findMultiRefSlot(
  model: AIModel,
  kind: "image" | "video" | "audio"
): ModelInput | null {
  return (
    model.inputs.find(
      (inp) =>
        inp.type === kind &&
        !!inp.maxCount &&
        /_(urls|images|videos|audios)$/.test(inp.name)
    ) ?? null
  );
}

// Rate: 1 USD = 3.7 RM. Margin: +RM0.03 photo/audio, +RM0.05 video
// Curated catalog: the 2 cheapest models per category.

export const models: AIModel[] = [
  // ═══════════════ IMAGE ═══════════════

  {
    id: "gemini-3.1-flash-image-preview",
    name: "Nano Banana 2",
    guide: `**Google's image generator with reference-image blending.**

**Modes:**
- Pure text-to-image: just describe what you want.
- With reference images (up to 4): the model blends style / subject / composition from each. Great for "this character in this setting" combos.

**Prompt patterns that work:**
- "Photorealistic portrait of [subject], shot on Sony A7IV, 85mm f/1.4, golden hour, shallow depth of field" → fast hyper-realistic look.
- "[Subject] in the style of [reference image], cinematic lighting, film grain" → style transfer.
- For multi-character scenes: name each person in the prompt and reference images by description.

**Resolution:** 0.5K is fast/cheap for iteration. Bump to 1K/2K/4K only when locked. 4K takes ~3× longer than 1K and occasionally 503s — see below.

**Common gotchas:**
- Text inside images often comes out garbled. Prompt explicit text only when essential, otherwise add it in post.
- Hands and small details improve dramatically when you say "detailed anatomy, accurate hands".
- Reference images: avoid using too many (4 max) and avoid contradictory references.

**Use it as the start of a chain:** generate keyframes here → tag into Veo I2V or Seedance I2V to animate.`,
    provider: "gemini", type: "t2i", category: "Image",
    description: "Google's Gemini 3.1 Flash Image. Fast, photoreal, and the current price/quality leader.",
    cost: "~RM0.10", creditCost: 10, speed: "~15s", stable: true, maxPromptChars: 13000,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Image description" },
      { name: "image_urls", type: "image", required: false, description: "Reference images (optional, up to 6)", maxMB: 7, maxCount: 6 },
    ],
    options: {
      aspect_ratio: { values: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"], default: "auto", label: "Aspect Ratio" },
      resolution: { values: ["0.5K", "1K", "2K", "4K"], default: "1K", label: "Resolution" },
    },
  },

  {
    id: "gpt-image-2",
    name: "ChatGPT Image 2",
    provider: "openai", type: "t2i", category: "Image",
    description: "OpenAI's gpt-image-2 — state-of-the-art image generation and editing. Strong prompt following, readable text, flexible sizes. Optional reference image turns it into an editor.",
    cost: "~RM0.25", creditCost: 25, speed: "~25s", stable: true, maxPromptChars: 32000,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Image description" },
      { name: "image_url", type: "image", required: false, description: "Reference image to edit (optional)", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["auto", "1024x1024", "1024x1536", "1536x1024"], default: "auto", label: "Size" },
    },
  },

  {
    id: "black-forest-labs/flux-schnell",
    name: "FLUX Schnell",
    provider: "replicate", type: "t2i", category: "Image",
    description: "Black Forest Labs FLUX.1 [schnell]. 4-step distilled, ~1s per image on Replicate.",
    cost: "~RM0.02", creditCost: 2, speed: "~3s", stable: true, maxPromptChars: 1024,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Image description" },
    ],
    options: {
      aspect_ratio: { values: ["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "21:9", "9:21"], default: "1:1", label: "Aspect Ratio" },
    },
  },

  // ═══════════════ VIDEO ═══════════════

  {
    id: "veo-3.1-lite-generate-preview",
    name: "Veo 3.1 Lite T2V",
    provider: "gemini", type: "t2v", category: "Video",
    description: "Google Veo 3.1 Lite — cheapest Veo tier. Toggle native audio on/off. 4K not supported.",
    cost: "RM0.24/s", creditCost: 192, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "6s", "8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "720p", label: "Resolution (1080p needs 8s)" },
      generate_audio: { default: true, label: "Audio" },
    },
    perSecond: { noAudio720p: 0.24, withAudio720p: 0.24, noAudio4k: 0, withAudio4k: 0 },
  },

  {
    id: "veo-3.1-lite-generate-preview/i2v",
    name: "Veo 3.1 Lite I2V",
    provider: "gemini", type: "i2v", category: "Video",
    description: "Veo 3.1 Lite image-to-video. Native audio toggle. Reference image forces 8s duration.",
    cost: "RM1.92", creditCost: 192, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How to animate the image" },
      { name: "image_url", type: "image", required: true, description: "Image to animate", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "720p", label: "Resolution" },
      generate_audio: { default: true, label: "Audio" },
    },
    perSecond: { noAudio720p: 0.24, withAudio720p: 0.24, noAudio4k: 0, withAudio4k: 0 },
  },

  {
    id: "veo-3.1-fast-generate-preview",
    name: "Veo 3.1 Fast T2V",
    provider: "gemini", type: "t2v", category: "Video",
    description: "Veo 3.1 Fast — better quality than Lite, native audio toggle. 1080p/4k need 8s.",
    cost: "RM0.42/s", creditCost: 336, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "6s", "8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p", "4k"], default: "720p", label: "Resolution (1080p/4k need 8s)" },
      generate_audio: { default: true, label: "Audio" },
    },
    perSecond: { noAudio720p: 0.42, withAudio720p: 0.42, noAudio4k: 1.16, withAudio4k: 1.16 },
  },

  {
    id: "veo-3.1-fast-generate-preview/i2v",
    name: "Veo 3.1 Fast I2V",
    provider: "gemini", type: "i2v", category: "Video",
    description: "Veo 3.1 Fast image-to-video. Native audio toggle. Reference image forces 8s.",
    cost: "RM3.36", creditCost: 336, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How to animate the image" },
      { name: "image_url", type: "image", required: true, description: "Image to animate", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p", "4k"], default: "720p", label: "Resolution" },
      generate_audio: { default: true, label: "Audio" },
    },
    perSecond: { noAudio720p: 0.42, withAudio720p: 0.42, noAudio4k: 1.16, withAudio4k: 1.16 },
    guide: `**One continuous 8s shot — no cuts.** Veo I2V animates a single image into a single take. To stitch a multi-shot sequence: generate each shot separately and edit them together externally, or use S2E (start-to-end) with linking frames.

**Prompt template:** describe MOTION, not the scene (the scene is already the image). Be specific:
- Bad: "make this cinematic"
- Good: "slow dolly-in toward the subject's face, gentle wind on hair, shallow depth of field, golden-hour key light"

**Audio toggle**: leave on for ambient sound + voice if relevant. Turn off if you'll add MMAudio or Lipsync later.

**Resolution:** start 720p for iteration. 4K is 2.7× the cost — use only when you've locked the prompt.

**Common gotchas:**
- Faces drift if the prompt doesn't anchor identity ("the same young woman in the image, holding her pose").
- Camera moves you describe ("orbit", "dolly") usually feel slower than expected — be bold ("aggressive orbit", "fast push-in").
- Text in the source image often morphs. If you need text, add it in post.`,
  },

  {
    id: "veo-3.1-fast-generate-preview/s2e",
    name: "Veo 3.1 Fast S2E",
    provider: "gemini", type: "s2e", category: "Video",
    description: "Veo 3.1 Fast first-to-last-frame video. Native audio toggle. Fixed at 8s.",
    cost: "RM3.36", creditCost: 336, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
      { name: "first_frame_url", type: "image", required: true, description: "Start frame image", maxMB: 20 },
      { name: "last_frame_url", type: "image", required: true, description: "End frame image", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p", "4k"], default: "720p", label: "Resolution" },
      generate_audio: { default: true, label: "Audio" },
    },
    perSecond: { noAudio720p: 0.42, withAudio720p: 0.42, noAudio4k: 1.16, withAudio4k: 1.16 },
    guide: `**S2E = Start to End. Veo interpolates an 8-second motion path between two images you provide.** This is the canonical multi-shot building block — chain N S2E generations to produce a coherent N-cut sequence.

**Multi-shot workflow:**
1. Generate keyframe images (Nano Banana 2 / FLUX) for each "moment" of your sequence: Frame A, Frame B, Frame C…
2. Run S2E with frames A→B, then B→C, then C→D…
3. Each S2E clip naturally cuts to the next because the END frame of clip 1 is the START frame of clip 2.
4. Stitch externally (CapCut, Premiere) for the final.

**Frame rules:**
- Same character / scene continuity between start and end. Wildly different framings → the model invents a chaotic transition.
- Match aspect ratio across all keyframes (16:9 throughout, or 9:16 throughout).
- For "camera-only" cuts: use the same subject in both frames at different angles. For "subject-action" cuts: same camera, subject in different positions.

**Prompt template:** describe the TRANSITION, not just the end state.
- "the woman turns her head from looking left to looking right, soft natural motion"
- "the camera pulls back slowly while the subject stays centered"

**Limit:** 8s only — that's the model's max output. For longer sequences, chain S2E clips.`,
  },

  {
    id: "gemini-omni-flash-preview",
    name: "Gemini Omni Flash T2V",
    provider: "gemini", type: "t2v", category: "Video",
    description: "Google's Gemini Omni Flash — fast conversational text-to-video with native audio. 720p, 3-10s.",
    cost: "~RM2.50", creditCost: 250, speed: "~1m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "6s", "8s", "10s"], default: "8s", label: "Duration (target)" },
      resolution: { values: ["720p"], default: "720p", label: "Resolution" },
    },
    guide: `**Gemini Omni Flash — Google's fast, conversational video model.** Text (and optionally an image) in, a short 720p clip with native audio out. Runs on the new Interactions API.

**Prompt patterns:**
- Describe a single continuous shot: "A marble rolling fast on a chain-reaction track, continuous smooth camera follow."
- Native audio is always on — mention the sound you want ("gentle rain, distant thunder") right in the prompt.
- No separate negative-prompt field — fold negatives into the text ("no text overlays, no watermark").

**Specs:** 720p, 24 FPS, ~3-10s. Duration is a target, not a hard guarantee (the model picks the natural length). Aspect ratio 16:9 or 9:16.

**Preview model:** it's fast and cheap for iteration; for locked hero shots, Veo 3.1 Fast / Seedance 2.0 Pro give more control.`,
  },

  {
    id: "gemini-omni-flash-preview/i2v",
    name: "Gemini Omni Flash I2V",
    provider: "gemini", type: "i2v", category: "Video",
    description: "Gemini Omni Flash image-to-video — animate a still with native audio. 720p, up to 10s.",
    cost: "~RM2.50", creditCost: 250, speed: "~1m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How to animate the image" },
      { name: "image_url", type: "image", required: true, description: "Image to animate", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "6s", "8s", "10s"], default: "8s", label: "Duration (target)" },
      resolution: { values: ["720p"], default: "720p", label: "Resolution" },
    },
    guide: `**Gemini Omni Flash image-to-video.** Feed a still + a motion description; it animates into a short 720p clip with native audio. Describe the MOTION, not the scene (the scene is the image): "slow push-in, hair drifting in the breeze, ambient street noise". Duration is a target (~3-10s), not guaranteed.`,
  },

  // ────────────────────────────────────────────────────────────────────
  // Seedance 2.0 Pro — Dreamina direct (ByteDance Ark). Same model the
  // Replicate entries above route to, but called directly. Cheaper at
  // volume, supports 1080p, and uses @ImageN syntax (not [ImageN]) for
  // multi-ref tagging.
  // ────────────────────────────────────────────────────────────────────
  {
    id: "dreamina-seedance-2-0-260128",
    name: "Seedance 2.0 Pro",
    provider: "byteplus", type: "t2v", category: "Video",
    description: "Seedance 2.0 Pro on Dreamina direct (ByteDance Ark). Multimodal cinematic video with native audio, supports 1080p. Optionally attach up to 9 reference images and tag them in the prompt as @Image1, @Image2...",
    cost: "~RM0.67/s (720p)", creditCost: 335, speed: "~3m", stable: true, maxPromptChars: 2000,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Scene description with camera moves, lighting, mood" },
      { name: "reference_images", type: "image", required: false, description: "Optional: up to 9 reference images for character lock or scene composition. Tag in prompt as @Image1, @Image2...", maxMB: 10, maxCount: 9 },
      { name: "audio_url", type: "audio", required: false, description: "Optional: drive the scene with a reference audio (voice / dialogue). Seedance will sync motion + lighting to it.", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p", "1080p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.67, withAudio720p: 0.67, noAudio4k: 1.5, withAudio4k: 1.5 },
  },

  {
    id: "dreamina-seedance-2-0-260128/i2v",
    name: "Seedance 2.0 Pro I2V",
    provider: "byteplus", type: "i2v", category: "Video",
    description: "Seedance 2.0 Pro image-to-video on Dreamina direct. Animate a still into a cinematic clip with native audio. Attach extra refs to switch into multi-image Omni mode and tag them as @Image1, @Image2...",
    cost: "~RM0.67/s (720p)", creditCost: 335, speed: "~3m", stable: true, maxPromptChars: 2000,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How the image should animate" },
      { name: "image_url", type: "image", required: true, description: "Image to animate (used as the first frame when no extra refs are attached)", maxMB: 10 },
      { name: "reference_images", type: "image", required: false, description: "Optional: attach extra refs to switch into multi-image Omni mode. Tag them in the prompt as @Image1, @Image2... (max 9)", maxMB: 10, maxCount: 9 },
      { name: "audio_url", type: "audio", required: false, description: "Optional: drive lip-sync / scene timing from a reference audio.", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p", "1080p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.67, withAudio720p: 0.67, noAudio4k: 1.5, withAudio4k: 1.5 },
  },

  {
    id: "dreamina-seedance-2-0-260128/s2e",
    name: "Seedance 2.0 Pro S2E",
    provider: "byteplus", type: "s2e", category: "Video",
    description: "Seedance 2.0 Pro start-to-end on Dreamina direct. Provide a start frame and an end frame; Ark animates the transition with native audio.",
    cost: "~RM0.67/s (720p)", creditCost: 335, speed: "~3m", stable: true, maxPromptChars: 2000,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Describe the transition between the two frames" },
      { name: "first_frame_url", type: "image", required: true, description: "Start frame image", maxMB: 10 },
      { name: "last_frame_url", type: "image", required: true, description: "End frame image", maxMB: 10 },
      { name: "audio_url", type: "audio", required: false, description: "Optional: drive the transition timing from a reference audio.", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p", "1080p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.67, withAudio720p: 0.67, noAudio4k: 1.5, withAudio4k: 1.5 },
  },

  // Seedance 2.0 Pro Omni — multi-reference mode of Pro I2V, surfaced as its
  // own model entry so the "use faces / multiple character refs" flow is
  // discoverable. Backend strips /omni and routes to the same Ark endpoint;
  // arkIsOmniOnly kicks in automatically when reference_images are present
  // and no image_url/first_frame_url/last_frame_url is set.
  {
    id: "dreamina-seedance-2-0-260128/omni",
    name: "Seedance 2.0 Pro Omni",
    provider: "byteplus", type: "i2v", category: "Video",
    description: "Seedance 2.0 Pro multi-reference mode. Lock up to 9 images (faces, wardrobe, props, backplate), 3 video clips, and 3 audio tracks (mp3/wav, 15s max) and direct the arc in a single prompt. Tag each ref as @Image1, @Video1, @Audio1... Best for character-consistent ads where the same person and BGM/voice need to land together.",
    cost: "~RM0.67/s (720p)", creditCost: 335, speed: "~3m", stable: true, maxPromptChars: 2000,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Scene direction. Tag refs as @Image1, @Video1, @Audio1... e.g. 'Use @Image1 as her face, @Audio1 as the background music — match the cuts to its beats.'" },
      { name: "reference_images", type: "image", required: true, description: "1-9 reference images: faces, wardrobe, props, locations. Tag them in the prompt as @Image1, @Image2...", maxMB: 10, maxCount: 9 },
      { name: "reference_videos", type: "video", required: false, description: "Optional: up to 3 reference video clips (for motion/style transfer). Tag as @Video1, @Video2, @Video3.", maxMB: 50, maxCount: 3 },
      { name: "reference_audios", type: "audio", required: false, description: "Optional: up to 3 audio refs (mp3/wav, 15s combined max). Drives beat-matched cuts and lip-sync. Tag as @Audio1, @Audio2, @Audio3.", maxMB: 15, maxCount: 3 },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p", "1080p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.67, withAudio720p: 0.67, noAudio4k: 1.5, withAudio4k: 1.5 },
  },

  // Seedance 2.0 Fast — hosted on ByteDance Ark (Dreamina direct). Cheaper
  // and quicker than the Replicate-hosted Seedance entries; uses @ImageN
  // syntax (not [ImageN]) for multi-ref tagging in prompts.
  {
    id: "dreamina-seedance-2-0-fast-260128",
    name: "Seedance 2.0 Fast",
    provider: "byteplus", type: "t2v", category: "Video",
    description: "Seedance 2.0 Fast on Dreamina direct (ByteDance Ark). Cheaper and quicker than the Replicate tier. Optionally attach up to 9 reference images and tag them in the prompt as @Image1, @Image2...",
    cost: "~RM0.46/s (720p)", creditCost: 230, speed: "~2m", stable: true,
    maxPromptChars: 2000,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Scene description with camera moves, lighting, mood" },
      { name: "reference_images", type: "image", required: false, description: "Optional: up to 9 reference images for character lock or scene composition. Tag in prompt as @Image1, @Image2...", maxMB: 10, maxCount: 9 },
      { name: "audio_url", type: "audio", required: false, description: "Optional: drive the scene with a reference audio (voice / dialogue).", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
  },

  {
    id: "dreamina-seedance-2-0-fast-260128/i2v",
    name: "Seedance 2.0 Fast I2V",
    provider: "byteplus", type: "i2v", category: "Video",
    description: "Seedance 2.0 Fast image-to-video on Dreamina direct. Attach extra refs to switch into multi-image Omni mode and tag them as @Image1, @Image2...",
    cost: "~RM0.46/s (720p)", creditCost: 230, speed: "~2m", stable: true,
    maxPromptChars: 2000,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How the image should animate" },
      { name: "image_url", type: "image", required: true, description: "Image to animate (used as the first frame when no extra refs are attached)", maxMB: 10 },
      { name: "reference_images", type: "image", required: false, description: "Optional: attach extra refs to switch into multi-image Omni mode. Tag them in the prompt as @Image1, @Image2... (max 9)", maxMB: 10, maxCount: 9 },
      { name: "audio_url", type: "audio", required: false, description: "Optional: drive lip-sync / scene timing from a reference audio.", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
  },

  {
    id: "dreamina-seedance-2-0-fast-260128/s2e",
    name: "Seedance 2.0 Fast S2E",
    provider: "byteplus", type: "s2e", category: "Video",
    description: "Seedance 2.0 Fast start-to-end on Dreamina direct. Provide a start frame and an end frame; Ark animates the transition with native audio.",
    cost: "~RM0.46/s (720p)", creditCost: 230, speed: "~2m", stable: true,
    maxPromptChars: 2000,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Describe the transition between the two frames" },
      { name: "first_frame_url", type: "image", required: true, description: "Start frame image", maxMB: 10 },
      { name: "last_frame_url", type: "image", required: true, description: "End frame image", maxMB: 10 },
      { name: "audio_url", type: "audio", required: false, description: "Optional: drive the transition timing from a reference audio.", maxMB: 20 },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
  },

  // Seedance 2.0 Fast Omni — multi-reference variant of Fast, same routing
  // trick as Pro Omni above.
  {
    id: "dreamina-seedance-2-0-fast-260128/omni",
    name: "Seedance 2.0 Fast Omni",
    provider: "byteplus", type: "i2v", category: "Video",
    description: "Seedance 2.0 Fast multi-reference mode. Lock up to 9 images, 3 video clips, and 3 audio tracks (mp3/wav, 15s max) in a single prompt. Tag each ref as @Image1, @Video1, @Audio1... Cheaper than Pro Omni, no 1080p.",
    cost: "~RM0.46/s (720p)", creditCost: 230, speed: "~2m", stable: true,
    maxPromptChars: 2000,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Scene direction. Tag refs as @Image1, @Video1, @Audio1... e.g. 'Use @Image1 as her face, @Audio1 as the background music.'" },
      { name: "reference_images", type: "image", required: true, description: "1-9 reference images: faces, wardrobe, props, locations. Tag them in the prompt as @Image1, @Image2...", maxMB: 10, maxCount: 9 },
      { name: "reference_videos", type: "video", required: false, description: "Optional: up to 3 reference video clips (for motion/style transfer). Tag as @Video1, @Video2, @Video3.", maxMB: 50, maxCount: 3 },
      { name: "reference_audios", type: "audio", required: false, description: "Optional: up to 3 audio refs (mp3/wav, 15s combined max). Drives beat-matched cuts and lip-sync. Tag as @Audio1, @Audio2, @Audio3.", maxMB: 15, maxCount: 3 },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Kling 3.0 family - Kuaishou's flagship video model on Replicate.
  // Premium tier known for strong physics, natural human motion, and tight
  // character consistency.
  //
  // Replicate split the v3.0 line into four sibling endpoints (May 2026):
  //   - kling-v3-video         T2V / I2V / S2E (single start_image, optional end_image)
  //   - kling-v3-omni-video    multi-ref Omni (up to 7 reference images + 1 reference_video)
  //   - kling-v3-motion-control character + motion-source video (pose / camera transfer)
  //   - kling-lip-sync         video + audio (or text+voice) lip-sync
  //
  // The Replicate router strips the trailing /i2v, /s2e, /omni suffix from
  // the model id before calling Replicate, and rewrites canvas-side field
  // names (image -> start_image, last_frame_image -> end_image, ...) inside
  // a `if (replicateModel.startsWith("kwaivgi/kling-"))` block in
  // src/app/api/generate/route.ts.
  // ────────────────────────────────────────────────────────────────────
  {
    id: "kwaivgi/kling-v3-video",
    name: "Kling 3.0",
    provider: "replicate", type: "t2v", category: "Video",
    description: "Kuaishou Kling 3.0 - premium cinematic video with multi-shot control, native audio, and improved consistency. 3-15s, 720p (standard) or 1080p (pro).",
    cost: "RM1.10/s (1080p)", creditCost: 550, speed: "~3m", stable: true, maxPromptChars: 2500,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description with camera, motion, mood" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "1:1"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["3s", "5s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "1080p", label: "Resolution" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.85, withAudio720p: 0.85, noAudio4k: 1.10, withAudio4k: 1.10 },
    guide: `**Kling's strengths:**
- Tight character motion (faces, hands, hair)
- Physical interactions: pouring liquid, fabric movement, collisions
- Multi-shot control with native audio
- 15-second takes without character drift

**Prompt template:**
- Describe SUBJECT + ACTION + CAMERA + LIGHTING in that order.
- "A woman in a red coat walks across a cobblestone street at golden hour. Slow handheld dolly-in. Shallow depth of field, warm key light from screen-right."

**Common gotchas:**
- Hard whip-pans / glitch cuts often get smoothed - Kling prefers organic motion.
- Heavy stylization (anime, painterly) drifts more than photoreal.
- pro (1080p) is ~1.3x the cost of standard (720p) - iterate at 720p, lock at 1080p.

**Pair with:**
- Nano Banana 2 keyframe -> Kling I2V (cleanest character lock workflow).
- Lipsync 2 Pro for talking-head finishes.`,
  },

  {
    id: "kwaivgi/kling-v3-video/i2v",
    name: "Kling 3.0 I2V",
    provider: "replicate", type: "i2v", category: "Video",
    description: "Kling 3.0 image-to-video. Animate a still with cinematic-grade motion. Strong character consistency, premium identity lock. 3-15s.",
    cost: "RM1.10/s (1080p)", creditCost: 550, speed: "~3m", stable: true, maxPromptChars: 2500,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How to animate the image - describe motion, camera, mood" },
      { name: "image_url", type: "image", required: true, description: "Image to animate (used as the start frame)", maxMB: 10 },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "1:1"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["3s", "5s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "1080p", label: "Resolution" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.85, withAudio720p: 0.85, noAudio4k: 1.10, withAudio4k: 1.10 },
    guide: `**One continuous shot, max 15s.** Kling 3.0 I2V is the strongest model in the picker for tight character animation and physical realism.

**Best for:**
- Talking heads (then chain into Lipsync 2 Pro for the dialogue)
- Subtle facial performance (eye flickers, lip parts, micro-expressions)
- Cloth + hair physics under camera motion
- Slow cinematic dolly / orbit moves

**Prompt template:** describe MOTION, not the scene (the scene is the image).
- Bad: "make this cinematic"
- Good: "subject turns head slowly toward camera, soft handheld push-in, gentle wind on hair, golden-hour key light"

**Common gotchas:**
- Fast camera moves (whip-pans) often soften - Kling prefers smooth motion.
- Wildly stylized source images drift more than photoreal.
- 1080p ~1.3x the 720p cost - iterate at 720p, finalise at 1080p.`,
  },

  {
    id: "kwaivgi/kling-v3-video/s2e",
    name: "Kling 3.0 S2E",
    provider: "replicate", type: "s2e", category: "Video",
    description: "Kling 3.0 start-to-end. Provide a start frame and an end frame; Kling animates the transition with cinematic motion and native audio. 3-15s.",
    cost: "RM1.10/s (1080p)", creditCost: 550, speed: "~3m", stable: true, maxPromptChars: 2500,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Describe the transition between the two frames" },
      { name: "first_frame_url", type: "image", required: true, description: "Start frame image", maxMB: 10 },
      { name: "last_frame_url", type: "image", required: true, description: "End frame image", maxMB: 10 },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "1:1"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["3s", "5s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "1080p", label: "Resolution" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.85, withAudio720p: 0.85, noAudio4k: 1.10, withAudio4k: 1.10 },
    guide: `**Kling 3.0 S2E** interpolates a smooth motion path between two keyframes. The strongest "transition" model in the picker for character continuity.

**Frame rules:**
- Same character / scene continuity between start and end. Wildly different framings = the model invents a chaotic transition.
- Match aspect ratio across both keyframes.
- For "camera-only" cuts: use the same subject in both frames at different angles. For "subject-action" cuts: same camera, subject in different positions.

**Prompt template:** describe the TRANSITION, not just the end state.
- "the woman turns her head from looking left to looking right, soft natural motion"
- "the camera pulls back slowly while the subject stays centered"

**Chain S2E** for multi-shot sequences: A->B, B->C, C->D, each clip cuts naturally to the next.`,
  },

  {
    id: "kwaivgi/kling-v3-omni-video",
    name: "Kling 3.0 Omni",
    provider: "replicate", type: "i2v", category: "Video",
    description: "Kling 3.0 Omni - multi-reference cinematic video. Lock up to 7 reference images (faces, wardrobe, props, locations) and an optional reference video. Tag refs in the prompt as [Image1], [Image2]...",
    cost: "RM1.10/s (1080p)", creditCost: 550, speed: "~3m", stable: true, maxPromptChars: 2500,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Scene direction. Tag refs as [Image1], [Image2]... e.g. 'Use [Image1] as her face, [Image2] as the wardrobe, [Image3] as the backplate.'" },
      { name: "reference_images", type: "image", required: true, description: "1-7 reference images. With a reference video the cap drops to 4. Tag in prompt as [Image1], [Image2]...", maxMB: 10, maxCount: 7 },
      { name: "reference_video", type: "video", required: false, description: "Optional: 1 reference video (3-10s, mp4/mov, max 200 MB) to transfer motion and camera into the scene.", maxMB: 200 },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "1:1"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["3s", "5s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "1080p", label: "Resolution" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.85, withAudio720p: 0.85, noAudio4k: 1.10, withAudio4k: 1.10 },
    guide: `**Kling 3.0 Omni** is the multi-reference variant. Lock multiple identities in a single prompt - the same character across wardrobe / location refs, or several distinct characters interacting.

**Reference manifest pattern** (start the prompt with this):
- Use [Image1] as the lead's face and hair, preserve them exactly.
- Use [Image2] as her co-star's face and wardrobe.
- Use [Image3] as the staging backplate. Preserve composition and colors.

**Caps:**
- Up to 7 reference images normally.
- Up to 4 reference images when also using a reference video.
- Reference video must be 3-10s, mp4 or mov, under 200 MB.

**Use the bracket syntax [Image1]**, not @Image1 - the Replicate Omni schema parses brackets.`,
  },

  {
    id: "kwaivgi/kling-v3-motion-control",
    name: "Kling 3.0 Motion Control",
    provider: "replicate", type: "v2v", category: "Video",
    description: "Kling 3.0 Motion Control - transfer character motion from a reference video onto any character image. Improved consistency over Wan Animate, premium identity lock.",
    cost: "RM1.10/s (1080p)", creditCost: 550, speed: "~4m", stable: true, maxPromptChars: 2500,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Optional caption for additional guidance" },
      { name: "character_image", type: "image", required: true, description: "Character image (the person to animate)", maxMB: 10 },
      { name: "video", type: "video", required: true, description: "Motion source video. Duration cap depends on orientation: image=10s, video=30s.", maxMB: 200 },
    ],
    options: {
      resolution: { values: ["720p", "1080p"], default: "720p", label: "Resolution" },
    },
    perSecond: { noAudio720p: 0.85, withAudio720p: 0.85, noAudio4k: 1.10, withAudio4k: 1.10 },
    guide: `**Kling 3.0 Motion Control** copies the motion of a source video onto your character image. Different from Wan Animate - tighter face/identity lock, less drift, supports up to 30s when in "video" orientation mode.

**Character image rules:**
- Full body if the source video is full-body. Half-body image + full-body source = legs invented and usually wrong.
- Clean background. Plain studio lighting beats a busy scene.
- Same orientation as the source subject (front-on character image for a front-on source video).

**Source video rules:**
- ONE person in frame. Multiple people = the model picks one and the others ghost.
- Subject mostly facing the camera works best. Profile / back-of-head shots are weaker.
- Stable framing - handheld is fine, but no rapid camera shake or aggressive zoom.

**Resolution:** start at 720p for iteration. Premium charges 1.3x for 1080p.`,
  },

  {
    id: "kwaivgi/kling-lip-sync",
    name: "Kling Lip Sync",
    provider: "replicate", type: "v2v", category: "Video",
    description: "Kling Lip Sync - drive the lips of any video to match an audio file. Cinematic-grade mouth tracking for dubbing and dialogue replacement.",
    cost: "RM0.50/s", creditCost: 250, speed: "~3m", stable: true, maxPromptChars: 2500,
    inputs: [
      { name: "video", type: "video", required: true, description: "Source video whose lips should match the audio.", maxMB: 50 },
      { name: "audio", type: "audio", required: true, description: "Audio the lips should sync to.", maxMB: 50 },
    ],
    perSecond: { noAudio720p: 0.50, withAudio720p: 0.50, noAudio4k: 0.50, withAudio4k: 0.50 },
    guide: `**Kling Lip Sync** is premium mouth tracking. Use after a video is shot or generated, when you need clean dialogue replacement.

**Best for:**
- Dubbing a clip into a different language.
- Replacing a generated talking-head's mouth with cleaner audio.
- Tightening a Wan Animate or Veo character's lip-sync to match a recorded VO.

**Tips:**
- Keep the source video under 60s for fastest turnaround.
- Avoid hard cuts within the clip - one continuous shot per run.
- Audio under 30s = best identity preservation.`,
  },

  {
    id: "wan-video/wan-2.2-animate-replace",
    name: "Wan 2.2 Animate — Character Replacement",
    provider: "replicate", type: "v2v", category: "Video",
    description: "Upload a character image and a pose reference video. Wan Animate generates a pose estimation internally and renders your character performing the same motion, preserving camera movement and lighting.",
    cost: "~RM0.30/s (720p)", creditCost: 150, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Optional caption" },
      { name: "character_image", type: "image", required: true, description: "Character image (the person to render)", maxMB: 10 },
      { name: "video", type: "video", required: true, description: "Pose reference video (motion + camera are preserved)", maxMB: 50 },
    ],
    options: {
      resolution: { values: ["480", "720"], default: "480", label: "Resolution" },
    },
    perSecond: { noAudio720p: 0.30, withAudio720p: 0.30, noAudio4k: 0, withAudio4k: 0 },
    guide: `**One continuous shot only — no cuts.** Wan tracks a single person across the clip; if the source video cuts to another angle or a different subject, the model loses the track and the output garbles or drops the character. Trim the source down to a single uninterrupted take before you tag it (use the Scissors icon in the zoom view).

**Sweet spot is 5–15 seconds.** Output matches the source video's duration. Anything past ~30s gets expensive and may hit Replicate's 10-minute prediction timeout.

**Character image rules:**
- Full body visible if the source video is a full-body shot. Half-body image + full-body source = legs invented and usually wrong.
- Clean background. Plain studio lighting beats a busy scene.
- Same orientation as the source subject (front-on character image for a front-on source video).
- Avoid sunglasses, masks, or anything covering identifying features — character ID drifts more.

**Source video rules:**
- ONE person in frame. Multiple people = the model picks one and the others ghost.
- Subject mostly facing the camera works best. Profile / back-of-head shots are weaker.
- Stable framing — handheld is fine, but no rapid camera shake or aggressive zoom.
- Audio is preserved in the output (\`merge_audio: true\`).

**Resolution:** start at 480 to iterate cheaply, switch to 720 once the framing is right.

**Why your earlier attempts failed**: most likely a cut in the source video, multiple people, or a character image that doesn't match the source's framing.`,
  },

  {
    id: "wan-video/wan-2.2-animate-animation",
    name: "Wan 2.2 Animate — Reality/Background Change Animation",
    provider: "replicate", type: "v2v", category: "Video",
    description: "Animate your character image to mimic the motion of a reference video. Unlike Character Replacement (which swaps the performer in the reference scene), this generates a fresh clip of your character on a brand-new generated background — change the reality, keep the motion.",
    cost: "~RM0.30/s (720p)", creditCost: 150, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Optional caption" },
      { name: "character_image", type: "image", required: true, description: "Character image (the person to animate)", maxMB: 10 },
      { name: "video", type: "video", required: true, description: "Motion reference video (source of the motion to copy)", maxMB: 50 },
    ],
    options: {
      resolution: { values: ["480", "720"], default: "480", label: "Resolution" },
    },
    perSecond: { noAudio720p: 0.30, withAudio720p: 0.30, noAudio4k: 0, withAudio4k: 0 },
    guide: `**Character Replacement vs Reality/Background Change — pick correctly:**
- Use **Character Replacement** when you want your character INSIDE the source scene (same background, same camera move).
- Use **Reality/Background Change Animation** (this one) when you only want the MOTION copied — the output is a fresh clip with your character on a generated background, not the source environment.

**Same constraints as Character Replacement apply:**
- One continuous shot, no cuts in the reference video.
- 5–15s is the sweet spot.
- Full-body character image if the motion is full-body.
- One person in the reference video.

**Best motion sources**: dance clips, walking, simple gestures, sports moves with clear body posture. Bad sources: rapid martial arts (limbs blur), occluded body (props/furniture in front), camera doing fast pans.

**Audio**: not preserved here (it's a new clip). Add audio separately with MMAudio or chain into Lipsync 2 Pro.`,
  },

  // Sync Labs lip-sync — drop a video + audio track, get back the video
  // with the subject's lips matched to the audio. The Pro variant uses the
  // higher-quality path; the non-Pro is faster / cheaper.
  {
    id: "sync/lipsync-2-pro",
    name: "Lipsync 2 Pro",
    provider: "replicate", type: "v2v", category: "Video",
    description: "Sync Labs' studio-grade lip-sync. Drop any video + an audio track and it re-renders the subject's lips to match the audio. Highest-quality tier.",
    cost: "~RM0.75/s", creditCost: 75, speed: "~2m", stable: true,
    inputs: [
      { name: "video", type: "video", required: true, description: "Video to re-lip-sync", maxMB: 50 },
      { name: "audio", type: "audio", required: true, description: "Audio track the lips should match", maxMB: 50 },
    ],
    perSecond: { noAudio720p: 0.75, withAudio720p: 0.75, noAudio4k: 0, withAudio4k: 0 },
    guide: `**Video rules:**
- Subject's mouth fully visible the whole time. Heavy beards, masks, hands over mouth → poor sync.
- One face in frame at a time. Multiple faces = the model picks one, others get distorted.
- Cuts are tolerated, but each cut briefly resets the model — the first frame after a cut may have a single off mouth shape. Best results on continuous shots.
- Output duration = video duration. Trim with Scissors first if you only want part of it lip-synced.

**Audio rules:**
- **Clean isolated vocals work much better than music with vocals.** Run any music through **Vocal Extractor (Demucs)** first to strip drums + instruments → cleaner sync.
- Match the speaker's gender / pitch range — Lipsync doesn't change voice, only lips. A bass voice on a child's face still looks weird.
- Trim silence at the start of the audio (use Scissors). The model lip-syncs silence as closed mouth which can look like a "delay".

**Tier choice:**
- **Lipsync 2 Pro** (~RM0.75/s): use for client work, music videos, anything that ends up on a feed.
- **Lipsync 2** (~RM0.30/s): use for quick tests / iteration before paying for Pro on the final.

**File limits:** 50 MB each. Use the trim tool if your raw clips are bigger.`,
  },

  {
    id: "sync/lipsync-2",
    name: "Lipsync 2",
    provider: "replicate", type: "v2v", category: "Video",
    description: "Sync Labs' fast + cheap lip-sync. Same input shape as Pro — video + audio — tuned for speed over maximum fidelity.",
    cost: "~RM0.30/s", creditCost: 30, speed: "~1m", stable: true,
    guide: `Same rules as **Lipsync 2 Pro** — see that model's guide. Differences:

- **Faster + cheaper** (~1 min vs ~2 min, RM0.30/s vs RM0.75/s)
- Slightly looser lip shapes — fine for short social cuts, less convincing for tight close-ups
- Use this for iteration; switch to Pro for the final.`,
    inputs: [
      { name: "video", type: "video", required: true, description: "Video to re-lip-sync", maxMB: 50 },
      { name: "audio", type: "audio", required: true, description: "Audio track the lips should match", maxMB: 50 },
    ],
    perSecond: { noAudio720p: 0.30, withAudio720p: 0.30, noAudio4k: 0, withAudio4k: 0 },
  },

  // ═══════════════ SOUND EFFECTS ═══════════════

  {
    id: "zsxkib/mmaudio",
    name: "MMAudio V2",
    provider: "replicate", type: "sfx", category: "Sound Effects",
    description: "Video-to-audio sound effects (also accepts text-only, but weaker without a video). Best when you have a clip and need synced ambience or impact sounds.",
    cost: "~RM0.03", creditCost: 3, speed: "~10s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Sound description (e.g. 'dog barking in a park')" },
      { name: "video_url", type: "video", required: false, description: "Optional video to synchronize audio with — strongly recommended; text-only output is weak", maxMB: 20 },
    ],
    options: {
      duration: { values: ["2s", "4s", "6s", "8s", "10s"], default: "8s", label: "Duration" },
    },
  },

  // Tango 2 — DPO-tuned text-to-audio for short prompted SFX. Stronger
  // prompt adherence than MMAudio on text-only "drum noise" style asks.
  // ~$0.054/run on Replicate L40S, ~56s typical inference.
  {
    id: "declare-lab/tango",
    name: "Tango 2",
    provider: "replicate", type: "sfx", category: "Sound Effects",
    description: "Text-to-audio specialist tuned for short SFX. Reliable on literal prompts like 'kick drum hit', 'glass shattering', 'door slam'. Good fallback when MMAudio's text-only output sounds muddy.",
    cost: "~RM0.27", creditCost: 27, speed: "~1m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Sound description. Be literal and specific — 'tight kick drum, dry studio recording' beats 'cool drum vibes'." },
    ],
  },

  {
    id: "stability-ai/stable-audio-2.5",
    name: "Stable Audio 2.5",
    provider: "replicate", type: "sfx", category: "Sound Effects",
    description: "Stability AI's Stable Audio 2.5. Longer-form music + SFX, up to ~3 min.",
    cost: "~RM0.15", creditCost: 15, speed: "~30s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Music or sound effect description" },
    ],
    options: {
      duration: { values: ["10s", "30s", "60s", "120s", "190s"], default: "30s", label: "Duration" },
    },
  },

  // Full-song (lyrics + vocals + beats) generation. MiniMax 2.6 is MiniMax's
  // newest tier and handles the auto-lyrics flow when you only pass a prompt.
  // ACE-Step is the open-source cheap tier for throwaway drafts.
  {
    id: "minimax/music-2.6",
    name: "MiniMax Music 2.6",
    provider: "replicate", type: "sfx", category: "Sound Effects",
    description: "Full-length songs with singing + lyrics + instrumentation from a single prompt. Describe genre, mood, BPM, key, voice type — MiniMax writes the lyrics. Up to ~6 minutes.",
    cost: "~RM0.30", creditCost: 30, speed: "~1m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Song description — genre, mood, BPM, key, voice type, instruments" },
    ],
  },

  {
    id: "lucataco/ace-step",
    name: "ACE-Step",
    provider: "replicate", type: "sfx", category: "Sound Effects",
    description: "Open-source full-song generator. Lower fidelity than MiniMax but 4× cheaper — great for testing ideas before committing to a premium run.",
    cost: "~RM0.08", creditCost: 8, speed: "~1m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Song description — genre, mood, tempo, voice, instruments" },
    ],
  },

  // ═══════════════ VOICE ═══════════════

  {
    id: "tts-1",
    name: "OpenAI TTS",
    provider: "openai", type: "audio", category: "Voice",
    description: "OpenAI text-to-speech (tts-1). 6 built-in voices, ~$15/M chars.",
    cost: "~RM0.01", creditCost: 2, speed: "~3s", stable: true,
    inputs: [
      { name: "text", type: "text", required: true, description: "Text to read aloud" },
    ],
    options: {
      aspect_ratio: { values: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"], default: "alloy", label: "Voice" },
    },
  },

  {
    id: "fish-voice-clone-tts",
    name: "Fish Voice Clone",
    provider: "fish", type: "audio", category: "Voice",
    description: "Clone any voice from a short audio sample, then TTS with that voice.",
    cost: "~RM0.06", creditCost: 6, speed: "~10s", stable: true,
    inputs: [
      { name: "text", type: "text", required: true, description: "Text to speak" },
      { name: "audio_url", type: "audio", required: true, description: "Voice reference audio to clone", maxMB: 10 },
    ],
  },

  {
    id: "ryan5453/demucs",
    name: "Vocal Extractor (Demucs)",
    provider: "replicate", type: "a2a", category: "Voice",
    description: "Extracts isolated vocals from any music track. Use it to clean a song before tagging the audio into Lipsync 2 / Pro for sharper mouth-shape sync.",
    cost: "~RM0.15", creditCost: 15, speed: "~30s", stable: true,
    inputs: [
      { name: "audio", type: "audio", required: true, description: "Music file to extract vocals from", maxMB: 100 },
    ],
    guide: `**What it does:** strips drums, bass, and instruments from a music track and gives you back the **isolated vocals** as a WAV file.

**The killer workflow — music video lip-sync:**
1. Drop the music file → tag into Vocal Extractor → run.
2. The output is a vocals.wav item on your canvas.
3. Tag that vocals item into **Lipsync 2 Pro**'s audio slot (NOT the original music — Lipsync chokes on backing instruments).
4. Tag your talking-head video into Lipsync's video slot.
5. Result: tight mouth sync because the model sees clean vocals.

**Skip this step if:**
- Your audio is already a clean voice recording (TTS, voice memo, podcast clip).
- The track is mostly a cappella / spoken word.

**Quality tips:**
- Use the original master if you have it. Lossy MP3 → vocal artifacts → fuzzy lipsync.
- Heavy autotune / vocoder on the original = harder for Demucs. Result still works but the vocal stem may have residual instrument bleed.
- Run time scales with track length. 3-min song = ~30s. 7-min song = ~70s.

**File limit:** 100 MB. A 7-minute uncompressed WAV is roughly 70 MB — well within range.`,
  },

  // Audio-translation workflow models. No prompt needed — drop an audio clip,
  // hit generate. Server chains OpenAI Whisper (auto-language transcription)
  // → GPT-4o-mini (translation) → OpenAI TTS (synthesis) in one call. Handled
  // as a special-cased model id in src/app/api/generate/route.ts, not by a
  // generic OpenAI dispatch.
  {
    id: "translate-audio-english",
    name: "Translate Audio → English",
    provider: "openai", type: "a2a", category: "Voice",
    description: "One-click audio translation to English. Drop any audio clip (Mandarin, Malay, Tamil, Bahasa, etc.) — no prompt needed. Auto-detects source language, transcribes, translates, and synthesizes a natural English voice.",
    cost: "~RM0.30", creditCost: 30, speed: "~30s", stable: true,
    inputs: [
      { name: "audio", type: "audio", required: true, description: "Audio file to translate (any source language)", maxMB: 25 },
    ],
    guide: `**One-click audio translation.** Drop any audio file, hit generate. No prompt needed.

**Workflow under the hood:**
1. **Whisper** transcribes the source audio and auto-detects the language.
2. **GPT-4o-mini** translates the transcript to English.
3. **OpenAI TTS** synthesizes the translated text in a natural English voice (alloy).

**Best for:** translating Malay / Mandarin / Tamil customer testimonials, voice notes, interview clips to English for international audiences or subtitling prep.

**Limits:**
- Max input: 25 MB audio (~25 min at standard MP3 bitrate — Whisper API hard cap).
- Voice is a generic AI voice. The original speaker's voice is **not** preserved. For voice-preserved translation, route the translated MP3 through Fish Voice Clone manually with the original audio as the voice ref.
- Output is a clean MP3.`,
  },

  {
    id: "translate-audio-mandarin",
    name: "Translate Audio → Mandarin",
    provider: "openai", type: "a2a", category: "Voice",
    description: "One-click audio translation to Mandarin Chinese (Simplified). Drop any audio clip — no prompt needed. Auto-detects source, transcribes, translates, and synthesizes a natural Mandarin voice.",
    cost: "~RM0.30", creditCost: 30, speed: "~30s", stable: true,
    inputs: [
      { name: "audio", type: "audio", required: true, description: "Audio file to translate (any source language)", maxMB: 25 },
    ],
    guide: `**One-click audio translation to Mandarin.** Drop any audio file, hit generate. No prompt needed.

**Workflow:** Whisper transcription → GPT-4o-mini translation → OpenAI TTS (Mandarin-capable voice).

**Best for:** localising English / Malay ad VOs for Chinese-speaking Malaysian or regional audiences. Customer testimonials translated for cross-border campaigns.

**Limits:**
- Max input: 25 MB audio (Whisper cap).
- Generic AI voice — for voice-preserved translation, chain through Fish Voice Clone after with the original as the voice ref.`,
  },

  {
    id: "translate-audio-malay",
    name: "Translate Audio → Malay",
    provider: "openai", type: "a2a", category: "Voice",
    description: "One-click audio translation to Bahasa Malaysia. Drop any audio clip — no prompt needed. Auto-detects source, transcribes, translates, and synthesizes a natural Malay voice.",
    cost: "~RM0.30", creditCost: 30, speed: "~30s", stable: true,
    inputs: [
      { name: "audio", type: "audio", required: true, description: "Audio file to translate (any source language)", maxMB: 25 },
    ],
    guide: `**One-click audio translation to Bahasa Malaysia.** Drop any audio file, hit generate. No prompt needed.

**Workflow:** Whisper transcription → GPT-4o-mini translation → OpenAI TTS (multilingual voice).

**Best for:** localising English / Mandarin ad copy or testimonials into BM for local Malaysian audiences. Translating overseas client VOs into the local market language.

**Limits:**
- Max input: 25 MB audio (Whisper cap).
- Generic AI voice. TTS quality on Malay is decent but not Malaysian-accent specific — for native-accent output, chain through Fish Voice Clone with a Malaysian voice reference.`,
  },
];

export const modelCategories: ModelCategory[] = [
  "Image", "Video", "Sound Effects", "Voice",
];

export function getModelsByCategory(category: ModelCategory) {
  return models.filter((m) => m.category === category);
}

export function getModelById(id: string) {
  return models.find((m) => m.id === id);
}

export function getTypeLabel(type: ModelType): string {
  const labels: Record<ModelType, string> = {
    t2v: "T→V", i2v: "I→V", s2e: "I→V", t2i: "T→I", i2i: "I→I",
    v2v: "V→V", upscale: "Upscale", lipsync: "Lip Sync", audio: "Voice",
    a2a: "A→A", sfx: "SFX",
  };
  return labels[type];
}
