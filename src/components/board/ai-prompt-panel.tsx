"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { X, Send, Loader2, Sparkles, Copy, Check, Plus, Trash2, MessageSquare, Paperclip, Settings as SettingsIcon, Wand2, PanelLeftClose, PanelLeftOpen, Clipboard } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { useAppStore } from "@/lib/store";
import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from "@/lib/chat-models";

// Message content is either a plain string (simple turns) or an array of parts
// when the user attaches images/videos. OpenAI-shaped — passes through to
// chat.completions server-side.
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

// Turn the model's markdown-formatted reply into a clean plain-text prompt ready
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

export function AIPromptPanel() {
  const { isAIPromptOpen, setAIPromptOpen, setPendingPrompt, pendingChatSeed, setPendingChatSeed, theme, items: canvasItems, boards, activeBoardId } = useAppStore();
  const isDark = theme === "dark";

  // Resizable width — persisted to localStorage
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  // Collapse the chat-list column for a focused conversation view.
  const [chatListCollapsed, setChatListCollapsed] = useState(false);

  // Mobile: full-width overlay, no resize handle, chat list auto-collapsed
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) setPanelWidth(n);
    }
    const savedCollapsed = localStorage.getItem("motionboards_ai_chatlist_collapsed");
    // Always collapse chat list on mobile regardless of saved preference
    setChatListCollapsed(window.innerWidth < 768 ? true : savedCollapsed === "true");
  }, []);

  const toggleChatList = useCallback(() => {
    setChatListCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("motionboards_ai_chatlist_collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  // Persist width so the canvas knows how much space to reserve.
  // On mobile, dispatch 0 so the canvas stays full-width (panel overlays instead of pushing).
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ai-panel-width", { detail: isMobile ? 0 : panelWidth }));
    }
  }, [panelWidth, isMobile]);

  // Drag-to-resize — pointer events so touch (iPad / phone) works.
  useEffect(() => {
    if (!isResizing) return;
    const move = (e: PointerEvent) => {
      // Panel is anchored right, so its width = viewportWidth - pointerX
      const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - e.clientX));
      setPanelWidth(w);
    };
    const up = () => {
      setIsResizing(false);
      localStorage.setItem(WIDTH_STORAGE_KEY, String(panelWidth));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
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
  // Each attachment is uploaded to Neon (mb_files, 14-day TTL via FILE_TTL_DAYS)
  // before it can be sent. The chat payload then carries a short /api/files/:id
  // URL instead of multi-MB base64 — total attachments capped at 120MB.
  const [attachments, setAttachments] = useState<Array<{
    id: string;
    url: string;     // local data URL while uploading, server URL once done
    label: string;
    size: number;    // raw file bytes
    uploading: boolean;
    error?: string;
  }>>([]);

  // Per-account AI instruction / template (customizes the system prompt)
  const [showSettings, setShowSettings] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [instructionSaving, setInstructionSaving] = useState(false);
  const [instructionOptimizing, setInstructionOptimizing] = useState(false);
  const [instructionStatus, setInstructionStatus] = useState<string | null>(null);
  const [chatModel, setChatModel] = useState<string>(DEFAULT_CHAT_MODEL);
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
      if (typeof data.model === "string") setChatModel(data.model);
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
        // Save instruction AND the currently picked model in one round-trip
        // — keeps the Save button as the single point of confirmation.
        body: JSON.stringify({ instruction, model: chatModel }),
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

  // Model changes auto-save so users don't have to think about hitting Save
  // just to swap chatbot. Failures revert the picker back to its prior value.
  const handleModelChange = async (newModel: string) => {
    const prev = chatModel;
    setChatModel(newModel);
    try {
      const res = await fetch("/api/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: newModel }),
      });
      if (!res.ok) {
        setChatModel(prev);
        setInstructionStatus("Couldn't switch model");
        setTimeout(() => setInstructionStatus(null), 3000);
      }
    } catch {
      setChatModel(prev);
      setInstructionStatus("Couldn't switch model");
      setTimeout(() => setInstructionStatus(null), 3000);
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
  const mobileInputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OpenAI's vision API caps inline images at 20 MB. Big files go directly
  // to Cloudflare R2 via presigned PUT so Vercel's 4.5 MB function-body cap
  // doesn't apply — see uploadAttachment() below.
  const PER_FILE_LIMIT = 20 * 1024 * 1024;

  const handleFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      let uploadFile: File | null = null;
      let label = file.name || "attachment";
      let previewDataUrl: string | null = null;

      if (file.type.startsWith("image/")) {
        uploadFile = file;
        previewDataUrl = await readAsDataUrl(file);
      } else if (file.type.startsWith("video/")) {
        const frame = await extractVideoFrame(file);
        if (!frame) continue;
        previewDataUrl = frame;
        label = `${file.name || "video"} (frame)`;
        // Convert the frame data URL into a File so we can upload it
        const blob = await (await fetch(frame)).blob();
        uploadFile = new File([blob], `${file.name || "video"}-frame.jpg`, { type: "image/jpeg" });
      } else {
        continue;
      }

      const fileSize = uploadFile.size;

      // Reject files that exceed the per-file upload cap (OpenAI vision API limit)
      if (fileSize > PER_FILE_LIMIT) {
        setAttachments((prev) => [
          ...prev,
          {
            id,
            url: previewDataUrl || "",
            label,
            size: fileSize,
            uploading: false,
            error: `Too large (${(fileSize / 1024 / 1024).toFixed(1)}MB) — max 20MB per image`,
          },
        ]);
        continue;
      }

      // Add as uploading; show preview from data URL until server URL arrives
      setAttachments((prev) => [
        ...prev,
        { id, url: previewDataUrl || "", label, size: fileSize, uploading: true },
      ]);

      // Upload — try R2 presigned PUT first (bypasses the 4.5 MB function
      // body cap), fall back to /api/upload → Neon for tiny files or if R2
      // isn't configured.
      try {
        let hostedUrl: string | null = null;

        try {
          const presign = await fetch("/api/upload-presign", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              filename: uploadFile.name || "attachment.bin",
              contentType: uploadFile.type || "application/octet-stream",
            }),
          });
          if (presign.ok) {
            const { uploadUrl, publicUrl } = await presign.json();
            const putRes = await fetch(uploadUrl, {
              method: "PUT",
              headers: { "content-type": uploadFile.type || "application/octet-stream" },
              body: uploadFile,
            });
            if (putRes.ok && publicUrl) hostedUrl = publicUrl;
          }
        } catch {
          // R2 path unavailable — fall through to legacy /api/upload
        }

        if (!hostedUrl) {
          const form = new FormData();
          form.append("file", uploadFile);
          const res = await fetch("/api/upload", { method: "POST", body: form });
          const data = await res.json();
          if (res.ok && data.url) hostedUrl = data.url as string;
          else throw new Error(data.error || `Upload failed (${res.status})`);
        }

        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, url: hostedUrl!, uploading: false } : a))
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, uploading: false, error: msg } : a))
        );
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

  // Paste images from OS clipboard while panel is open (desktop global listener)
  useEffect(() => {
    if (!isAIPromptOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      // Skip if the focused element is one of our own inputs — they have
      // their own onPaste handlers. e.target may be a Text node which has no
      // isContentEditable, so check document.activeElement (where paste lands).
      const active = document.activeElement as HTMLElement | null;
      if (
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement ||
        active?.isContentEditable
      ) return;
      // Same fallback for e.target in case activeElement is null
      const t = e.target as HTMLElement | null;
      if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement || t?.isContentEditable) return;
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

  // Mobile paste: iOS Safari doesn't expose image blobs via clipboardData.items,
  // so we try navigator.clipboard.read() as a fallback when the textarea fires paste.
  const handleTextareaPaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
      return;
    }
    // clipboardData had no image (typical on iOS) — try the async Clipboard API.
    // This is inside a user-gesture (paste event) so permission is granted silently
    // on iOS 16+ without a separate prompt.
    if (typeof navigator?.clipboard?.read === "function") {
      try {
        const clipItems = await navigator.clipboard.read();
        const fallback: File[] = [];
        for (const ci of clipItems) {
          for (const type of ci.types) {
            if (type.startsWith("image/")) {
              const blob = await ci.getType(type);
              const ext = type.split("/")[1] || "png";
              fallback.push(new File([blob], `paste.${ext}`, { type }));
            }
          }
        }
        if (fallback.length > 0) {
          e.preventDefault();
          handleFiles(fallback);
        }
      } catch {
        // Permission denied or API not available — let native text paste proceed
      }
    }
  }, [handleFiles]);

  // Mobile: sync contenteditable div back to `input` state when cleared after send
  useEffect(() => {
    if (isMobile && mobileInputRef.current && input === "") {
      mobileInputRef.current.innerHTML = "";
    }
  }, [input, isMobile]);

  const imgToFile = useCallback((img: HTMLImageElement): Promise<File | null> =>
    new Promise((resolve) => {
      const convert = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width || 300;
          canvas.height = img.naturalHeight || img.height || 300;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            resolve(blob ? new File([blob], "paste.png", { type: "image/png" }) : null);
          }, "image/png");
        } catch { resolve(null); }
      };
      if (img.complete && img.naturalWidth > 0) convert();
      else { img.onload = convert; img.onerror = () => resolve(null); }
    }), []);

  const handleMobileInputPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    // Android / desktop: files in clipboardData.items
    const items = Array.from(e.clipboardData?.items || []);
    const files: File[] = [];
    for (const it of items) {
      if (it.kind === "file") { const f = it.getAsFile(); if (f) files.push(f); }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
      return;
    }

    // iOS: let native paste insert <img> into the div, extract via canvas after a delay
    setTimeout(async () => {
      const el = mobileInputRef.current;
      if (!el) return;
      const imgs = Array.from(el.querySelectorAll("img")) as HTMLImageElement[];
      if (imgs.length === 0) return;
      const converted: File[] = [];
      for (const img of imgs) {
        img.style.visibility = "hidden";
        const f = await imgToFile(img);
        img.remove();
        if (f) converted.push(f);
      }
      if (converted.length > 0) handleFiles(converted);
    }, 300);
  }, [handleFiles, imgToFile]);

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

  if (!isAIPromptOpen) return null;

  // Total size cap for pending attachments (raw file bytes, before upload).
  // 120MB across all in-flight attachments — files persist in Neon for 14 days.
  const ATTACHMENT_LIMIT = 120 * 1024 * 1024;
  const attachmentsSize = attachments.reduce((sum, a) => sum + (a.size || 0), 0);
  const overLimit = attachmentsSize > ATTACHMENT_LIMIT;
  const sizeMB = (attachmentsSize / 1024 / 1024).toFixed(1);
  const limitMB = (ATTACHMENT_LIMIT / 1024 / 1024).toFixed(0);
  const isUploading = attachments.some((a) => a.uploading);
  const hasUploadError = attachments.some((a) => a.error);

  const handleSend = async (overrideText?: string) => {
    // overrideText is set when the AI Agent toggle hands a request off from
    // the empty hero — bypasses the input/attachments path entirely.
    const text = (overrideText ?? input).trim();
    if ((!text && attachments.length === 0) || loading || !currentChatId) return;
    if (overLimit || isUploading || hasUploadError) return;

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

      // If server returned an error JSON (no stream), surface it
      if (!res.ok || !res.body) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) errMsg = data.error;
        } catch {
          const text = await res.text().catch(() => "");
          if (text) errMsg = text.slice(0, 200);
        }
        const final = [...newMessages, { role: "assistant" as const, content: `Error: ${errMsg}` }];
        setMessages(final);
        await persistMessages(currentChatId, final);
        return;
      }

      // Stream tokens straight into the assistant bubble — only push the bubble
      // once the FIRST chunk arrives so the loading dots show until then.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        accumulated += chunk;
        setMessages([...newMessages, { role: "assistant", content: accumulated }]);
      }
      // Flush any final buffered bytes
      accumulated += decoder.decode();
      const final = [...newMessages, { role: "assistant" as const, content: accumulated || "Could not generate a response. Try again." }];
      setMessages(final);
      await persistMessages(currentChatId, final);
      loadChats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const final = [...newMessages, { role: "assistant" as const, content: `Failed to connect: ${msg}. Try again.` }];
      setMessages(final);
      await persistMessages(currentChatId, final);
    } finally {
      setLoading(false);
    }
  };

  // AI Agent handoff: when the empty hero hands a request to ADletic AI it
  // sets pendingChatSeed in the store. Consume it once the panel is open and
  // a chat is ready, then clear the seed.
  const seedFiredRef = useRef(false);
  useEffect(() => {
    if (!pendingChatSeed) { seedFiredRef.current = false; return; }
    if (!isAIPromptOpen || !currentChatId || loading) return;
    if (seedFiredRef.current) return;
    seedFiredRef.current = true;
    const seed = pendingChatSeed;
    setPendingChatSeed(null);
    // Defer one tick so any pending state writes (open, current chat) settle.
    setTimeout(() => { handleSend(seed); }, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChatSeed, isAIPromptOpen, currentChatId, loading]);

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
      style={{ width: isMobile ? "100vw" : panelWidth }}
    >
      {/* Drag-to-resize handle — desktop only, hidden on mobile */}
      {!isMobile && (
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setIsResizing(true);
        }}
        className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-[10] transition-colors touch-none ${
          isResizing
            ? "bg-[#f26522]"
            : isDark ? "bg-transparent hover:bg-white/20" : "bg-transparent hover:bg-[#f26522]/40"
        }`}
        title="Drag to resize"
      />
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 backdrop-blur-md ${isDark ? "border-gray-800 bg-gradient-to-b from-[#1c2128] to-[#161b22]" : "border-gray-100 bg-gradient-to-b from-white to-gray-50/50"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[#f26522] to-[#ec4899] rounded-2xl blur-md opacity-40" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/aios-icon.png" alt="AI" className="relative h-9 w-9 rounded-2xl ring-2 ring-[#f26522]/20" />
            <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 ${isDark ? "border-[#161b22]" : "border-white"}`} />
          </div>
          <div className="min-w-0">
            <h3 className={`text-sm font-bold tracking-tight truncate ${isDark ? "text-white" : "text-[#0d1117]"}`}>
              {currentChat?.title || "ADletic AI"}
            </h3>
            <p className="text-[10px] text-green-500 font-medium flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-green-500 animate-pulse" />
              Online — ready to create
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={toggleChatList}
            title={chatListCollapsed ? "Show chats" : "Hide chats (focus mode)"}
          >
            {chatListCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
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
        {/* Chat list — collapsible for focused conversation mode */}
        {!chatListCollapsed && (
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
        )}

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
                {/* Chat model picker — auto-saves on change */}
                <div className="mb-3">
                  <label className={`block text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Chat model
                  </label>
                  <div className="relative">
                    <select
                      value={chatModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      className={`w-full appearance-none border rounded-xl text-xs px-3 py-2.5 pr-8 focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all ${isDark ? "bg-[#0d1117] border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-[#0d1117]"}`}
                    >
                      {CHAT_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}{m.recommended ? " — Recommended" : ""}
                        </option>
                      ))}
                    </select>
                    <svg className={`absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none ${isDark ? "text-gray-400" : "text-gray-500"}`} viewBox="0 0 12 12" fill="none">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className={`mt-1 text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    {CHAT_MODELS.find((m) => m.id === chatModel)?.description || ""}
                  </p>
                </div>

                <label className={`block text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  System instruction
                </label>
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
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center min-h-full text-center px-2 py-6">
                <div className="relative mb-5">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#f26522] to-[#ec4899] rounded-3xl blur-xl opacity-40 animate-pulse" />
                  <div className="relative h-16 w-16 rounded-3xl bg-gradient-to-br from-[#f26522] to-[#ec4899] flex items-center justify-center shadow-lg ring-1 ring-white/20">
                    <Sparkles className="h-8 w-8 text-white drop-shadow" />
                  </div>
                </div>
                <h2 className={`text-xl font-bold tracking-tight mb-1.5 ${isDark ? "text-white" : "text-[#0d1117]"}`}>
                  Hey, I&rsquo;m ADletic
                </h2>
                <p className={`text-[12.5px] mb-6 max-w-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Tell me what you want to create — a video, a poster, a storyboard. I&rsquo;ll craft the prompt and walk you through it.
                </p>
                <div className="w-full max-w-sm space-y-2">
                  <p className={`text-[10px] uppercase tracking-wider font-bold mb-2.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    Try one of these
                  </p>
                  {[
                    { emoji: "🎬", text: "Cinematic drone shot of a city at golden hour" },
                    { emoji: "📸", text: "12-panel storyboard for a coffee ad" },
                    { emoji: "🎨", text: "Neon-noir comic book illustration of a courier" },
                    { emoji: "💡", text: "What makes a good Veo prompt?" },
                  ].map((s) => (
                    <button
                      key={s.text}
                      type="button"
                      className={`group flex items-center gap-3 w-full text-left text-[12px] rounded-xl px-3.5 py-3 border transition-all hover:-translate-y-0.5 hover:shadow-md ${
                        isDark
                          ? "text-gray-300 bg-[#0d1117]/60 border-gray-700/80 hover:border-[#f26522]/60 hover:bg-[#f26522]/5"
                          : "text-gray-700 bg-white border-gray-200 hover:border-[#f26522]/60 hover:bg-[#f26522]/5"
                      }`}
                      onClick={() => setInput(s.text)}
                    >
                      <span className="text-base shrink-0">{s.emoji}</span>
                      <span className="flex-1 leading-snug">{s.text}</span>
                      <span className={`text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "text-[#f26522]" : "text-[#f26522]"}`}>→</span>
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

            {/* Loading dots — only show until the first streamed token arrives */}
            {loading && (() => {
              const last = messages[messages.length - 1];
              const alreadyStreaming = last && last.role === "assistant" && messageText(last.content).length > 0;
              if (alreadyStreaming) return null;
              return (
                <div className="flex justify-start">
                  <div className={`rounded-2xl px-4 py-3 rounded-bl-sm ${isDark ? "bg-[#0d1117] border border-gray-700" : "bg-gray-50 border border-gray-200"}`}>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 bg-[#f26522] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 bg-[#f26522] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 bg-[#f26522] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              );
            })()}

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
                {attachments.map((a) => (
                  <div key={a.id} className="relative group/att">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.label}
                      title={a.error ? `${a.label} — ${a.error}` : `${a.label} (${(a.size / 1024 / 1024).toFixed(2)} MB)`}
                      className={`h-14 w-14 rounded-md object-cover border ${a.error ? "border-red-400 opacity-60" : "border-gray-300"} ${a.uploading ? "opacity-60" : ""}`}
                    />
                    {a.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md">
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      </div>
                    )}
                    {a.error && !a.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-500/40 rounded-md text-[8px] text-white font-semibold text-center px-1">
                        Failed
                      </div>
                    )}
                    <button
                      type="button"
                      className={`absolute -top-1.5 -right-1.5 bg-neutral-800 rounded-full p-0.5 text-neutral-300 hover:text-white transition-opacity active:opacity-50 ${isMobile ? "opacity-100" : "opacity-0 group-hover/att:opacity-100"}`}
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                      title="Remove"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              {isMobile ? (
                <div
                  ref={mobileInputRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setInput(e.currentTarget.innerText || "")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  onPaste={handleMobileInputPaste}
                  data-placeholder="Message ADletic AI… tap to type or paste"
                  className={`w-full border rounded-xl text-xs pl-10 pr-12 py-3 min-h-[60px] focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none ${isDark ? "bg-[#0d1117] border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-[#0d1117]"}`}
                />
              ) : (
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
                onPaste={handleTextareaPaste}
                placeholder="Message ADletic AI… drop or paste images"
                className={`w-full border rounded-xl text-xs placeholder-gray-400 pl-10 pr-12 py-3 resize-none focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all ${isDark ? "bg-[#0d1117] border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-[#0d1117]"}`}
                rows={2}
              />
              )}
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
                disabled={loading || overLimit || isUploading || hasUploadError || (!input.trim() && attachments.length === 0)}
                onClick={() => handleSend()}
                className={`absolute right-3 bottom-3 h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                  loading || overLimit || isUploading || hasUploadError || (!input.trim() && attachments.length === 0)
                    ? isDark ? "bg-gray-700 text-gray-500" : "bg-gray-200 text-gray-400"
                    : "bg-[#f26522] text-white hover:bg-[#d9541a] hover:scale-105"
                }`}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
            {/* Attachment size detector — total cap 120MB, files persist 14 days in Neon */}
            {attachments.length > 0 && (
              <div className={`mt-1.5 flex items-center gap-1.5 text-[9px] ${overLimit ? "text-red-500" : attachmentsSize > ATTACHMENT_LIMIT * 0.85 ? "text-amber-500" : isDark ? "text-gray-500" : "text-gray-400"}`}>
                <span className="font-semibold">{sizeMB} MB</span>
                <span>/ {limitMB} MB</span>
                {isUploading && <span className="text-[#f26522]">· uploading…</span>}
                {hasUploadError && <span className="text-red-500">· remove failed attachments to send</span>}
                {overLimit && <span>— total too large, remove an attachment</span>}
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <p className={`text-[8px] ${isDark ? "text-gray-600" : "text-gray-300"}`}>
                Powered by {CHAT_MODELS.find((m) => m.id === chatModel)?.name || chatModel} · Auto-saved for 14 days
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
