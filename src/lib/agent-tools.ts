// Tool registry for ADletic AI Agent.
//
// One file = one source of truth for every tool the agent can call.
// Adding a new tool means adding one entry to AGENT_TOOLS below — the
// backend automatically exposes it to Claude via the `tools` array, and the
// frontend's tool dispatcher already routes by `name`.
//
// **Models are dynamic** — the catalog from src/lib/models.ts is rendered
// into Claude's system prompt at request time, so adding a new model in
// models.ts is enough; you don't need a new tool per model. The
// `start_generation` tool below takes any `model_id` from the catalog.
//
// Each tool has:
//   - `name`              — Claude calls this; must be unique.
//   - `description`       — Claude reads this to decide when to call. Be
//                           explicit about preconditions (e.g. "only after
//                           you have a prompt").
//   - `input_schema`      — JSON Schema for inputs Claude generates.
//   - `kind`              — "client_action" (frontend executes) or
//                           "ui_request" (frontend renders an interaction
//                           and sends the user's response back as
//                           tool_result). Both are executed client-side;
//                           the distinction is just for routing.
//
// To add a new tool:
//   1. Append an entry to AGENT_TOOLS.
//   2. Add a case in the frontend dispatcher (ai-prompt-panel.tsx) that
//      handles the `name`. Return the tool_result that gets fed back to
//      Claude.

