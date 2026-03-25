export type ModelType =
  | "t2v" | "i2v" | "s2e" | "t2i" | "i2i" | "v2v" | "upscale" | "lipsync" | "audio";

export type ModelCategory =
  | "Cinematic Video Gen" | "Video Editing" | "Upscale & Restoration"
  | "Concept Art & Style" | "Character & Fashion" | "Lip Sync" | "Audio & Music";

export interface ModelInput {
  name: string;
  type: "text" | "image" | "video" | "audio";
  required: boolean;
  description: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: "fal" | "replicate";
  type: ModelType;
  category: ModelCategory;
  description: string;
  cost: string;
  creditCost: number; // sen (100 = RM1.00)
  speed: string;
  inputs: ModelInput[];
  stable: boolean;
}

// Rate: 1 USD = 3.7 RM
// Margin: +RM0.03 photo/audio, +RM0.05 video
// Actual costs from fal.ai billing + pricing API

export const models: AIModel[] = [
  // === Cinematic Video Gen ===
  // Veo 3.1: $0.08/gen (from billing) → RM0.296 + 0.05 = RM0.35
  {
    id: "fal-ai/veo3",
    name: "Veo 3.1 Fast T2V",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Veo 3.1 Fast text-to-video with native synchronized audio and cinematic motion. 8-second generation.",
    cost: "~RM0.35", creditCost: 35, speed: "~3m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },
  {
    id: "fal-ai/veo3/s2e",
    name: "Veo 3.1 Fast S2E",
    provider: "fal", type: "s2e", category: "Cinematic Video Gen",
    description: "Veo 3.1 start-to-end video with separate Start Frame and End Frame controls plus synchronized audio.",
    cost: "~RM0.35", creditCost: 35, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
      { name: "start_frame", type: "image", required: false, description: "Start frame reference image" },
      { name: "end_frame", type: "image", required: false, description: "End frame reference image" },
    ],
  },
  {
    id: "fal-ai/veo3/i2v",
    name: "Veo 3.1 Fast I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "Veo 3.1 Fast image-to-video guided by one to three reference images.",
    cost: "~RM0.35", creditCost: 35, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Motion description" },
      { name: "image_url", type: "image", required: true, description: "Reference image" },
    ],
  },
  // Sora 2: compute-second pricing, ~$0.10/gen estimated → RM0.37 + 0.05 = RM0.42
  {
    id: "fal-ai/sora/v2",
    name: "Sora 2 T2V",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "OpenAI Sora 2 text-to-video. 720p, native audio, character IDs.",
    cost: "~RM0.42", creditCost: 42, speed: "~3m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },
  // Sora 2 Pro: ~$0.20/gen estimated → RM0.74 + 0.05 = RM0.79
  {
    id: "fal-ai/sora/v2/pro",
    name: "Sora 2 Pro",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Sora 2 Pro up to 1080p. 4-20 sec duration.",
    cost: "~RM0.79", creditCost: 79, speed: "~5m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },
  // Kling 3.0 Pro: $0.14/sec API, ~5s = $0.70 → RM2.59 + 0.05 = RM2.64
  {
    id: "fal-ai/kling-video/v3/pro/text-to-video",
    name: "Kling 3.0 Pro",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Kling 3.0 Pro text-to-video with native audio and voice control. Multi-shot.",
    cost: "~RM2.64", creditCost: 264, speed: "~4m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },
  {
    id: "fal-ai/kling-video/v3/pro/image-to-video",
    name: "Kling 3.0 Pro I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "Kling 3.0 Pro image-to-video with elements and audio.",
    cost: "~RM2.64", creditCost: 264, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Motion description" },
      { name: "image_url", type: "image", required: true, description: "Reference image" },
    ],
  },
  // Wan 2.1 14B: compute-second, ~$0.08/gen → RM0.296 + 0.05 = RM0.35
  {
    id: "fal-ai/wan/v2.1/14b/text-to-video",
    name: "Wan 2.1 (14B)",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "High quality text-to-video generation. LoRA support.",
    cost: "~RM0.35", creditCost: 35, speed: "~2m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },
  {
    id: "fal-ai/wan/v2.1/14b/image-to-video",
    name: "Wan 2.1 I2V (14B)",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "High quality image-to-video with LoRA.",
    cost: "~RM0.35", creditCost: 35, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Motion description" },
      { name: "image_url", type: "image", required: true, description: "Reference image" },
    ],
  },
  // Wan 2.1 1.3B: $0.20/video (API confirmed) → RM0.74 + 0.05 = RM0.79
  {
    id: "fal-ai/wan/v2.1/1.3b/text-to-video",
    name: "Wan 2.1 (1.3B) Fast",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Fast, lightweight video generation.",
    cost: "~RM0.79", creditCost: 79, speed: "~30s", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },
  // LTX 2.3 Pro: compute-second $0.00125, ~$0.06/gen → RM0.222 + 0.05 = RM0.27
  {
    id: "fal-ai/ltx-video/v2.3/pro/text-to-video",
    name: "LTX 2.3 Pro T2V",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Great value. Up to 4K. Audio. LoRA support.",
    cost: "~RM0.27", creditCost: 27, speed: "~2m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },
  // LTX 2.3 Fast: ~$0.03/gen → RM0.111 + 0.05 = RM0.16
  {
    id: "fal-ai/ltx-video/v2.3/fast/text-to-video",
    name: "LTX 2.3 Fast T2V",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Cheapest fast video with audio.",
    cost: "~RM0.16", creditCost: 16, speed: "~30s", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },
  // Hailuo-02 Pro: ~$0.10/gen → RM0.37 + 0.05 = RM0.42
  {
    id: "fal-ai/hailuo/video-02/pro/image-to-video",
    name: "Hailuo-02 Pro I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "1080p. Physics simulation. Great realism.",
    cost: "~RM0.42", creditCost: 42, speed: "~8m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Motion description" },
      { name: "image_url", type: "image", required: true, description: "Reference image" },
    ],
  },
  // Seedance 1.0: ~$0.10/gen → RM0.37 + 0.05 = RM0.42
  {
    id: "fal-ai/seedance/v1/pro",
    name: "Seedance 1.0 Pro",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "Dance/motion specialized I2V. Great for character animation.",
    cost: "~RM0.42", creditCost: 42, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Motion description" },
      { name: "image_url", type: "image", required: true, description: "Character image" },
    ],
  },
  // PixVerse v5.5: ~$0.08/gen → RM0.296 + 0.05 = RM0.35
  {
    id: "fal-ai/pixverse/v5.5/image-to-video",
    name: "PixVerse v5.5 I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "Style presets. Good for creative/stylized video.",
    cost: "~RM0.35", creditCost: 35, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Motion description" },
      { name: "image_url", type: "image", required: true, description: "Reference image" },
    ],
  },

  // === Video Editing ===
  // Kling O3 V2V: ~$0.12/gen → RM0.444 + 0.05 = RM0.49
  {
    id: "fal-ai/kling-video/o3/v2v",
    name: "Kling O3 V2V Edit",
    provider: "fal", type: "v2v", category: "Video Editing",
    description: "Edit any video with element replacement.",
    cost: "~RM0.49", creditCost: 49, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Edit instructions" },
      { name: "video_url", type: "video", required: true, description: "Source video" },
    ],
  },
  {
    id: "fal-ai/kling-video/v3/pro/motion-control",
    name: "Kling 3.0 Motion Transfer",
    provider: "fal", type: "v2v", category: "Video Editing",
    description: "Transfer motion from reference video.",
    cost: "~RM0.49", creditCost: 49, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Description" },
      { name: "video_url", type: "video", required: true, description: "Motion reference video" },
      { name: "image_url", type: "image", required: false, description: "Subject image" },
    ],
  },
  // LTX Extend: compute-second $0.00125, ~$0.06/gen → RM0.222 + 0.05 = RM0.27
  {
    id: "fal-ai/ltx-video/v2.3/pro/extend",
    name: "LTX 2.3 Extend",
    provider: "fal", type: "v2v", category: "Video Editing",
    description: "Extend video duration seamlessly.",
    cost: "~RM0.27", creditCost: 27, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Description for extension" },
      { name: "video_url", type: "video", required: true, description: "Video to extend" },
    ],
  },

  // === Upscale & Restoration ===
  // Topaz Video: ~$0.05/gen → RM0.185 + 0.05 = RM0.24
  {
    id: "fal-ai/topaz/video",
    name: "Topaz Video Upscale",
    provider: "fal", type: "upscale", category: "Upscale & Restoration",
    description: "10 AI models. Frame interpolation to 60fps. Best upscaler.",
    cost: "~RM0.24", creditCost: 24, speed: "~2m", stable: true,
    inputs: [{ name: "video_url", type: "video", required: true, description: "Video to upscale" }],
  },
  // Topaz Image: compute-second, ~$0.02/gen → RM0.074 + 0.03 = RM0.10
  {
    id: "fal-ai/topaz/image",
    name: "Topaz Image Upscale",
    provider: "fal", type: "upscale", category: "Upscale & Restoration",
    description: "Face enhancement, denoising, sharpening.",
    cost: "~RM0.10", creditCost: 10, speed: "~30s", stable: true,
    inputs: [{ name: "image_url", type: "image", required: true, description: "Image to upscale" }],
  },
  // SeedVR2: ~$0.01/gen → RM0.037 + 0.03 = RM0.07
  {
    id: "fal-ai/seedvr2",
    name: "SeedVR2 Upscale",
    provider: "fal", type: "upscale", category: "Upscale & Restoration",
    description: "Extremely cheap. Up to 10x upscale.",
    cost: "~RM0.07", creditCost: 7, speed: "~20s", stable: true,
    inputs: [{ name: "image_url", type: "image", required: true, description: "Image to upscale" }],
  },

  // === Concept Art & Style ===
  // Nano Banana 2: $0.04/gen (from billing) → RM0.148 + 0.03 = RM0.18
  {
    id: "fal-ai/nano-banana/v2",
    name: "Nano Banana 2",
    provider: "fal", type: "i2i", category: "Concept Art & Style",
    description: "Nano Banana 2 image generation with broader aspect-ratio presets and optional reference-image editing.",
    cost: "~RM0.18", creditCost: 18, speed: "~1m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Image description" },
      { name: "image_url", type: "image", required: false, description: "Reference image" },
    ],
  },
  // Nano Banana Pro: ~$0.06/gen → RM0.222 + 0.03 = RM0.25
  {
    id: "fal-ai/nano-banana/pro",
    name: "Nano Banana Pro",
    provider: "fal", type: "i2i", category: "Concept Art & Style",
    description: "Nano Banana Pro image generation with optional reference-image editing.",
    cost: "~RM0.25", creditCost: 25, speed: "~1m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Image description" },
      { name: "image_url", type: "image", required: false, description: "Reference image" },
    ],
  },
  // FLUX.1 Dev: $0.025/MP, ~1MP = $0.025 → RM0.093 + 0.03 = RM0.12
  {
    id: "fal-ai/flux/dev",
    name: "FLUX.1 Dev",
    provider: "fal", type: "t2i", category: "Concept Art & Style",
    description: "High quality image generation. Good for concept art.",
    cost: "~RM0.12", creditCost: 12, speed: "~10s", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Image description" }],
  },
  // FLUX Kontext Pro: $0.04/image (API confirmed) → RM0.148 + 0.03 = RM0.18
  {
    id: "fal-ai/flux-pro/kontext",
    name: "FLUX Kontext Pro",
    provider: "fal", type: "i2i", category: "Concept Art & Style",
    description: "Best value for image editing. Character consistency.",
    cost: "~RM0.18", creditCost: 18, speed: "~10s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Edit instruction" },
      { name: "image_url", type: "image", required: true, description: "Source image" },
    ],
  },
  // Recraft V4 Pro: compute-second, ~$0.04/gen → RM0.148 + 0.03 = RM0.18
  {
    id: "fal-ai/recraft/v4/pro",
    name: "Recraft V4 Pro",
    provider: "fal", type: "t2i", category: "Concept Art & Style",
    description: "Best quality for illustrations and design.",
    cost: "~RM0.18", creditCost: 18, speed: "~15s", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Image description" }],
  },
  // GPT Image 1.5: ~$0.05/gen → RM0.185 + 0.03 = RM0.22
  {
    id: "fal-ai/gpt-image/v1.5/high",
    name: "GPT Image 1.5 High",
    provider: "fal", type: "t2i", category: "Concept Art & Style",
    description: "GPT-powered image generation. Excellent prompt following.",
    cost: "~RM0.22", creditCost: 22, speed: "~20s", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Image description" }],
  },

  // === Character & Fashion ===
  // Kling Elements: compute-second, ~$0.10/gen → RM0.37 + 0.05 = RM0.42
  {
    id: "fal-ai/kling-video/v3/pro/elements",
    name: "Kling 3.0 Elements",
    provider: "fal", type: "i2v", category: "Character & Fashion",
    description: "Character-consistent video with element injection.",
    cost: "~RM0.42", creditCost: 42, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Scene description" },
      { name: "image_url", type: "image", required: true, description: "Character/element image" },
    ],
  },
  // FLUX Kontext Max: ~$0.06/gen → RM0.222 + 0.03 = RM0.25
  {
    id: "fal-ai/flux-pro/kontext/max",
    name: "FLUX Kontext Max",
    provider: "fal", type: "i2i", category: "Character & Fashion",
    description: "Max quality character editing. Try-on, style transfer.",
    cost: "~RM0.25", creditCost: 25, speed: "~15s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Edit instruction" },
      { name: "image_url", type: "image", required: true, description: "Character image" },
    ],
  },

  // === Lip Sync ===
  // PixVerse Lipsync: ~$0.06/gen → RM0.222 + 0.05 = RM0.27
  {
    id: "fal-ai/pixverse/lipsync",
    name: "PixVerse Lipsync",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Cheapest lip sync. Video + audio input.",
    cost: "~RM0.27", creditCost: 27, speed: "~2m", stable: true,
    inputs: [
      { name: "video_url", type: "video", required: true, description: "Face video" },
      { name: "audio_url", type: "audio", required: true, description: "Audio/speech" },
    ],
  },
  // Sync Lipsync: ~$0.08/gen → RM0.296 + 0.05 = RM0.35
  {
    id: "fal-ai/sync/lipsync/v2",
    name: "Sync Lipsync 2.0",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Standard quality lip sync.",
    cost: "~RM0.35", creditCost: 35, speed: "~2m", stable: true,
    inputs: [
      { name: "video_url", type: "video", required: true, description: "Face video" },
      { name: "audio_url", type: "audio", required: true, description: "Audio/speech" },
    ],
  },
  // OmniHuman: ~$0.15/gen → RM0.555 + 0.05 = RM0.61
  {
    id: "fal-ai/omnihuman/v1.5",
    name: "OmniHuman v1.5",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Full-body animation from audio. Up to 60sec.",
    cost: "~RM0.61", creditCost: 61, speed: "~5m", stable: true,
    inputs: [
      { name: "image_url", type: "image", required: true, description: "Character image" },
      { name: "audio_url", type: "audio", required: true, description: "Driving audio" },
    ],
  },

  // === Audio & Music ===
  // MiniMax Speech: ~$0.01/gen (from billing voice clone) → RM0.037 + 0.03 = RM0.07
  {
    id: "fal-ai/minimax/speech-02",
    name: "MiniMax Speech-02",
    provider: "fal", type: "audio", category: "Audio & Music",
    description: "Text-to-speech with voice cloning.",
    cost: "~RM0.07", creditCost: 7, speed: "~10s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Text to speak" },
      { name: "audio_url", type: "audio", required: false, description: "Voice reference" },
    ],
  },
];

export const modelCategories: ModelCategory[] = [
  "Cinematic Video Gen", "Video Editing", "Upscale & Restoration",
  "Concept Art & Style", "Character & Fashion", "Lip Sync", "Audio & Music",
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
  };
  return labels[type];
}
