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

export interface AIModel {
  id: string;
  name: string;
  provider: "fal" | "replicate" | "segmind";
  type: ModelType;
  category: ModelCategory;
  description: string;
  cost: string;
  creditCost: number;
  speed: string;
  inputs: ModelInput[];
  stable: boolean;
  options?: ModelOptions;
}

// Rate: 1 USD = 3.7 RM. Margin: +RM0.03 photo/audio, +RM0.05 video
// Inputs verified against fal.ai API docs (2026-03-25)

export const models: AIModel[] = [
  // === Image Generation ===

  {
    id: "fal-ai/nano-banana-2",
    name: "Nano Banana 2",
    provider: "fal", type: "t2i", category: "Concept Art & Style",
    description: "Google's latest state-of-the-art fast image generation.",
    cost: "~RM0.18", creditCost: 18, speed: "~30s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Image description" },
    ],
    options: {
      aspect_ratio: { values: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"], default: "auto", label: "Aspect Ratio" },
      resolution: { values: ["0.5K", "1K", "2K", "4K"], default: "1K", label: "Resolution" },
    },
  },

  // === Cinematic Video Gen ===

  {
    id: "fal-ai/veo3.1/first-last-frame-to-video",
    name: "Veo 3.1 S2E",
    provider: "fal", type: "s2e", category: "Cinematic Video Gen",
    description: "Veo 3.1 start-to-end video. Requires Start Frame and End Frame images.",
    cost: "~RM0.35", creditCost: 35, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
      { name: "first_frame_url", type: "image", required: true, description: "Start frame image" },
      { name: "last_frame_url", type: "image", required: true, description: "End frame image" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "auto"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "6s", "8s"], default: "6s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "720p", label: "Resolution" },
    },
  },

  // === Nano Banana 2 Edit (image editing) ===

  {
    id: "fal-ai/nano-banana-2/edit",
    name: "Nano Banana 2 Edit",
    provider: "fal", type: "i2i", category: "Concept Art & Style",
    description: "Edit images with text prompts. Upload images and describe changes.",
    cost: "~RM0.20", creditCost: 20, speed: "~30s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Edit description" },
      { name: "image_urls", type: "image", required: true, description: "Images to edit" },
    ],
    options: {
      aspect_ratio: { values: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"], default: "auto", label: "Aspect Ratio" },
      resolution: { values: ["0.5K", "1K", "2K", "4K"], default: "1K", label: "Resolution" },
    },
  },


  // === Seedance (ByteDance) ===

  {
    id: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    name: "Seedance 1.5 Pro I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "ByteDance Seedance 1.5 Pro. Image-to-video with audio generation.",
    cost: "~RM0.85", creditCost: 85, speed: "~5m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
      { name: "image_url", type: "image", required: true, description: "Starting image" },
      { name: "end_image_url", type: "image", required: false, description: "End frame (optional)" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "4:3", "1:1", "3:4", "21:9", "auto"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4", "5", "6", "7", "8", "9", "10", "11", "12"], default: "5", label: "Duration (sec)" },
      resolution: { values: ["480p", "720p", "1080p"], default: "720p", label: "Resolution" },
      generate_audio: { default: true, label: "Generate Audio" },
    },
  },

  {
    id: "fal-ai/bytedance/seedance/v1/pro/fast/image-to-video",
    name: "Seedance 1.0 Pro Fast I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "Seedance 1.0 Pro Fast. Quick image-to-video, up to 1080p.",
    cost: "~RM0.50", creditCost: 50, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
      { name: "image_url", type: "image", required: true, description: "Starting image" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "4:3", "1:1", "3:4", "21:9", "auto"], default: "auto", label: "Aspect Ratio" },
      duration: { values: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], default: "5", label: "Duration (sec)" },
      resolution: { values: ["480p", "720p", "1080p"], default: "1080p", label: "Resolution" },
    },
  },

  {
    id: "fal-ai/bytedance/seedance/v1/lite/image-to-video",
    name: "Seedance 1.0 Lite I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "Seedance 1.0 Lite. Fast, efficient image-to-video.",
    cost: "~RM0.30", creditCost: 30, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
      { name: "image_url", type: "image", required: true, description: "Starting image" },
      { name: "end_image_url", type: "image", required: false, description: "End frame (optional)" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "4:3", "1:1", "3:4", "21:9", "auto"], default: "auto", label: "Aspect Ratio" },
      duration: { values: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], default: "5", label: "Duration (sec)" },
      resolution: { values: ["480p", "720p", "1080p"], default: "720p", label: "Resolution" },
    },
  },

  {
    id: "fal-ai/bytedance/seedance/v1/lite/text-to-video",
    name: "Seedance 1.0 Lite T2V",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Seedance 1.0 Lite text-to-video. Multiple aspect ratios and durations.",
    cost: "~RM0.30", creditCost: 30, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "4:3", "1:1", "3:4", "21:9", "9:21"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], default: "5", label: "Duration (sec)" },
      resolution: { values: ["480p", "720p", "1080p"], default: "720p", label: "Resolution" },
    },
  },

  // === Lip Sync ===

  {
    id: "fal-ai/bytedance/omnihuman/v1.5",
    name: "OmniHuman v1.5",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Full-body lip sync from image + audio. Natural expressions and body movement.",
    cost: "~RM0.61", creditCost: 61, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Video guidance (optional)" },
      { name: "image_url", type: "image", required: true, description: "Character image" },
      { name: "audio_url", type: "audio", required: true, description: "Audio/speech file" },
    ],
  },

  {
    id: "fal-ai/creatify/aurora",
    name: "Creatify Aurora",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Studio-quality talking avatar from image + audio. Great for UGC ads.",
    cost: "~RM0.75", creditCost: 75, speed: "~5m", stable: true,
    inputs: [
      { name: "image_url", type: "image", required: true, description: "Character image" },
      { name: "audio_url", type: "audio", required: true, description: "Audio/speech file" },
    ],
  },

  {
    id: "fal-ai/sync-lipsync/v2",
    name: "Sync Lipsync 2.0",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Video + audio lip sync. Upload a face video and new audio to re-sync.",
    cost: "~RM0.35", creditCost: 35, speed: "~2m", stable: true,
    inputs: [
      { name: "video_url", type: "video", required: true, description: "Face video" },
      { name: "audio_url", type: "audio", required: true, description: "Audio/speech" },
    ],
  },

  // === Voice / TTS ===

  {
    id: "fal-ai/qwen-3-tts/text-to-speech/0.6b",
    name: "Voice Clone TTS",
    provider: "fal", type: "audio", category: "Audio & Music",
    description: "Text-to-speech with voice cloning. Upload a voice reference audio and type what to say.",
    cost: "~RM0.10", creditCost: 10, speed: "~30s", stable: true,
    inputs: [
      { name: "text", type: "text", required: true, description: "Text to speak" },
      { name: "audio_url", type: "audio", required: true, description: "Voice reference audio (clone this voice)" },
    ],
  },

  // === Image Editing ===

  {
    id: "fal-ai/gemini-3-pro-image-preview/edit",
    name: "Nano Banana Pro Edit",
    provider: "fal", type: "i2i", category: "Concept Art & Style",
    description: "Edit images with Gemini 3 Pro (Nano Banana Pro). Upload images and describe changes.",
    cost: "~RM0.25", creditCost: 25, speed: "~30s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Edit description" },
      { name: "image_urls", type: "image", required: true, description: "Images to edit" },
    ],
    options: {
      aspect_ratio: { values: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"], default: "auto", label: "Aspect Ratio" },
      resolution: { values: ["1K", "2K", "4K"], default: "1K", label: "Resolution" },
    },
  },
];

export const modelCategories: ModelCategory[] = [
  "Concept Art & Style", "Cinematic Video Gen", "Lip Sync", "Audio & Music",
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
