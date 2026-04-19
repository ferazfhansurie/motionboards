"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Info, AlertTriangle, Loader2, X, FolderPlus, FolderOpen } from "lucide-react";
import { useUIStore, type Toast } from "@/lib/ui-store";
import { useAppStore } from "@/lib/store";

// <UILayer /> mounts once (from the canvas root) and renders every in-app
// primitive: toast stack, folder picker, confirm dialog, prompt dialog, share.
export function UILayer() {
  return (
    <>
      <Toasts />
      <FolderPickerModal />
      <ConfirmModal />
      <PromptModal />
      <ShareModal />
    </>
  );
}

// --- Toasts -----------------------------------------------------------------

function Toasts() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);
  const { theme } = useAppStore();
  const isDark = theme === "dark";

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[320px] flex-col gap-2">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} isDark={isDark} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastRow({ toast, isDark, onDismiss }: { toast: Toast; isDark: boolean; onDismiss: () => void }) {
  const palette = {
    info: { icon: <Info className="h-4 w-4 text-blue-500" />, accent: "border-blue-500/30" },
    success: { icon: <Check className="h-4 w-4 text-emerald-500" />, accent: "border-emerald-500/30" },
    error: { icon: <AlertTriangle className="h-4 w-4 text-red-500" />, accent: "border-red-500/40" },
    loading: { icon: <Loader2 className="h-4 w-4 animate-spin text-[#f26522]" />, accent: "border-[#f26522]/40" },
  }[toast.kind];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-md ${palette.accent} ${isDark ? "bg-[#161b22]/95 text-white" : "bg-white/95 text-[#0d1117]"}`}
      style={{
        animation: "mb-toast-in 200ms ease-out",
      }}
    >
      <div className="mt-0.5 shrink-0">{palette.icon}</div>
      <p className="flex-1 text-[12px] font-medium leading-snug">{toast.message}</p>
      {toast.kind !== "loading" && (
        <button
          onClick={onDismiss}
          className={`-mr-1 shrink-0 rounded p-0.5 ${isDark ? "text-gray-500 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <style jsx global>{`
        @keyframes mb-toast-in {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// --- Folder picker ----------------------------------------------------------

interface FolderRow {
  id: string;
  name: string;
  itemCount: number;
}

function FolderPickerModal() {
  const { open } = useUIStore((s) => s.folderPicker);
  const close = useUIStore((s) => s.closeFolderPicker);
  const { theme } = useAppStore();
  const isDark = theme === "dark";
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCreating(false);
    setNewName("");
    setLoading(true);
    fetch("/api/folders")
      .then((r) => r.json())
      .then((d) => setFolders(Array.isArray(d?.folders) ? d.folders : []))
      .catch(() => setFolders([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (creating) newInputRef.current?.focus();
  }, [creating]);

  if (!open) return null;

  async function createAndPick() {
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((r) => r.json());
      if (res?.folder?.id) close(res.folder.id);
    } finally {
      setLoading(false);
    }
  }

  const panel = isDark ? "bg-[#0d1117] border-gray-800 text-white" : "bg-white border-gray-200 text-[#0d1117]";
  const sub = isDark ? "text-gray-500" : "text-gray-400";

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4"
      onClick={() => close(null)}
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "mb-modal-in 180ms ease-out" }}
      >
        <div className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? "border-gray-800" : "border-gray-100"}`}>
          <h3 className="text-sm font-bold">Save to folder</h3>
          <button
            onClick={() => close(null)}
            className={`rounded-lg p-1.5 ${sub} ${isDark ? "hover:bg-white/5" : "hover:bg-gray-100"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {loading && folders.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className={`h-4 w-4 animate-spin ${sub}`} />
            </div>
          ) : folders.length === 0 && !creating ? (
            <p className={`px-3 py-6 text-center text-[12px] ${sub}`}>
              No folders yet. Create one below.
            </p>
          ) : (
            folders.map((f) => (
              <button
                key={f.id}
                onClick={() => close(f.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f26522]/10 text-[#f26522]">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-semibold">{f.name}</p>
                  <p className={`text-[10px] ${sub}`}>
                    {f.itemCount} item{f.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
        <div className={`border-t px-3 py-2 ${isDark ? "border-gray-800" : "border-gray-100"}`}>
          {creating ? (
            <div className="flex items-center gap-2">
              <input
                ref={newInputRef}
                type="text"
                value={newName}
                placeholder="Folder name"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createAndPick();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none ${isDark ? "border-gray-700 bg-[#161b22] text-white placeholder-gray-500 focus:border-[#f26522]" : "border-gray-200 bg-white text-[#0d1117] placeholder-gray-400 focus:border-[#f26522]"}`}
              />
              <button
                onClick={createAndPick}
                disabled={!newName.trim() || loading}
                className="rounded-lg bg-[#f26522] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
              >
                Create
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-[12px] font-semibold transition-colors ${isDark ? "border-gray-700 text-gray-300 hover:border-[#f26522] hover:text-[#f26522]" : "border-gray-300 text-gray-600 hover:border-[#f26522] hover:text-[#f26522]"}`}
            >
              <FolderPlus className="h-4 w-4" />
              New folder
            </button>
          )}
        </div>
      </div>
      <style jsx global>{`
        @keyframes mb-modal-in {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// --- Confirm ----------------------------------------------------------------

function ConfirmModal() {
  const { open, title, message, confirmLabel, cancelLabel, danger } = useUIStore((s) => s.confirm);
  const close = useUIStore((s) => s.closeConfirm);
  const { theme } = useAppStore();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  const panel = isDark ? "bg-[#0d1117] border-gray-800 text-white" : "bg-white border-gray-200 text-[#0d1117]";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4"
      onClick={() => close(false)}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border shadow-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "mb-modal-in 180ms ease-out" }}
      >
        <div className="px-6 pt-6">
          <h3 className="text-[15px] font-bold">{title}</h3>
          {message ? <p className={`mt-2 text-[12.5px] leading-relaxed ${sub}`}>{message}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button
            onClick={() => close(false)}
            className={`rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors ${isDark ? "bg-white/5 text-gray-200 hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => close(true)}
            className={`rounded-lg px-4 py-2 text-[12px] font-bold text-white transition-colors ${danger ? "bg-red-500 hover:bg-red-600" : "bg-[#f26522] hover:bg-[#d9541a]"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Prompt -----------------------------------------------------------------

// --- Share to Community ----------------------------------------------------

const SHARE_CATEGORIES = ["General", "Showcase", "Help", "Wins", "Feedback"] as const;
type ShareCategory = (typeof SHARE_CATEGORIES)[number];

function ShareModal() {
  const { open, mediaType, defaultTitle, defaultBody } = useUIStore((s) => s.share);
  const close = useUIStore((s) => s.closeShare);
  const { theme } = useAppStore();
  const isDark = theme === "dark";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ShareCategory>("Showcase");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setBody(defaultBody);
      setCategory("Showcase");
      setTimeout(() => titleRef.current?.focus(), 30);
    }
  }, [open, defaultTitle, defaultBody]);

  if (!open) return null;
  const panel = isDark ? "bg-[#0d1117] border-gray-800 text-white" : "bg-white border-gray-200 text-[#0d1117]";
  const input = isDark
    ? "border-gray-700 bg-[#161b22] text-white placeholder-gray-500 focus:border-[#f26522]"
    : "border-gray-200 bg-white text-[#0d1117] placeholder-gray-400 focus:border-[#f26522]";

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    close({ title: t, body: body.trim(), category });
  };
  const cancel = () => close(null);

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" onClick={cancel}>
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "mb-modal-in 180ms ease-out" }}
      >
        <div className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? "border-gray-800" : "border-gray-100"}`}>
          <h3 className="text-sm font-bold">
            Share {mediaType === "video" ? "video" : "image"} to community
          </h3>
          <button onClick={cancel} className={`rounded-lg p-1.5 ${isDark ? "text-gray-500 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <input
            ref={titleRef}
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            className={`w-full rounded-lg border px-3 py-2.5 text-[14px] font-semibold outline-none ${input}`}
          />
          <div className="flex flex-wrap gap-1.5">
            {SHARE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  category === c
                    ? "bg-[#f26522] text-white"
                    : isDark
                      ? "bg-white/5 text-gray-300 hover:bg-white/10"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Say something about it (optional)…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            rows={4}
            className={`w-full resize-none rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed outline-none ${input}`}
          />
        </div>
        <div className={`flex items-center justify-end gap-2 border-t px-5 py-3 ${isDark ? "border-gray-800" : "border-gray-100"}`}>
          <button
            onClick={cancel}
            className={`rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors ${isDark ? "bg-white/5 text-gray-200 hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="rounded-lg bg-[#f26522] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#d9541a] disabled:opacity-50"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

function PromptModal() {
  const { open, title, description, placeholder, defaultValue, multiline, confirmLabel } = useUIStore((s) => s.prompt);
  const close = useUIStore((s) => s.closePrompt);
  const { theme } = useAppStore();
  const isDark = theme === "dark";
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, defaultValue]);

  if (!open) return null;
  const panel = isDark ? "bg-[#0d1117] border-gray-800 text-white" : "bg-white border-gray-200 text-[#0d1117]";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  const submit = () => close(value);
  const cancel = () => close(null);

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4"
      onClick={cancel}
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "mb-modal-in 180ms ease-out" }}
      >
        <div className="px-6 pt-5">
          <h3 className="text-[15px] font-bold">{title}</h3>
          {description ? <p className={`mt-1 text-[12px] leading-relaxed ${sub}`}>{description}</p> : null}
        </div>
        <div className="px-6 py-4">
          {multiline ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancel();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              rows={4}
              className={`w-full resize-none rounded-lg border px-3 py-2 text-[13px] outline-none ${isDark ? "border-gray-700 bg-[#161b22] text-white placeholder-gray-500 focus:border-[#f26522]" : "border-gray-200 bg-white text-[#0d1117] placeholder-gray-400 focus:border-[#f26522]"}`}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancel();
                if (e.key === "Enter") submit();
              }}
              className={`w-full rounded-lg border px-3 py-2 text-[13px] outline-none ${isDark ? "border-gray-700 bg-[#161b22] text-white placeholder-gray-500 focus:border-[#f26522]" : "border-gray-200 bg-white text-[#0d1117] placeholder-gray-400 focus:border-[#f26522]"}`}
            />
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 pb-5">
          <button
            onClick={cancel}
            className={`rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors ${isDark ? "bg-white/5 text-gray-200 hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-lg bg-[#f26522] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#d9541a]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
