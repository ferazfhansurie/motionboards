export type ModelType =
  | "t2v" | "i2v" | "s2e" | "t2i" | "i2i" | "v2v" | "upscale" | "lipsync" | "audio" | "a2a";

export type ModelCategory =
  | "Cinematic Video Gen" | "Video Editing" | "Upscale & Restoration"
  | "Concept Art & Style" | "Character & Fashion" | "Lip Sync" | "Audio & Music"
  | "Image Editing" | "Face & Body";

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
  noAudio720p: number;   // RM per second, 720p/1080p, no audio
  withAudio720p: number; // RM per second, 720p/1080p, with audio
  noAudio4k: number;     // RM per second, 4k, no audio
  withAudio4k: number;   // RM per second, 4k, with audio
}

export interface AIModel {
  id: string;
  name: string;
  provider: "openai" | "replicate" | "segmind" | "gemini" | "fish";
  type: ModelType;
  category: ModelCategory;
  description: string;
  cost: string;
  creditCost: number;
  speed: string;
  inputs: ModelInput[];
  stable: boolean;
  options?: ModelOptions;
  perSecond?: PerSecondRate; // For per-second billed models
}

// Rate: 1 USD = 3.7 RM. Margin: +RM0.03 photo/audio, +RM0.05 video
// Veo 3.1 via direct Gemini API: audio is ALWAYS ON — cannot be disabled.
// 1080p and 4k only work with 8s duration; reference images also force 8s.

