// Allow-list of Claude chat models the user can pick for ADletic AI.
// Single source of truth — used by:
//   - the model picker in the AI panel settings (rendered)
//   - /api/ai-prompt for runtime validation (rejects unknown ids)
//   - /api/ai-settings for write validation
// Add new entries here when Anthropic ships a new model and you want it
// available in the picker.

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

export const CHAT_MODELS: ChatModel[] = [
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    description: "Default — fastest and most cost-effective. Best for chat.",
    recommended: true,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    description: "Balanced — best speed-vs-intelligence tradeoff for complex tasks",
  },
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    description: "Most capable — best for long-horizon agentic work",
  },
];

// Default for users who haven't picked anything. Haiku 4.5 — fast, cheap,
// and plenty smart for prompt-crafting and conversation. Users who want
// more capability can upgrade to Sonnet 4.6 or Opus 4.7 from the picker.
export const DEFAULT_CHAT_MODEL = "claude-haiku-4-5";

export function isValidChatModel(id: string | null | undefined): boolean {
  if (!id) return false;
  return CHAT_MODELS.some((m) => m.id === id);
}

export function resolveChatModel(id: string | null | undefined): string {
  return isValidChatModel(id) ? (id as string) : DEFAULT_CHAT_MODEL;
}
