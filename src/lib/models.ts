export type ModelType =
  | "t2v" | "i2v" | "s2e" | "t2i" | "i2i" | "v2v" | "upscale" | "lipsync" | "audio" | "a2a" | "sfx";

export type ModelCategory =
  | "Image" | "Video" | "Sound Effects" | "Voice";

export interface ModelInput {
  name: string;
  type: "text" | "image" | "video" | "audio";
  required: boolean;
  description: string;
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
}

// Rate: 1 USD = 3.7 RM. Margin: +RM0.03 photo/audio, +RM0.05 video
// Curated catalog: the 2 cheapest models per category.

export const models: AIModel[] = [
  // ═══════════════ IMAGE ═══════════════

  {
    id: "gemini-3.1-flash-image-preview",
    name: "Nano Banana 2",
    provider: "gemini", type: "t2i", category: "Image",
    description: "Google's Gemini 3.1 Flash Image. Fast, photoreal, and the current price/quality leader.",
    cost: "~RM0.10", creditCost: 10, speed: "~15s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Image description" },
      { name: "image_urls", type: "image", required: false, description: "Reference images (optional)" },
    ],
    options: {
      aspect_ratio: { values: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"], default: "auto", label: "Aspect Ratio" },
      resolution: { values: ["0.5K", "1K", "2K"], default: "1K", label: "Resolution" },
    },
  },

  {
    id: "black-forest-labs/flux-schnell",
    name: "FLUX Schnell",
    provider: "replicate", type: "t2i", category: "Image",
    description: "Black Forest Labs FLUX.1 [schnell]. 4-step distilled, ~1s per image on Replicate.",
    cost: "~RM0.02", creditCost: 2, speed: "~3s", stable: true,
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
      { name: "image_url", type: "image", required: true, description: "Image to animate" },
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
      { name: "image_url", type: "image", required: true, description: "Image to animate" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p", "4k"], default: "720p", label: "Resolution" },
      generate_audio: { default: true, label: "Audio" },
    },
    perSecond: { noAudio720p: 0.42, withAudio720p: 0.42, noAudio4k: 1.16, withAudio4k: 1.16 },
  },

  {
    id: "veo-3.1-fast-generate-preview/s2e",
    name: "Veo 3.1 Fast S2E",
    provider: "gemini", type: "s2e", category: "Video",
    description: "Veo 3.1 Fast first-to-last-frame video. Native audio toggle. Fixed at 8s.",
    cost: "RM3.36", creditCost: 336, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
      { name: "first_frame_url", type: "image", required: true, description: "Start frame image" },
      { name: "last_frame_url", type: "image", required: true, description: "End frame image" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p", "4k"], default: "720p", label: "Resolution" },
      generate_audio: { default: true, label: "Audio" },
    },
    perSecond: { noAudio720p: 0.42, withAudio720p: 0.42, noAudio4k: 1.16, withAudio4k: 1.16 },
  },

  // Seedance 2.0 talks to ByteDance ModelArk directly — not Replicate — so
  // we get access to 1080p, the Fast variant, and official billing.
  //
  //   base URL: https://ark.ap-southeast.bytepluses.com/api/v3
  //   POST /contents/generations/tasks → task ID
  //   GET  /contents/generations/tasks/{id} → status + content.video_url
  //
  // The id we store here IS the ARK model id so the route can send it as-is.
  {
    id: "dreamina-seedance-2-0-260128",
    name: "Seedance 2.0",
    provider: "byteplus", type: "t2v", category: "Video",
    description: "ByteDance Seedance 2.0 (direct API). Multimodal cinematic video with native audio, realistic physics, 1080p available.",
    cost: "~RM0.67/s (720p)", creditCost: 335, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Scene description with camera moves, lighting, mood" },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p", "1080p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.67, withAudio720p: 0.67, noAudio4k: 0, withAudio4k: 0 },
  },

  {
    id: "dreamina-seedance-2-0-260128/i2v",
    name: "Seedance 2.0 I2V",
    provider: "byteplus", type: "i2v", category: "Video",
    description: "Seedance 2.0 image-to-video (direct API). Animate a character or product shot into a cinematic clip with native audio.",
    cost: "~RM0.67/s (720p)", creditCost: 335, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How the image should animate" },
      { name: "image_url", type: "image", required: true, description: "Image to animate" },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p", "1080p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.67, withAudio720p: 0.67, noAudio4k: 0, withAudio4k: 0 },
  },

  {
    id: "dreamina-seedance-2-0-260128/s2e",
    name: "Seedance 2.0 S2E",
    provider: "byteplus", type: "s2e", category: "Video",
    description: "Seedance 2.0 start-to-end (direct API). Give it a start frame + end frame and it animates the transition with native audio.",
    cost: "~RM0.67/s (720p)", creditCost: 335, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Describe the transition between the two frames" },
      { name: "first_frame_url", type: "image", required: true, description: "Start frame image" },
      { name: "last_frame_url", type: "image", required: true, description: "End frame image" },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p", "1080p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.67, withAudio720p: 0.67, noAudio4k: 0, withAudio4k: 0 },
  },

  {
    id: "dreamina-seedance-2-0-fast-260128",
    name: "Seedance 2.0 Fast",
    provider: "byteplus", type: "t2v", category: "Video",
    description: "Seedance 2.0 Fast — cheaper + quicker variant. Up to 720p. Same multimodal prompt + image refs, same native audio.",
    cost: "~RM0.46/s (720p)", creditCost: 230, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Scene description with camera moves, lighting, mood" },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.46, withAudio720p: 0.46, noAudio4k: 0, withAudio4k: 0 },
  },

  {
    id: "dreamina-seedance-2-0-fast-260128/i2v",
    name: "Seedance 2.0 Fast I2V",
    provider: "byteplus", type: "i2v", category: "Video",
    description: "Seedance 2.0 Fast image-to-video. Cheaper + quicker animate-an-image route, up to 720p.",
    cost: "~RM0.46/s (720p)", creditCost: 230, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How the image should animate" },
      { name: "image_url", type: "image", required: true, description: "Image to animate" },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.46, withAudio720p: 0.46, noAudio4k: 0, withAudio4k: 0 },
  },

  {
    id: "dreamina-seedance-2-0-fast-260128/s2e",
    name: "Seedance 2.0 Fast S2E",
    provider: "byteplus", type: "s2e", category: "Video",
    description: "Seedance 2.0 Fast start-to-end. Start + end frame transition at the cheaper Fast tier.",
    cost: "~RM0.46/s (720p)", creditCost: 230, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Describe the transition between the two frames" },
      { name: "first_frame_url", type: "image", required: true, description: "Start frame image" },
      { name: "last_frame_url", type: "image", required: true, description: "End frame image" },
    ],
    options: {
      aspect_ratio: { values: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9", label: "Aspect Ratio" },
      resolution: { values: ["480p", "720p"], default: "720p", label: "Resolution" },
      duration: { values: ["4s", "5s", "6s", "7s", "8s", "10s", "12s", "15s"], default: "5s", label: "Duration" },
      generate_audio: { default: true, label: "Native audio" },
    },
    perSecond: { noAudio720p: 0.46, withAudio720p: 0.46, noAudio4k: 0, withAudio4k: 0 },
  },

  {
    id: "comfy/wan-animate-pose",
    name: "Wan 2.2 Animate — Pose to Character",
    provider: "comfy", type: "v2v", category: "Video",
    description: "Upload a character image and a pose reference video. Wan Animate generates a pose estimation internally and renders your character performing the same motion, preserving camera movement and lighting. Runs on Comfy Cloud.",
    cost: "~RM1.50", creditCost: 150, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Optional caption" },
      { name: "character_image", type: "image", required: true, description: "Character image (the person to render)" },
      { name: "video", type: "video", required: true, description: "Pose reference video (motion + camera are preserved)" },
    ],
  },

  // ═══════════════ SOUND EFFECTS ═══════════════

  {
    id: "zsxkib/mmaudio",
    name: "MMAudio V2",
    provider: "replicate", type: "sfx", category: "Sound Effects",
    description: "Text-to-audio or video-to-audio sound effects. Ultra cheap (~$0.006/run on Replicate).",
    cost: "~RM0.03", creditCost: 3, speed: "~10s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Sound description (e.g. 'dog barking in a park')" },
      { name: "video_url", type: "video", required: false, description: "Optional video to synchronize audio with" },
    ],
    options: {
      duration: { values: ["2s", "4s", "6s", "8s", "10s"], default: "8s", label: "Duration" },
    },
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
      { name: "audio_url", type: "audio", required: true, description: "Voice reference audio to clone" },
    ],
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
