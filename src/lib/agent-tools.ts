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
          description: "URL of an image to use as the model's image input — required for i2i / i2v / s2e and any model that has a required image input slot. Only set if you have an actual URL the user has provided or that came back from a previous start_generation call. Otherwise omit and ask the user for an image first.",
        },
        input_video_url: {
          type: "string",
          description: "URL of a video to use as input — for v2v / sfx / similar. Same rule as input_image_url: only set if you have one.",
        },
      },
      required: ["model_id", "prompt"],
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
