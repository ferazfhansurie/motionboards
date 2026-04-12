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
  provider: "replicate" | "segmind" | "gemini" | "fish";
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
  "Concept Art & Style", "Audio & Music",
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
