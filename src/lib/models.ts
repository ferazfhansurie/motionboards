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
  // === Cinematic Video Gen ===

  // T2V — text only, no image needed
  {
    id: "fal-ai/veo3.1/fast",
    name: "Veo 3.1 Fast T2V",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Veo 3.1 Fast text-to-video with native synchronized audio and cinematic motion.",
    cost: "~RM0.35", creditCost: 35, speed: "~3m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "auto"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "6s", "8s"], default: "6s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "720p", label: "Resolution" },
    },
  },

  // S2E — prompt required, start/end frames required
  {
    id: "fal-ai/veo3.1/first-last-frame-to-video",
    name: "Veo 3.1 Fast S2E",
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

  // I2V — prompt + image required
  {
    id: "fal-ai/veo3.1/fast/image-to-video",
    name: "Veo 3.1 Fast I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "Veo 3.1 image-to-video. Requires a reference image.",
    cost: "~RM0.35", creditCost: 35, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Motion description" },
      { name: "image_url", type: "image", required: true, description: "Reference image" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "auto"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["4s", "6s", "8s"], default: "6s", label: "Duration" },
      resolution: { values: ["720p", "1080p"], default: "720p", label: "Resolution" },
    },
  },

  // T2V — text only
  {
    id: "fal-ai/sora-2/text-to-video",
    name: "Sora 2 T2V",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "OpenAI Sora 2 text-to-video. 720p, native audio.",
    cost: "~RM0.42", creditCost: 42, speed: "~3m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
    options: {
      aspect_ratio: { values: ["auto", "9:16", "16:9"], default: "auto", label: "Aspect Ratio" },
      duration: { values: ["4", "8", "12", "16", "20"], default: "8", label: "Duration (sec)" },
    },
  },

  // T2V — text only
  {
    id: "fal-ai/sora-2/text-to-video/pro",
    name: "Sora 2 Pro",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Sora 2 Pro up to 1080p. 4-20 sec duration.",
    cost: "~RM0.79", creditCost: 79, speed: "~5m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
    options: {
      aspect_ratio: { values: ["auto", "9:16", "16:9"], default: "auto", label: "Aspect Ratio" },
      duration: { values: ["4", "8", "12", "16", "20"], default: "8", label: "Duration (sec)" },
    },
  },

  // T2V — text only
  {
    id: "fal-ai/kling-video/v3/pro/text-to-video",
    name: "Kling 3.0 Pro",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Kling 3.0 Pro text-to-video with native audio and voice control.",
    cost: "~RM2.64", creditCost: 264, speed: "~4m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "1:1"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["5", "10"], default: "5", label: "Duration (sec)" },
      generate_audio: { default: false, label: "Generate Audio" },
    },
  },

  // I2V — image required, prompt optional but recommended
  {
    id: "fal-ai/kling-video/v3/pro/image-to-video",
    name: "Kling 3.0 Pro I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "Kling 3.0 Pro image-to-video. Requires an image input.",
    cost: "~RM2.64", creditCost: 264, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Motion description (recommended)" },
      { name: "start_image_url", type: "image", required: true, description: "Source image" },
      { name: "end_image_url", type: "image", required: false, description: "End frame image (optional)" },
    ],
    options: {
      aspect_ratio: { values: ["16:9", "9:16", "1:1"], default: "16:9", label: "Aspect Ratio" },
      duration: { values: ["5", "10"], default: "5", label: "Duration (sec)" },
      generate_audio: { default: false, label: "Generate Audio" },
    },
  },

  // T2V — text only (v2.2 replaces deprecated v2.1)
  {
    id: "fal-ai/wan/v2.2-a14b/text-to-video",
    name: "Wan 2.2 (A14B)",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "High quality text-to-video generation.",
    cost: "~RM0.35", creditCost: 35, speed: "~2m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },

  // I2V — image + prompt required
  {
    id: "fal-ai/wan/v2.2-a14b/image-to-video",
    name: "Wan 2.2 I2V (A14B)",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "High quality image-to-video. Requires an image input.",
    cost: "~RM0.35", creditCost: 35, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Motion description" },
      { name: "image_url", type: "image", required: true, description: "Reference image" },
    ],
  },

  // T2V — text only (v2.2 replaces deprecated v2.1)
  {
    id: "fal-ai/wan/v2.2-5b/text-to-video",
    name: "Wan 2.2 (5B) Fast",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Fast, lightweight video generation.",
    cost: "~RM0.79", creditCost: 79, speed: "~30s", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },

  // T2V — text only
  {
    id: "fal-ai/ltx-2.3/text-to-video",
    name: "LTX 2.3 Pro T2V",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Great value. Up to 4K. Audio.",
    cost: "~RM0.27", creditCost: 27, speed: "~2m", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },

  // T2V — text only
  {
    id: "fal-ai/ltx-2.3/text-to-video/fast",
    name: "LTX 2.3 Fast T2V",
    provider: "fal", type: "t2v", category: "Cinematic Video Gen",
    description: "Cheapest fast video with audio.",
    cost: "~RM0.16", creditCost: 16, speed: "~30s", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Video description" }],
  },

  // I2V — prompt + image required
  {
    id: "fal-ai/minimax/hailuo-02/standard/image-to-video",
    name: "Hailuo-02 Standard I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "1080p. Physics simulation. Requires an image input.",
    cost: "~RM0.42", creditCost: 42, speed: "~8m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Motion description" },
      { name: "image_url", type: "image", required: true, description: "Reference image" },
      { name: "end_image_url", type: "image", required: false, description: "End frame image (optional)" },
    ],
  },

  // I2V — prompt + image required
  {
    id: "fal-ai/pixverse/v5/image-to-video",
    name: "PixVerse v5 I2V",
    provider: "fal", type: "i2v", category: "Cinematic Video Gen",
    description: "Style presets. Requires an image input.",
    cost: "~RM0.35", creditCost: 35, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Motion description" },
      { name: "image_url", type: "image", required: true, description: "Reference image" },
    ],
  },

  // === Video Editing ===

  // V2V — video + prompt required (corrected endpoint)
  {
    id: "fal-ai/kling-video/o3/pro/video-to-video/edit",
    name: "Kling O3 Pro V2V Edit",
    provider: "fal", type: "v2v", category: "Video Editing",
    description: "Edit any video with element replacement. Requires a video input.",
    cost: "~RM0.49", creditCost: 49, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Edit instructions" },
      { name: "video_url", type: "video", required: true, description: "Source video" },
    ],
  },

  // V2V — video + image required, prompt optional
  {
    id: "fal-ai/kling-video/v3/pro/motion-control",
    name: "Kling 3.0 Motion Transfer",
    provider: "fal", type: "v2v", category: "Video Editing",
    description: "Transfer motion from reference video. Requires video + image.",
    cost: "~RM0.49", creditCost: 49, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Description (optional)" },
      { name: "video_url", type: "video", required: true, description: "Motion reference video" },
      { name: "image_url", type: "image", required: true, description: "Subject image" },
    ],
  },

  // V2V — video required, prompt optional
  {
    id: "fal-ai/ltx-2.3/extend-video",
    name: "LTX 2.3 Extend",
    provider: "fal", type: "v2v", category: "Video Editing",
    description: "Extend video duration seamlessly. Requires a video input.",
    cost: "~RM0.27", creditCost: 27, speed: "~2m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Description for extension (optional)" },
      { name: "video_url", type: "video", required: true, description: "Video to extend" },
    ],
  },

  // === Upscale & Restoration ===

  // Upscale — video required, NO prompt
  {
    id: "fal-ai/topaz/upscale/video",
    name: "Topaz Video Upscale",
    provider: "fal", type: "upscale", category: "Upscale & Restoration",
    description: "Best video upscaler. Frame interpolation to 60fps. Requires video input.",
    cost: "~RM0.24", creditCost: 24, speed: "~2m", stable: true,
    inputs: [{ name: "video_url", type: "video", required: true, description: "Video to upscale" }],
  },

  // Upscale — image required, NO prompt
  {
    id: "fal-ai/topaz/upscale/image",
    name: "Topaz Image Upscale",
    provider: "fal", type: "upscale", category: "Upscale & Restoration",
    description: "Face enhancement, denoising, sharpening. Requires image input.",
    cost: "~RM0.10", creditCost: 10, speed: "~30s", stable: true,
    inputs: [{ name: "image_url", type: "image", required: true, description: "Image to upscale" }],
  },

  // Upscale — image required, NO prompt
  {
    id: "fal-ai/seedvr/upscale/image",
    name: "SeedVR Upscale",
    provider: "fal", type: "upscale", category: "Upscale & Restoration",
    description: "Extremely cheap. Up to 10x upscale. Requires image input.",
    cost: "~RM0.07", creditCost: 7, speed: "~20s", stable: true,
    inputs: [{ name: "image_url", type: "image", required: true, description: "Image to upscale" }],
  },

  // === Concept Art & Style ===

  // T2I — Nano Banana 2 (latest, best quality)
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

  // I2I — Nano Banana 2 Edit (uses image_urls array, not image_url)
  {
    id: "fal-ai/nano-banana-2/edit",
    name: "Nano Banana 2 Edit",
    provider: "fal", type: "i2i", category: "Concept Art & Style",
    description: "Edit images with Nano Banana 2. Upload an image and describe changes.",
    cost: "~RM0.20", creditCost: 20, speed: "~30s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Edit description" },
      { name: "image_urls", type: "image", required: true, description: "Images to edit (array)" },
    ],
  },

  // T2I — Nano Banana Pro (highest quality)
  {
    id: "fal-ai/nano-banana-pro",
    name: "Nano Banana Pro",
    provider: "fal", type: "t2i", category: "Concept Art & Style",
    description: "Google's highest quality image generation with realism and typography.",
    cost: "~RM0.25", creditCost: 25, speed: "~45s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Image description" },
    ],
    options: {
      aspect_ratio: { values: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"], default: "auto", label: "Aspect Ratio" },
      resolution: { values: ["0.5K", "1K", "2K", "4K"], default: "1K", label: "Resolution" },
    },
  },

  // T2I — prompt only
  {
    id: "fal-ai/flux/dev",
    name: "FLUX.1 Dev",
    provider: "fal", type: "t2i", category: "Concept Art & Style",
    description: "High quality image generation. Prompt only.",
    cost: "~RM0.12", creditCost: 12, speed: "~10s", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Image description" }],
    options: {
      aspect_ratio: { values: ["21:9", "16:9", "3:2", "4:3", "1:1", "3:4", "2:3", "9:16"], default: "16:9", label: "Aspect Ratio" },
    },
  },

  // I2I — prompt + image BOTH required
  {
    id: "fal-ai/flux-pro/kontext",
    name: "FLUX Kontext Pro",
    provider: "fal", type: "i2i", category: "Concept Art & Style",
    description: "Image editing. Requires prompt + image input.",
    cost: "~RM0.18", creditCost: 18, speed: "~10s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Edit instruction" },
      { name: "image_url", type: "image", required: true, description: "Source image" },
    ],
  },

  // T2I — prompt only
  {
    id: "fal-ai/recraft/v4/pro/text-to-image",
    name: "Recraft V4 Pro",
    provider: "fal", type: "t2i", category: "Concept Art & Style",
    description: "Best quality for illustrations and design. Prompt only.",
    cost: "~RM0.18", creditCost: 18, speed: "~15s", stable: true,
    inputs: [{ name: "prompt", type: "text", required: true, description: "Image description" }],
  },

  // I2I — prompt + image_urls (supports editing with reference images)
  {
    id: "fal-ai/gpt-image-1.5/edit",
    name: "GPT Image 1.5 Edit",
    provider: "fal", type: "i2i", category: "Concept Art & Style",
    description: "GPT-powered image editing. Optional reference image + mask.",
    cost: "~RM0.22", creditCost: 22, speed: "~20s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Image description or edit instruction" },
      { name: "image_urls", type: "image", required: false, description: "Reference images (optional)" },
    ],
  },

  // === Character & Fashion ===

  // I2V — image required, prompt optional (corrected endpoint: v1.6 has elements, v3 does not)
  {
    id: "fal-ai/kling-video/v1.6/pro/elements",
    name: "Kling 1.6 Elements",
    provider: "fal", type: "i2v", category: "Character & Fashion",
    description: "Character-consistent video with element injection. Requires image.",
    cost: "~RM0.42", creditCost: 42, speed: "~4m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Scene description (optional)" },
      { name: "start_image_url", type: "image", required: true, description: "Character/element image" },
    ],
  },

  // I2I — prompt + image BOTH required
  {
    id: "fal-ai/flux-pro/kontext",
    name: "FLUX Kontext Pro (Character)",
    provider: "fal", type: "i2i", category: "Character & Fashion",
    description: "Character-consistent editing. Requires prompt + image.",
    cost: "~RM0.25", creditCost: 25, speed: "~15s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Edit instruction" },
      { name: "image_url", type: "image", required: true, description: "Character image" },
    ],
  },

  // === Lip Sync ===

  // Lipsync — video required, audio or text required
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

  // Lipsync — video + audio BOTH required
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

  // Lipsync — image + audio BOTH required (not video!)
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

  // === Audio & Music ===

  // Audio — text required, uses voice_setting for predefined voices (NO audio upload for cloning)
  {
    id: "fal-ai/minimax/speech-02-hd",
    name: "MiniMax Speech-02 HD",
    provider: "fal", type: "audio", category: "Audio & Music",
    description: "Text-to-speech with predefined voices. Use Chatterbox HD for voice cloning.",
    cost: "~RM0.07", creditCost: 7, speed: "~10s", stable: true,
    inputs: [
      { name: "text", type: "text", required: true, description: "Text to speak" },
    ],
  },

  // === New fal.ai Models ===

  // InfiniteTalk — image + audio + prompt → lip-synced video
  {
    id: "fal-ai/infinitalk",
    name: "InfiniteTalk",
    provider: "fal", type: "lipsync", category: "Lip Sync",
    description: "Generate lip-synced video from image + audio. Full-body animation with natural motion.",
    cost: "~RM0.80", creditCost: 80, speed: "~3m", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: true, description: "Video description" },
      { name: "image_url", type: "image", required: true, description: "Character image" },
      { name: "audio_url", type: "audio", required: true, description: "Audio/speech file" },
    ],
    options: {
      resolution: { values: ["480p", "720p"], default: "480p", label: "Resolution" },
    },
  },

  // Face Swap — two images required
  {
    id: "easel-ai/advanced-face-swap",
    name: "Face Swap (Easel AI)",
    provider: "fal", type: "i2i", category: "Face & Body",
    description: "Swap faces while preserving scene details, outfits, and lighting. Single or multi-person.",
    cost: "~RM0.15", creditCost: 15, speed: "~15s", stable: true,
    inputs: [
      { name: "face_image_0", type: "image", required: true, description: "Face to swap in" },
      { name: "target_image", type: "image", required: true, description: "Target scene image" },
    ],
  },

  // Background Removal — image only
  {
    id: "fal-ai/rmbg-v2",
    name: "Background Remove (BRIA)",
    provider: "fal", type: "i2i", category: "Image Editing",
    description: "One-click background removal. Returns transparent PNG.",
    cost: "~RM0.05", creditCost: 5, speed: "~5s", stable: true,
    inputs: [
      { name: "image_url", type: "image", required: true, description: "Image to remove background from" },
    ],
  },

  // Style Transfer — image + prompt
  {
    id: "fal-ai/image-editing/style-transfer",
    name: "Style Transfer",
    provider: "fal", type: "i2i", category: "Image Editing",
    description: "Apply artistic styles to your image. Describe the style or let it auto-detect.",
    cost: "~RM0.12", creditCost: 12, speed: "~10s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Style description (e.g. 'Van Gogh's Starry Night')" },
      { name: "image_url", type: "image", required: true, description: "Source image" },
    ],
  },

  // Image Outpaint — image + optional prompt
  {
    id: "fal-ai/image-apps-v2/outpaint",
    name: "Image Outpaint",
    provider: "fal", type: "i2i", category: "Image Editing",
    description: "Extend image beyond its borders. Choose which edges to expand.",
    cost: "~RM0.10", creditCost: 10, speed: "~15s", stable: true,
    inputs: [
      { name: "prompt", type: "text", required: false, description: "Guidance for expanded area (optional)" },
      { name: "image_url", type: "image", required: true, description: "Image to extend" },
    ],
  },

  // Creative Upscaler — image only
  {
    id: "fal-ai/creative-upscaler",
    name: "Creative Upscaler",
    provider: "fal", type: "upscale", category: "Upscale & Restoration",
    description: "AI-powered creative upscale with detail enhancement. 2x default.",
    cost: "~RM0.15", creditCost: 15, speed: "~20s", stable: true,
    inputs: [
      { name: "image_url", type: "image", required: true, description: "Image to upscale" },
    ],
  },

  // Image to 3D — Trellis
  {
    id: "fal-ai/trellis",
    name: "Trellis Image to 3D",
    provider: "fal", type: "i2i", category: "Concept Art & Style",
    description: "Generate a textured 3D model (GLB) from a single image.",
    cost: "~RM0.30", creditCost: 30, speed: "~30s", stable: true,
    inputs: [
      { name: "image_url", type: "image", required: true, description: "Source image" },
    ],
  },

  // Voice Clone TTS — text + optional audio reference
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

  // Audio Separation — audio + prompt
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

  // Voice Isolation — audio or video
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
  "Cinematic Video Gen", "Video Editing", "Upscale & Restoration",
  "Concept Art & Style", "Character & Fashion", "Image Editing",
  "Face & Body", "Lip Sync", "Audio & Music",
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
