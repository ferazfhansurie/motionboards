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
  provider: "fal" | "replicate";
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

  // === Lip Sync ===

  {
    id: "fal-ai/pixverse/lipsync",
    name: "PixVerse Lipsync",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Lip sync. Requires video input + audio or text.",
    cost: "~RM0.27", creditCost: 27, speed: "~2m", stable: true,
    inputs: [
      { name: "video_url", type: "video", required: true, description: "Face video" },
      { name: "audio_url", type: "audio", required: false, description: "Audio/speech (or use text)" },
      { name: "text", type: "text", required: false, description: "TTS text when no audio provided" },
    ],
  },

  {
    id: "fal-ai/sync-lipsync/v2",
    name: "Sync Lipsync 2.0",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Standard lip sync. Requires video + audio input.",
    cost: "~RM0.35", creditCost: 35, speed: "~2m", stable: true,
    inputs: [
      { name: "video_url", type: "video", required: true, description: "Face video" },
      { name: "audio_url", type: "audio", required: true, description: "Audio/speech" },
    ],
  },

  {
    id: "fal-ai/bytedance/omnihuman/v1.5",
    name: "OmniHuman v1.5",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Full-body animation from audio. Requires image + audio.",
    cost: "~RM0.61", creditCost: 61, speed: "~5m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Video generation guidance (optional)" },
      { name: "image_url", type: "image", required: true, description: "Character image" },
      { name: "audio_url", type: "audio", required: true, description: "Driving audio" },
    ],
  },

  {
    id: "fal-ai/infinitalk",
    name: "InfiniteTalk (Image+Audio)",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Image + audio → lip-synced video. Full-body animation with natural motion.",
    cost: "~RM0.85", creditCost: 85, speed: "~7m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
      { name: "image_url", type: "image", required: true, description: "Character image" },
      { name: "audio_url", type: "audio", required: true, description: "Audio/speech file" },
    ],
    options: {
      resolution: { values: ["480p", "720p"], default: "480p", label: "Resolution" },
    },
  },

  {
    id: "fal-ai/infinitalk/video-to-video",
    name: "InfiniteTalk (Video Lip-Sync)",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Sync a video with a new vocal track. Upload close-up video + audio clip.",
    cost: "~RM0.83", creditCost: 83, speed: "~7m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
      { name: "video_url", type: "video", required: true, description: "Close-up face video" },
      { name: "audio_url", type: "audio", required: true, description: "New vocal track" },
    ],
    options: {
      resolution: { values: ["480p", "720p"], default: "480p", label: "Resolution" },
    },
  },

  // === Audio & Music ===

  {
    id: "fal-ai/minimax/speech-02-hd",
    name: "MiniMax Speech-02 HD",
    provider: "fal", type: "audio", category: "Audio & Music",
    description: "Text-to-speech with predefined voices.",
    cost: "~RM0.07", creditCost: 7, speed: "~10s", stable: true,
    inputs: [
      { name: "text", type: "text", required: true, description: "Text to speak" },
    ],
  },

  {
    id: "resemble-ai/chatterboxhd/text-to-speech",
    name: "Chatterbox HD TTS",
    provider: "fal", type: "audio", category: "Audio & Music",
    description: "Text-to-speech with zero-shot voice cloning. Pass audio for custom voice.",
    cost: "~RM0.10", creditCost: 10, speed: "~10s", stable: true,
    inputs: [
      { name: "text", type: "text", required: true, description: "Text to speak" },
      { name: "audio_url", type: "audio", required: false, description: "Voice reference (optional)" },
    ],
  },

  {
    id: "fal-ai/sam-audio/separate",
    name: "Audio Separator",
    provider: "fal", type: "a2a", category: "Audio & Music",
    description: "Separate any sound from audio. Describe what to isolate (e.g. 'vocals', 'drums').",
    cost: "~RM0.08", creditCost: 8, speed: "~15s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Sound to isolate (e.g. 'vocals')" },
      { name: "audio_url", type: "audio", required: true, description: "Audio file" },
    ],
  },

  {
    id: "fal-ai/elevenlabs/audio-isolation",
    name: "Voice Isolation (ElevenLabs)",
    provider: "fal", type: "a2a", category: "Audio & Music",
    description: "Isolate voice from background noise in audio or video files.",
    cost: "~RM0.05", creditCost: 5, speed: "~10s", stable: true,
    inputs: [
      { name: "audio_url", type: "audio", required: true, description: "Audio or video file" },
    ],
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
