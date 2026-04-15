"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Sparkles, Copy, Check, Plus, Trash2, MessageSquare, Paperclip, Settings as SettingsIcon, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { useAppStore } from "@/lib/store";

// Message content is either a plain string (simple turns) or an array of parts
// when the user attaches images/videos. OpenAI-shaped — the server converts to
// Anthropic's schema before calling Claude.
type MessagePart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type MessageContent = string | MessagePart[];

interface Message {
  role: "user" | "assistant";
  content: MessageContent;
}

interface ChatSummary {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

const MIN_WIDTH = 400;
const MAX_WIDTH = 1100;
const DEFAULT_WIDTH = 640;
const CHAT_LIST_WIDTH = 180;
const WIDTH_STORAGE_KEY = "motionboards_ai_panel_width";

function messageText(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n");
}

// Turn Claude's markdown-formatted reply into a clean plain-text prompt ready
// to paste into a video generator. Drops horizontal rules, strips bold/italic
// markers (keeping the content), removes heading hashes and list bullets, and
// prunes common "meta" lines like "Ready to use." or standalone title headers.
function toPlainPrompt(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const cleaned: string[] = [];
  for (let line of lines) {
    // Horizontal rules
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) continue;
    // Heading hashes
    line = line.replace(/^\s*#{1,6}\s+/, "");
    // Leading list bullets
    line = line.replace(/^\s*[-*+]\s+/, "");
    // Bold **x**
    line = line.replace(/\*\*(.+?)\*\*/g, "$1");
    // Italic *x* and _x_ (avoid nuking bare asterisks inside words)
    line = line.replace(/(^|\s)\*([^*\n]+?)\*(?=\s|$|[.,!?])/g, "$1$2");
    line = line.replace(/(^|\s)_([^_\n]+?)_(?=\s|$|[.,!?])/g, "$1$2");
    // Inline code `x`
    line = line.replace(/`(.+?)`/g, "$1");
    cleaned.push(line);
  }

  // Drop obvious AI meta lines (standalone footers / confirmations)
  const metaPattern = /^(copy[- ]?paste ready|ready to use|here(?:'s| is) your prompt|prompt ready|use this prompt)[\s.:!]*$/i;
  const pruned = cleaned.filter((l) => !metaPattern.test(l.trim()));

  return pruned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function messageImages(content: MessageContent): string[] {
  if (typeof content === "string") return [];
  return content.filter((p) => p.type === "image_url").map((p) => (p as { image_url: { url: string } }).image_url.url);
}

async function extractVideoFrame(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        URL.revokeObjectURL(video.src);
        resolve(dataUrl);
      } catch {
        resolve(null);
      }
    };
    video.onerror = () => resolve(null);
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Shape of generation items the server returns after a Claude tool call
interface AIGeneratedItem {
  type: "generation";
  outputType: "image" | "video";
  status: "completed" | "processing";
  prompt: string;
  model: string;
  modelName: string;
  outputUrl?: string;
  requestId?: string;
  geminiVideo?: boolean;
  openaiVideo?: boolean;
  replicateVideo?: boolean;
  creditCost?: number;
}

export function AIPromptPanel() {
  const { isAIPromptOpen, setAIPromptOpen, setPendingPrompt, theme, items: canvasItems, boards, activeBoardId, addItem, panX, panY, zoom } = useAppStore();
  const isDark = theme === "dark";

  // Resizable width — persisted to localStorage
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) setPanelWidth(n);
    }
  }, []);

  // Persist width so the canvas knows how much space to reserve
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ai-panel-width", { detail: panelWidth }));
    }
  }, [panelWidth]);

  // Drag-to-resize — track mouse globally while resizing
  useEffect(() => {
    if (!isResizing) return;
    const move = (e: MouseEvent) => {
      // Panel is anchored right, so its width = viewportWidth - mouseX
      const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - e.clientX));
      setPanelWidth(w);
    };
    const up = () => {
      setIsResizing(false);
      localStorage.setItem(WIDTH_STORAGE_KEY, String(panelWidth));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [isResizing, panelWidth]);

  // Chat list + current conversation state
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<Array<{ url: string; label: string }>>([]);

  // Per-account AI instruction / template (customizes the system prompt)
  const [showSettings, setShowSettings] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [instructionSaving, setInstructionSaving] = useState(false);
  const [instructionOptimizing, setInstructionOptimizing] = useState(false);
  const [instructionStatus, setInstructionStatus] = useState<string | null>(null);
  // Board selection for "Optimize from canvas" — default all boards selected
  const [includedBoardIds, setIncludedBoardIds] = useState<string[] | null>(null);

  // Helper: get generation prompts from a specific board (using live state.items
  // for the active board since state.boards[activeBoardId].items may be stale).
  const getBoardPrompts = useCallback((boardId: string): string[] => {
    const itemSource = boardId === activeBoardId
      ? canvasItems
      : (boards.find((b) => b.id === boardId)?.items || []);
    return itemSource
      .filter((i) => i.type === "generation" && typeof i.prompt === "string" && i.prompt.trim().length > 0)
      .map((i) => i.prompt as string);
  }, [activeBoardId, boards, canvasItems]);

  // Initialize selection to ALL boards the first time settings opens
  useEffect(() => {
    if (showSettings && includedBoardIds === null) {
      setIncludedBoardIds(boards.map((b) => b.id));
    }
  }, [showSettings, includedBoardIds, boards]);

  const toggleBoardIncluded = (boardId: string) => {
    setIncludedBoardIds((prev) => {
      const curr = prev ?? boards.map((b) => b.id);
      return curr.includes(boardId) ? curr.filter((id) => id !== boardId) : [...curr, boardId];
    });
  };

  const loadInstruction = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-settings");
      const data = await res.json();
      if (typeof data.instruction === "string") setInstruction(data.instruction);
    } catch {
      // noop
    }
  }, []);

  const saveInstruction = async () => {
    setInstructionSaving(true);
    setInstructionStatus(null);
    try {
      const res = await fetch("/api/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      if (res.ok) setInstructionStatus("Saved");
      else setInstructionStatus("Failed to save");
    } catch {
      setInstructionStatus("Failed to save");
    } finally {
      setInstructionSaving(false);
      setTimeout(() => setInstructionStatus(null), 2500);
    }
  };

  const optimizeInstruction = async () => {
    const selected = includedBoardIds ?? boards.map((b) => b.id);
    if (selected.length === 0) {
      setInstructionStatus("Select at least one board to analyze.");
      setTimeout(() => setInstructionStatus(null), 5000);
      return;
    }

    // Gather prompts from generation items across all selected boards
    const prompts = selected.flatMap((bid) => getBoardPrompts(bid));

    if (prompts.length === 0) {
      setInstructionStatus("No generation prompts on the selected board(s) yet. Generate something first.");
      setTimeout(() => setInstructionStatus(null), 5000);
      return;
    }

    setInstructionOptimizing(true);
    setInstructionStatus(null);
    try {
      const res = await fetch("/api/ai-settings/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
      });
      const data = await res.json();
      if (res.ok && typeof data.instruction === "string") {
        setInstruction(data.instruction);
        const count = typeof data.analyzed === "number" ? data.analyzed : prompts.length;
        setInstructionStatus(`Suggestion loaded from ${count} canvas prompts — review and click Save to apply`);
      } else {
        setInstructionStatus(data.error || "Failed to optimize");
      }
    } catch {
      setInstructionStatus("Failed to optimize");
    } finally {
      setInstructionOptimizing(false);
      setTimeout(() => setInstructionStatus(null), 6000);
    }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const url = await readAsDataUrl(file);
        setAttachments((prev) => [...prev, { url, label: file.name || "image" }]);
      } else if (file.type.startsWith("video/")) {
        const frame = await extractVideoFrame(file);
        if (frame) setAttachments((prev) => [...prev, { url: frame, label: `${file.name || "video"} (frame)` }]);
      }
    }
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    e.target.value = "";
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isAIPromptOpen && inputRef.current) inputRef.current.focus();
  }, [isAIPromptOpen, currentChatId]);

  // Paste images from OS clipboard while panel is open
  useEffect(() => {
    if (!isAIPromptOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const files: File[] = [];
      for (const it of items) {
        if (it.type.startsWith("image/") || it.type.startsWith("video/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        handleFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [isAIPromptOpen, handleFiles]);

  const loadChats = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      if (Array.isArray(data.chats)) {
        setChats(data.chats);
        return data.chats as ChatSummary[];
      }
    } catch {
      // noop
    } finally {
      setListLoading(false);
    }
    return [];
  }, []);

  const loadChat = useCallback(async (id: string) => {
    setCurrentChatId(id);
    try {
      const res = await fetch(`/api/chats/${id}`);
      const data = await res.json();
      setMessages(data.chat?.messages || []);
    } catch {
      setMessages([]);
    }
  }, []);

  const createNewChat = useCallback(async () => {
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      const data = await res.json();
      if (data.chat) {
        setCurrentChatId(data.chat.id);
        setMessages([]);
        loadChats();
      }
    } catch {
      // noop
    }
  }, [loadChats]);

  useEffect(() => {
    if (!isAIPromptOpen) return;
    loadChats().then((list) => {
      if (!currentChatId) {
        if (list.length > 0) loadChat(list[0].id);
        else createNewChat();
      }
    });
    loadInstruction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIPromptOpen]);

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;
    try {
      await fetch(`/api/chats/${id}`, { method: "DELETE" });
      const remaining = chats.filter((c) => c.id !== id);
      setChats(remaining);
      if (currentChatId === id) {
        if (remaining.length > 0) loadChat(remaining[0].id);
        else createNewChat();
      }
    } catch {
      // noop
    }
  };

  const persistMessages = async (chatId: string, msgs: Message[]) => {
    try {
      const firstUser = msgs.find((m) => m.role === "user");
      const title = firstUser ? messageText(firstUser.content).slice(0, 50) : undefined;
      await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, ...(title ? { title } : {}) }),
      });
    } catch {
      // noop
    }
  };

  // Server returns generatedItems when Claude used a tool. Each item gets
  // added to the canvas; processing video items spin up their own poll.
  const addGeneratedItemToCanvas = useCallback((g: AIGeneratedItem) => {
    // Place near viewport center, with a small random offset so stacked items
    // don't overlap exactly
    const jitter = Math.floor(Math.random() * 40) - 20;
    const defaultW = g.outputType === "video" ? 360 : 300;
    const defaultH = g.outputType === "video" ? 202 : 300;
    const x = (-panX + window.innerWidth / 2 - defaultW / 2) / zoom + jitter;
    const y = (-panY + window.innerHeight / 2 - defaultH / 2) / zoom + jitter;
    const itemId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    addItem({
      id: itemId,
      type: "generation",
      x, y,
      width: defaultW,
      height: defaultH,
      src: "",
      prompt: g.prompt,
      model: g.model,
      modelName: g.modelName,
      status: g.status,
      outputType: g.outputType,
      outputUrl: g.outputUrl,
      cost: typeof g.creditCost === "number" ? `RM${(g.creditCost / 100).toFixed(2)}` : undefined,
      progressText: g.status === "processing" ? "Queued..." : undefined,
      createdAt: new Date().toISOString(),
    });

    // If video is still processing, poll the status endpoint until done
    if (g.status === "processing" && g.requestId) {
      const poll = async () => {
        try {
          let url = `/api/generate/status?requestId=${encodeURIComponent(g.requestId!)}&modelId=${encodeURIComponent(g.model)}&generationId=${itemId}`;
          if (g.geminiVideo) url += "&geminiVideo=true";
          if (g.openaiVideo) url += "&openaiVideo=true";
          if (g.replicateVideo) url += "&replicateVideo=true";
          const r = await fetch(url);
          const d = await r.json();
          if (d.status === "completed" && d.outputUrl) {
            useAppStore.getState().updateItem(itemId, {
              status: "completed",
              outputUrl: d.outputUrl,
              cost: d.actualCost,
              progressText: undefined,
            });
            return;
          }
          if (d.status === "failed") {
            useAppStore.getState().updateItem(itemId, {
              status: "failed",
              error: d.error || "Generation failed",
              progressText: undefined,
            });
            return;
          }
          if (d.log) useAppStore.getState().updateItem(itemId, { progressText: d.log });
          setTimeout(poll, 5000);
        } catch {
          setTimeout(poll, 8000);
        }
      };
      setTimeout(poll, 3000);
    }
  }, [addItem, panX, panY, zoom]);

  if (!isAIPromptOpen) return null;

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading || !currentChatId) return;

    const userMsg: Message = attachments.length > 0
      ? {
          role: "user",
          content: [
            ...(text ? [{ type: "text" as const, text }] : []),
            ...attachments.map((a) => ({ type: "image_url" as const, image_url: { url: a.url } })),
          ],
        }
      : { role: "user", content: text };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAttachments([]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      // Try to parse JSON; if the server returned HTML (timeout page, etc),
      // fall back to a readable error using the response text.
      let data: { reply?: string; error?: string; generatedItems?: AIGeneratedItem[] } = {};
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => "");
        data = { error: text ? text.slice(0, 200) : `HTTP ${res.status}` };
      }

      const reply = data.reply
        || (data.error ? `Error: ${data.error}` : `Request failed (HTTP ${res.status}). If you just used a generation tool, the server may have timed out — try again.`);
      const final = [...newMessages, { role: "assistant" as const, content: reply }];
      setMessages(final);
      await persistMessages(currentChatId, final);
      loadChats();

      // If Claude invoked a generation tool, add the resulting items to the canvas
      if (Array.isArray(data.generatedItems) && data.generatedItems.length > 0) {
        for (const g of data.generatedItems) {
          addGeneratedItemToCanvas(g);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const final = [...newMessages, { role: "assistant" as const, content: `Failed to connect: ${msg}. Try again.` }];
      setMessages(final);
      await persistMessages(currentChatId, final);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleUsePrompt = (text: string) => {
    setPendingPrompt(text);
    setAIPromptOpen(false);
  };

  const currentChat = chats.find((c) => c.id === currentChatId);

  return (
    <div
      data-ai-panel="true"
      className={`fixed right-0 top-0 z-[55] h-screen flex flex-col border-l shadow-2xl ${isDark ? "bg-[#161b22] border-gray-700" : "bg-white border-gray-200"}`}
      style={{ width: panelWidth }}
    >
      {/* Drag-to-resize handle on the LEFT edge */}
      <div
        onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
        className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-[10] transition-colors ${
          isResizing
            ? "bg-[#f26522]"
            : isDark ? "bg-transparent hover:bg-white/20" : "bg-transparent hover:bg-[#f26522]/40"
        }`}
        title="Drag to resize"
      />

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDark ? "border-gray-700 bg-gradient-to-r from-[#161b22] to-[#1c2128]" : "border-gray-100 bg-gradient-to-r from-white to-gray-50"}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/aios-icon.png" alt="AI" className="h-7 w-7 rounded-lg" />
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-white" />
          </div>
          <div className="min-w-0">
            <h3 className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-[#0d1117]"}`}>
              {currentChat?.title || "ADletic AI"}
            </h3>
            <p className="text-[9px] text-green-500 font-medium">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className={`rounded-lg p-1.5 transition-colors ${showSettings ? "bg-[#f26522]/15 text-[#f26522]" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Instruction / template"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={() => setAIPromptOpen(false)}
            title="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body: chat list | conversation */}
      <div className="flex-1 flex min-h-0">
        {/* Chat list — always visible on the left */}
        <div
          className={`shrink-0 flex flex-col border-r ${isDark ? "border-gray-700 bg-[#0d1117]" : "border-gray-100 bg-gray-50"}`}
          style={{ width: CHAT_LIST_WIDTH }}
        >
          <button
            type="button"
            onClick={createNewChat}
            className={`flex items-center gap-2 mx-2 my-2 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
              isDark ? "bg-[#f26522]/15 text-[#f26522] hover:bg-[#f26522]/25" : "bg-[#f26522]/10 text-[#f26522] hover:bg-[#f26522]/20"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {listLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-[#f26522]" />
              </div>
            ) : chats.length === 0 ? (
              <p className={`text-center py-6 text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>No chats yet</p>
            ) : (
              chats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => loadChat(c.id)}
                  className={`group flex items-start gap-1.5 w-full text-left rounded-md px-2 py-1.5 transition-colors ${
                    c.id === currentChatId
                      ? isDark ? "bg-[#f26522]/15 text-white" : "bg-[#f26522]/10 text-[#0d1117]"
                      : isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-700 hover:bg-white"
                  }`}
                >
                  <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate leading-tight">{c.title}</p>
                    <p className={`text-[9px] mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      {new Date(c.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => deleteChat(c.id, e)}
                    className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-gray-400 hover:text-red-500 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation column — hidden when settings panel is showing */}
        <div className="flex-1 flex flex-col min-w-0">
          {showSettings ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className={`px-4 py-3 border-b shrink-0 ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-[#0d1117]"}`}>Your AI Instruction</h4>
                <p className={`text-[10px] mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Tell ADletic AI how you want it to behave — tone, style, length, anything. Saved to your account and applied to every conversation.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder={`Examples:\n• Be concise, no preambles\n• When crafting prompts: keep to 1 sentence, anime style\n• Always explain your reasoning before answering\n• Respond in bullet points`}
                  className={`w-full h-full min-h-[240px] border rounded-xl text-xs px-4 py-3 resize-none focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all ${isDark ? "bg-[#0d1117] border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-[#0d1117] placeholder-gray-400"}`}
                />
                {instructionStatus && (
                  <p className={`mt-2 text-[10px] ${instructionStatus.toLowerCase().includes("fail") || instructionStatus.toLowerCase().includes("no generation") || instructionStatus.toLowerCase().includes("select at least") ? "text-red-500" : "text-emerald-500"}`}>
                    {instructionStatus}
                  </p>
                )}

                {/* Board selection for optimize — default all selected */}
                <div className={`mt-4 pt-3 border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      Boards to analyze
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-[9px] text-[#f26522] hover:underline"
                        onClick={() => setIncludedBoardIds(boards.map((b) => b.id))}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={`text-[9px] hover:underline ${isDark ? "text-gray-400" : "text-gray-500"}`}
                        onClick={() => setIncludedBoardIds([])}
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {boards.map((b) => {
                      const count = getBoardPrompts(b.id).length;
                      const current = includedBoardIds ?? boards.map((x) => x.id);
                      const isIncluded = current.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                            isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => toggleBoardIncluded(b.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 accent-[#f26522]"
                          />
                          <span className={`flex-1 text-[11px] ${isDark ? "text-gray-200" : "text-[#0d1117]"}`}>
                            {b.name}
                            {b.id === activeBoardId && (
                              <span className={`ml-1.5 text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>(current)</span>
                            )}
                          </span>
                          <span className={`text-[10px] ${count === 0 ? (isDark ? "text-gray-600" : "text-gray-400") : "text-[#f26522]"}`}>
                            {count} prompt{count === 1 ? "" : "s"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className={`px-4 py-3 border-t shrink-0 flex items-center gap-2 ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                <button
                  type="button"
                  onClick={optimizeInstruction}
                  disabled={instructionOptimizing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    instructionOptimizing
                      ? isDark ? "bg-gray-700 text-gray-500" : "bg-gray-100 text-gray-400"
                      : isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-gray-100 text-[#0d1117] hover:bg-gray-200"
                  }`}
                  title="Analyze generation prompts on your canvas and suggest an improved instruction"
                >
                  {instructionOptimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {instructionOptimizing ? "Analyzing..." : "Optimize from canvas"}
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${isDark ? "text-gray-400 hover:bg-white/5 hover:text-white" : "text-gray-500 hover:bg-gray-50 hover:text-[#0d1117]"}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveInstruction}
                  disabled={instructionSaving}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    instructionSaving
                      ? "bg-gray-200 text-gray-400"
                      : "bg-[#f26522] text-white hover:bg-[#d9541a]"
                  }`}
                >
                  {instructionSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Save"}
                </button>
              </div>
            </div>
          ) : (
          <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="text-center py-8">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f26522] to-[#ec4899] flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <p className={`text-sm font-bold mb-1 ${isDark ? "text-white" : "text-[#0d1117]"}`}>ADletic AI</p>
                <p className={`text-[11px] mb-5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Ask anything, brainstorm ideas, or describe a scene and I&rsquo;ll craft a prompt</p>
                <div className="space-y-2 max-w-sm mx-auto">
                  {[
                    "Write me a prompt for a cinematic drone shot of a city at sunset",
                    "What makes a good Veo prompt?",
                    "Help me brainstorm a 15-second product ad for coffee",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className={`block w-full text-left text-[11px] rounded-xl px-4 py-2.5 transition-colors border ${isDark ? "text-gray-300 bg-[#0d1117] border-gray-700 hover:border-[#f26522] hover:text-[#f26522]" : "text-gray-600 bg-gray-50 border-gray-100 hover:border-[#f26522] hover:text-[#f26522] hover:bg-[#f26522]/5"}`}
                      onClick={() => setInput(suggestion)}
                    >
                      &ldquo;{suggestion}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const text = messageText(msg.content);
              const imgs = messageImages(msg.content);
              const isUser = msg.role === "user";
              return (
                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-[12.5px] leading-relaxed ${
                      isUser
                        ? "bg-[#f26522] text-white rounded-br-sm"
                        : isDark ? "bg-[#0d1117] border border-gray-700 text-gray-200 rounded-bl-sm" : "bg-gray-50 border border-gray-200 text-[#0d1117] rounded-bl-sm"
                    }`}
                  >
                    {imgs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {imgs.map((src, j) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={j} src={src} alt="" className="h-20 w-20 rounded-md object-cover border border-white/20" />
                        ))}
                      </div>
                    )}
                    {text && (
                      isUser ? (
                        <p className="whitespace-pre-wrap">{text}</p>
                      ) : (
                        <div className={`markdown-body ${isDark ? "md-dark" : "md-light"}`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{text}</ReactMarkdown>
                        </div>
                      )
                    )}
                    {!isUser && (
                      <div className={`flex items-center gap-2 mt-2.5 pt-2 border-t ${isDark ? "border-gray-700" : "border-gray-200/70"}`}>
                        <button
                          type="button"
                          className={`flex items-center gap-1 text-[10px] transition-colors ${isDark ? "text-gray-500 hover:text-[#f26522]" : "text-gray-400 hover:text-[#f26522]"}`}
                          onClick={() => handleCopy(toPlainPrompt(text), i)}
                        >
                          {copiedIdx === i ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedIdx === i ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[10px] text-[#f26522] font-semibold hover:text-[#d9541a] transition-colors"
                          onClick={() => handleUsePrompt(toPlainPrompt(text))}
                        >
                          <Sparkles className="h-3 w-3" />
                          Use as prompt
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className={`rounded-2xl px-4 py-3 rounded-bl-sm ${isDark ? "bg-[#0d1117] border border-gray-700" : "bg-gray-50 border border-gray-200"}`}>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 bg-[#f26522] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 bg-[#f26522] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 bg-[#f26522] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            className={`border-t px-4 py-3 shrink-0 ${isDark ? "border-gray-700" : "border-gray-100"}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              handleFiles(files);
            }}
          >
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative group/att">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.label} title={a.label} className="h-14 w-14 rounded-md object-cover border border-gray-300" />
                    <button
                      type="button"
                      className="absolute -top-1.5 -right-1.5 bg-neutral-800 rounded-full p-0.5 text-neutral-300 hover:text-white opacity-0 group-hover/att:opacity-100 transition-opacity"
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      title="Remove"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message ADletic AI… drop or paste images"
                className={`w-full border rounded-xl text-xs placeholder-gray-400 pl-10 pr-12 py-3 resize-none focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all ${isDark ? "bg-[#0d1117] border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-[#0d1117]"}`}
                rows={2}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`absolute left-3 bottom-3 h-7 w-7 rounded-full flex items-center justify-center transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-[#f26522]" : "text-gray-400 hover:bg-gray-100 hover:text-[#f26522]"}`}
                title="Attach image or video"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={onFileInputChange}
              />
              <button
                type="button"
                disabled={loading || (!input.trim() && attachments.length === 0)}
                onClick={handleSend}
                className={`absolute right-3 bottom-3 h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                  loading || (!input.trim() && attachments.length === 0)
                    ? isDark ? "bg-gray-700 text-gray-500" : "bg-gray-200 text-gray-400"
                    : "bg-[#f26522] text-white hover:bg-[#d9541a] hover:scale-105"
                }`}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className={`text-[8px] ${isDark ? "text-gray-600" : "text-gray-300"}`}>
                Powered by Claude Sonnet · Auto-saved for 14 days
              </p>
              <a
                href="https://wa.me/60112167672?text=Hi%2C%20I%20want%20to%20upgrade%20my%20AI%20on%20MotionBoards%20%F0%9F%9A%80"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] font-semibold text-[#f26522] hover:text-[#d9541a] transition-colors flex items-center gap-0.5"
              >
                ⚡ Upgrade AI
              </a>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
