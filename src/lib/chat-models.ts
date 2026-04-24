// Allow-list of OpenAI chat models the user can pick for ADletic AI.
// Single source of truth — used by:
//   - the model picker in the AI panel settings (rendered)
//   - /api/ai-prompt for runtime validation (rejects unknown ids)
//   - /api/ai-settings for write validation
// Add new entries here when OpenAI ships a new model and you want it
// available in the picker.

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

export const CHAT_MODELS: ChatModel[] = [
  {
    id: "gpt-5",
    name: "GPT-5",
    description: "Best — newest flagship, smartest reasoning",
    recommended: true,
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 mini",
    description: "Faster & cheaper than GPT-5, still very strong",
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    description: "Previous flagship — great for long-context tasks",
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 mini",
    description: "Old default — fast, cheap, capable",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Multimodal classic, solid all-around",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o mini",
    description: "Cheapest tier — for very simple chats",
  },
];

// Default for users who haven't picked anything. "Best chatbot" per user
// preference — they upgraded to the full OpenAI catalog so we can ship
// the flagship as the out-of-box choice.
export const DEFAULT_CHAT_MODEL = "gpt-5";

export function isValidChatModel(id: string | null | undefined): boolean {
  if (!id) return false;
  return CHAT_MODELS.some((m) => m.id === id);
}

export function resolveChatModel(id: string | null | undefined): string {
  return isValidChatModel(id) ? (id as string) : DEFAULT_CHAT_MODEL;
}