export interface AgentTool {
  name: string;
  description: string;
  kind: "client_action" | "ui_request";
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "start_generation",
    kind: "client_action",
    description: `Propose a generation for the user to review, then run it on their canvas if they approve.

Use this when:
  - You have a clear prompt (text describing what to create).
  - You've picked the right model based on the user's request — match category (Image / Video / Audio) and type (t2v / i2v / s2e / t2i / i2i / etc.) to what they asked for.
  - You have any required reference inputs (e.g. an input_image_url for i2i / i2v / s2e models). If a model needs an image you don't have, ask the user FIRST in plain text — don't call this tool yet.

**Review step.** When you call this tool the user sees a review card in the chat with the proposed model + prompt and three buttons: Generate (approve), Edit prompt (tweak then approve), or Cancel. The actual generation only kicks off after they approve. So you don't need to ask "should I generate?" in plain text — just call the tool with your best prompt and model. The review card lets the user fine-tune.

If the user cancels, the tool_result tells you so — respond gracefully (don't restate the prompt back at them; ask what to change or suggest a different angle, briefly).

If approved, the generation runs in the background and the result fills in when ready. The tool result returns when generation completes or fails — use that to tell the user how it went and what they can do next (e.g. "want to animate this with Veo?").

Pick model_id from the catalog in your system prompt. Don't invent ids.`,
    input_schema: {
      type: "object",
      properties: {
        model_id: {
          type: "string",
          description: "The exact model id from the catalog (e.g. 'gemini-3.1-flash-image-preview', 'veo-3.1-lite-generate-preview', 'black-forest-labs/flux-schnell'). Must match an enabled model.",
        },
        prompt: {
          type: "string",
          description: "The prompt text — tailor wording to the model's strengths and the user's intent. For images: concise visual description with style/lighting cues. For video: include camera motion. For multi-panel storyboards: hard line breaks between panels.",
        },
        options: {
          type: "object",
          description: "Optional generation parameters. Only set fields the user explicitly cares about; defaults are sensible. Common keys: aspect_ratio (string like '16:9'), resolution (e.g. '720p', '1080p', '2K'), duration (number, seconds), audio (boolean for video models that support it).",
          properties: {
            aspect_ratio: { type: "string" },
            resolution: { type: "string" },
            duration: { type: "number" },
            audio: { type: "boolean" },
          },
        },
        input_image_url: {
          type: "string",
          description: "URL of a single image to use as the model's image input — for i2i / i2v / s2e and any model with a required image input slot. Only set if you have an actual URL the user provided or that came from a previous result. Otherwise omit and ask first.",
        },
        input_image_urls: {
          type: "array",
          items: { type: "string" },
          description: "Multiple reference image URLs — use this (instead of input_image_url) when blending/referencing several images at once with a multi-reference model like Nano Banana 2 (gemini-3.1-flash-image-preview, up to 6 refs). Pass every reference the user wants included.",
        },
        input_video_url: {
          type: "string",
          description: "URL of a video to use as input — for v2v / sfx / similar. Same rule as input_image_url: only set if you have one.",
        },
      },
      required: ["model_id", "prompt"],
    },
  },
  {
    name: "timeline_add_clip",
    kind: "client_action",
    description: `Add an existing video already on the canvas to the single-track timeline, as a new sequenced clip. The clip references the canvas item — the source media is never duplicated.

Use this when the user wants to build an edited sequence from clips they already generated or uploaded. If the video isn't on the canvas yet, generate or upload it first.

Appends to the end of the timeline by default. Pass trim_in/trim_out only if the user wants a specific portion — otherwise the full source is used.`,
    input_schema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "The canvas item id of the video to add (from CURRENT TIMELINE / canvas context)." },
        trim_in: { type: "number", description: "Optional start offset in seconds into the source. Defaults to 0." },
        trim_out: { type: "number", description: "Optional end offset in seconds into the source. Defaults to the full source duration." },
        order: { type: "number", description: "Optional position in the sequence (0-based). Defaults to appended at the end." },
      },
      required: ["item_id"],
    },
  },
  {
    name: "timeline_trim_clip",
    kind: "client_action",
    description: "Change the in/out points of a clip already on the timeline — use to tighten or extend a cut. Does not affect the underlying canvas item, only where this clip starts/ends within its own sequenced range.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string", description: "The timeline clip id (not the canvas item id) — from the CURRENT TIMELINE context." },
        trim_in: { type: "number", description: "New start offset in seconds into the source." },
        trim_out: { type: "number", description: "New end offset in seconds into the source." },
      },
      required: ["clip_id"],
    },
  },
  {
    name: "timeline_reorder_clip",
    kind: "client_action",
    description: "Move a clip to a new position in the timeline sequence.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string", description: "The timeline clip id to move." },
        order: { type: "number", description: "Target position (0-based; use the order values shown in CURRENT TIMELINE as a guide, non-integers are fine)." },
      },
      required: ["clip_id", "order"],
    },
  },
  {
    name: "timeline_split_clip",
    kind: "client_action",
    description: "Split one timeline clip into two at a given offset, so each half can be trimmed, reordered, or removed independently. Use this before removing or replacing just part of a clip.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string", description: "The timeline clip id to split." },
        at_seconds: { type: "number", description: "Offset in seconds from the start of this clip's OWN trimmed range (not the source media) where the cut happens." },
      },
      required: ["clip_id", "at_seconds"],
    },
  },
  {
    name: "timeline_remove_clip",
    kind: "client_action",
    description: "Remove a clip from the timeline sequence. Does not delete the underlying canvas item — it stays on the board and can be re-added.",
    input_schema: {
      type: "object",
      properties: {
        clip_id: { type: "string", description: "The timeline clip id to remove." },
      },
      required: ["clip_id"],
    },
  },
  {
    name: "timeline_probe_clip",
    kind: "client_action",
    description: `Grab a single frame from a video and return it as an actual image in the tool result — you will see it directly, not just get a URL. Use this before trimming/splitting a clip you haven't looked at yet, when the user asks "what's at the start/end of this clip," or to read on-screen text/captions burned into the video.

One call only captures one instant. If captions or on-screen text change over the clip's duration, call this multiple times at different at_seconds to read all of them — don't assume one frame shows everything.

Works on any video canvas item — doesn't require the clip to already be on the timeline.`,
    input_schema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "The canvas item id of the video to probe." },
        at_seconds: { type: "number", description: "Timestamp in seconds to grab the frame at. Defaults to the middle of the video if omitted." },
      },
      required: ["item_id"],
    },
  },
  {
    name: "timeline_transcribe_clip",
    kind: "client_action",
    description: `Get a timestamped transcript of a video's audio, so you can find "the part where they say X" or judge pacing/dialogue without the user describing it to you. Use before trimming to a specific spoken moment, or when asked to cut around dialogue/narration.

Returns an empty/near-empty transcript for clips with no speech (music-only, silent, etc.) — that's a valid result, not an error.`,
    input_schema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "The canvas item id of the video to transcribe." },
      },
      required: ["item_id"],
    },
  },
];

// Convert the registry into the shape Claude expects in its `tools` array.
// The Anthropic API expects { name, description, input_schema } — `kind`
// is internal metadata for the frontend dispatcher and gets stripped here.
export function toAnthropicTools() {
  return AGENT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
