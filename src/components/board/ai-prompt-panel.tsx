"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Sparkles, Copy, Check, Plus, Trash2, MessageSquare, ChevronLeft, Paperclip } from "lucide-react";
import { useAppStore } from "@/lib/store";

// Message content is either a plain string (simple turns) or an array of parts
// when the user attaches images/videos. OpenAI's multimodal API accepts this
// same shape for the "user" role.
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

// Helper: render message content as plain text (for UI display + copy/paste)
function messageText(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n");
}

function messageImages(content: MessageContent): string[] {
  if (typeof content === "string") return [];
  return content.filter((p) => p.type === "image_url").map((p) => (p as { image_url: { url: string } }).image_url.url);
}

// Extract the first frame of a video as a JPEG data URL
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

// Read a File into a base64 data URL
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const SIDEBAR_WIDTH = 420;

export function AIPromptPanel() {
  const { isAIPromptOpen, setAIPromptOpen, setPendingPrompt, theme } = useAppStore();
  const isDark = theme === "dark";

  // Chat list state
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  // Current conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  // Pending attachments — array of data URLs (images or extracted video frames)
  const [attachments, setAttachments] = useState<Array<{ url: string; label: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file attach (from button, drop, or paste)
  const handleFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const url = await readAsDataUrl(file);
        setAttachments((prev) => [...prev, { url, label: file.name || "image" }]);
      } else if (file.type.startsWith("video/")) {
        const frame = await extractVideoFrame(file);
        if (frame) {
          setAttachments((prev) => [...prev, { url: frame, label: `${file.name || "video"} (frame)` }]);
        }
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
    if (isAIPromptOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAIPromptOpen, currentChatId]);

  // Global paste handler while panel is open — catches images from OS clipboard
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

  // Load chat list when panel opens
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

  useEffect(() => {
    if (!isAIPromptOpen) return;
    loadChats().then((list) => {
      // If no current chat, open the most recent — or create a new one if none exist
      if (!currentChatId) {
        if (list.length > 0) {
          loadChat(list[0].id);
        } else {
          createNewChat();
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIPromptOpen]);

  const loadChat = async (id: string) => {
    setCurrentChatId(id);
    setShowHistory(false);
    try {
      const res = await fetch(`/api/chats/${id}`);
      const data = await res.json();
      if (data.chat) {
        setMessages(data.chat.messages || []);
      }
    } catch {
      setMessages([]);
    }
  };

  const createNewChat = async () => {
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
        setShowHistory(false);
        loadChats();
      }
    } catch {
      // noop
    }
  };

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
      // Auto-derive title from first user message if still default
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

  if (!isAIPromptOpen) return null;

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading || !currentChatId) return;

    // Build multimodal content if there are attachments, else plain string
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
      const data = await res.json();
      const reply = data.reply || data.error || "Something went wrong";
      const final = [...newMessages, { role: "assistant" as const, content: reply }];
      setMessages(final);
      await persistMessages(currentChatId, final);
      loadChats(); // refresh list ordering
    } catch {
      const final = [...newMessages, { role: "assistant" as const, content: "Failed to connect. Try again." }];
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
      className={`fixed right-0 top-0 z-[55] h-screen flex flex-col border-l shadow-2xl ${isDark ? "bg-[#161b22] border-gray-700" : "bg-white border-gray-200"}`}
      style={{ width: SIDEBAR_WIDTH }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDark ? "border-gray-700 bg-gradient-to-r from-[#161b22] to-[#1c2128]" : "border-gray-100 bg-gradient-to-r from-white to-gray-50"}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          {showHistory ? (
            <button
              type="button"
              className={`rounded-lg p-1 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
              onClick={() => setShowHistory(false)}
              title="Back to chat"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="relative shrink-0">
              <img src="/aios-icon.png" alt="AI" className="h-7 w-7 rounded-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-white" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-[#0d1117]"}`}>
              {showHistory ? "Chat History" : currentChat?.title || "ADletic AI - Prompt Helper"}
            </h3>
            <p className="text-[9px] text-green-500 font-medium">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={() => setShowHistory(!showHistory)}
            title="Chat history"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={createNewChat}
            title="New chat"
          >
            <Plus className="h-4 w-4" />
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

      {/* Chat history list */}
      {showHistory && (
        <div className="flex-1 overflow-y-auto">
          {listLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#f26522]" />
            </div>
          ) : chats.length === 0 ? (
            <p className={`text-center py-8 text-[11px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>No chats yet</p>
          ) : (
            <div className="p-2 space-y-1">
              {chats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => loadChat(c.id)}
                  className={`group flex items-center gap-2 w-full text-left rounded-lg px-3 py-2 transition-colors ${
                    c.id === currentChatId
                      ? isDark ? "bg-[#f26522]/15 text-white" : "bg-[#f26522]/10 text-[#0d1117]"
                      : isDark ? "text-gray-300 hover:bg-white/5" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{c.title}</p>
                    <p className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      {new Date(c.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => deleteChat(c.id, e)}
                    className="opacity-0 group-hover:opacity-100 rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conversation view */}
      {!showHistory && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="text-center py-8">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f26522] to-[#ec4899] flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <p className={`text-sm font-bold mb-1 ${isDark ? "text-white" : "text-[#0d1117]"}`}>ADletic AI - Prompt Helper</p>
                <p className={`text-[11px] mb-5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Describe what you want or paste an image and I&rsquo;ll craft the perfect prompt</p>
                <div className="space-y-2">
                  {[
                    "Cinematic drone shot of a city at sunset",
                    "Slow motion close-up of coffee being poured",
                    "Anime style fight scene with speed lines",
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
              return (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-[12px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#f26522] text-white rounded-br-sm"
                        : isDark ? "bg-[#0d1117] text-gray-200 rounded-bl-sm" : "bg-gray-100 text-[#0d1117] rounded-bl-sm"
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
                    {text && <p className="whitespace-pre-wrap">{text}</p>}
                    {msg.role === "assistant" && (
                      <div className={`flex items-center gap-2 mt-2.5 pt-2 border-t ${isDark ? "border-gray-700" : "border-gray-200/50"}`}>
                        <button
                          type="button"
                          className={`flex items-center gap-1 text-[10px] transition-colors ${isDark ? "text-gray-500 hover:text-[#f26522]" : "text-gray-400 hover:text-[#f26522]"}`}
                          onClick={() => handleCopy(text, i)}
                        >
                          {copiedIdx === i ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedIdx === i ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[10px] text-[#f26522] font-semibold hover:text-[#d9541a] transition-colors"
                          onClick={() => handleUsePrompt(text)}
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
                <div className={`rounded-2xl px-4 py-3 rounded-bl-sm ${isDark ? "bg-[#0d1117]" : "bg-gray-100"}`}>
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
            {/* Attachment previews */}
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
                placeholder="Describe your scene, drop or paste images…"
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
  );
}