export const models: AIModel[] = [
  // === Image Generation ===

  {
    id: "gemini-3.1-flash-image-preview",
    name: "Nano Banana 2",
    provider: "gemini", type: "t2i", category: "Concept Art & Style",
    description: "Google's image generation via direct Gemini API (~$0.02/image).",
    cost: "~RM0.10", creditCost: 10, speed: "~15s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Image description" },
      { name: "image_urls", type: "image", required: false, description: "Reference images (optional)" },
    ],
    options: {
      aspect_ratio: { values: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"], default: "auto", label: "Aspect Ratio" },
      resolution: { values: ["0.5K", "1K", "2K", "4K"], default: "1K", label: "Resolution" },
    },
  },

  // === Cinematic Video Gen — Sora 2 Pro (direct OpenAI API) ===

  {
    id: "sora-2-pro",
    name: "Sora 2 Pro T2V",
    provider: "openai", type: "t2v", category: "Cinematic Video Gen",
    description: "OpenAI Sora 2 Pro text-to-video via direct API. Audio is always generated — cannot be disabled.",
    cost: "RM1.16/s", creditCost: 928, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "8s", "12s"], default: "8s", label: "Duration" },
    },
    perSecond: { noAudio720p: 1.16, withAudio720p: 1.16, noAudio4k: 1.16, withAudio4k: 1.16 },
  },

  {
    id: "sora-2-pro/i2v",
    name: "Sora 2 Pro I2V",
    provider: "openai", type: "i2v", category: "Cinematic Video Gen",
    description: "OpenAI Sora 2 Pro image-to-video via direct API. Audio always on.",
    cost: "RM9.28", creditCost: 928, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How to animate the image" },
      { name: "image_url", type: "image", required: true, description: "Image to animate" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "8s", "12s"], default: "8s", label: "Duration" },
    },
    perSecond: { noAudio720p: 1.16, withAudio720p: 1.16, noAudio4k: 1.16, withAudio4k: 1.16 },
  },

  // === Cinematic Video Gen — Veo 3.1 (direct Google Gemini API) ===

  {
    id: "veo-3.1-fast-generate-preview",
    name: "Veo 3.1 Fast T2V",
    provider: "gemini", type: "t2v", category: "Cinematic Video Gen",
    description: "Google Veo 3.1 Fast text-to-video via direct Gemini API. Audio is always generated — cannot be disabled. 1080p/4k require 8s duration.",
    cost: "RM0.42/s", creditCost: 336, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "6s", "8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p", "4k"], default: "720p", label: "Resolution (1080p/4k need 8s)" },
    },
    perSecond: { noAudio720p: 0.42, withAudio720p: 0.42, noAudio4k: 1.16, withAudio4k: 1.16 },
  },

  {
    id: "veo-3.1-fast-generate-preview/i2v",
    name: "Veo 3.1 Fast I2V",
    provider: "gemini", type: "i2v", category: "Cinematic Video Gen",
    description: "Google Veo 3.1 Fast image-to-video via direct Gemini API. Audio always on. Reference image forces 8s duration.",
    cost: "RM3.36", creditCost: 336, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How to animate the image" },
      { name: "image_url", type: "image", required: true, description: "Image to animate" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p", "4k"], default: "720p", label: "Resolution" },
    },
    perSecond: { noAudio720p: 0.42, withAudio720p: 0.42, noAudio4k: 1.16, withAudio4k: 1.16 },
  },

  {
    id: "veo-3.1-fast-generate-preview/s2e",
    name: "Veo 3.1 Fast S2E",
    provider: "gemini", type: "s2e", category: "Cinematic Video Gen",
    description: "Google Veo 3.1 Fast first-to-last-frame video via direct Gemini API. Audio always on. Fixed at 8s.",
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
    },
    perSecond: { noAudio720p: 0.42, withAudio720p: 0.42, noAudio4k: 1.16, withAudio4k: 1.16 },
  },

  {
    id: "veo-3.1-lite-generate-preview",
    name: "Veo 3.1 Lite T2V",
    provider: "gemini", type: "t2v", category: "Cinematic Video Gen",
    description: "Google Veo 3.1 Lite text-to-video via direct Gemini API. Cheapest Veo tier. Audio always on. 4K not supported.",
    cost: "RM0.24/s", creditCost: 192, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "6s", "8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "720p", label: "Resolution (1080p needs 8s)" },
    },
    perSecond: { noAudio720p: 0.24, withAudio720p: 0.24, noAudio4k: 0, withAudio4k: 0 },
  },

  {
    id: "veo-3.1-lite-generate-preview/i2v",
    name: "Veo 3.1 Lite I2V",
    provider: "gemini", type: "i2v", category: "Cinematic Video Gen",
    description: "Google Veo 3.1 Lite image-to-video via direct Gemini API. Cheapest Veo tier. Audio always on. 4K not supported.",
    cost: "RM1.92", creditCost: 192, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How to animate the image" },
      { name: "image_url", type: "image", required: true, description: "Image to animate" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["8s"], default: "8s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "720p", label: "Resolution" },
    },
    perSecond: { noAudio720p: 0.24, withAudio720p: 0.24, noAudio4k: 0, withAudio4k: 0 },
  },

  // === Cinematic Video Gen — Seedance 2.0 (Replicate) ===

  {
    id: "bytedance/seedance-2.0",
    name: "Seedance 2.0 T2V",
    provider: "replicate", type: "t2v", category: "Cinematic Video Gen",
    description: "ByteDance Seedance 2.0 text-to-video via Replicate. Multimodal inputs, native audio (toggleable), intelligent duration control.",
    cost: "~RM0.57/s", creditCost: 285, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description. Use @image1, @video1, @audio1 to reference inputs." },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "5s", "6s", "8s", "10s"], default: "5s", label: "Duration" },
      resolution: { values: ["480p", "720p"], default: "720p", label: "Resolution" },
      generate_audio: { default: true, label: "Generate Audio" },
    },
    perSecond: { noAudio720p: 0.57, withAudio720p: 0.57, noAudio4k: 0, withAudio4k: 0 },
  },

  {
    id: "bytedance/seedance-2.0/i2v",
    name: "Seedance 2.0 I2V",
    provider: "replicate", type: "i2v", category: "Cinematic Video Gen",
    description: "ByteDance Seedance 2.0 image-to-video via Replicate. Audio toggleable.",
    cost: "~RM2.85", creditCost: 285, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "How to animate the image" },
      { name: "image_url", type: "image", required: true, description: "Starting frame image" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "5s", "6s", "8s", "10s"], default: "5s", label: "Duration" },
      resolution: { values: ["480p", "720p"], default: "720p", label: "Resolution" },
      generate_audio: { default: true, label: "Generate Audio" },
    },
    perSecond: { noAudio720p: 0.57, withAudio720p: 0.57, noAudio4k: 0, withAudio4k: 0 },
  },

  // === Voice / TTS ===

  {
    id: "fish-voice-clone-tts",
    name: "Voice Clone TTS",
    provider: "fish", type: "audio", category: "Audio & Music",
    description: "Fast voice cloning TTS via Fish Audio. Upload a voice reference and type what to say.",
    cost: "~RM0.06", creditCost: 6, speed: "~10s", stable: true,
    inputs: [
      { name: "text", type: "text", required: true, description: "Text to speak" },
      { name: "audio_url", type: "audio", required: true, description: "Voice reference audio (clone this voice)" },
    ],
  },

];

export const modelCategories: ModelCategory[] = [
  "Concept Art & Style", "Cinematic Video Gen", "Audio & Music",
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
    v2v: "V→V", upscale: "Upscale", lipsync: "Lip Sync", audio: "Audio",
    a2a: "A→A",
  };
  return labels[type];
}
