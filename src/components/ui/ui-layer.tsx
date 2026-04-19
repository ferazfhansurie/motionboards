"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Info, AlertTriangle, Loader2, X, FolderPlus, FolderOpen } from "lucide-react";
import { useUIStore, type Toast } from "@/lib/ui-store";
import { useAppStore } from "@/lib/store";
import { Sticker } from "@/components/ui/stickers";

// Shared theme tokens so every primitive in this file reads from the same palette.
function useZine() {
  const { theme } = useAppStore();
  const isDark = theme === "dark";
  return {
    isDark,
    ink: isDark ? "#f4ece0" : "#0d1117",
    paper: isDark ? "#1c1712" : "#fff8ec",
    paperDeep: isDark ? "#14100c" : "#fdf6ec",
  };
}

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

// --- Toasts ---------------------------------------------------------------

function Toasts() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);
  const zine = useZine();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[320px] flex-col gap-2">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} zine={zine} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastRow({
  toast,
  zine,
  onDismiss,
}: {
  toast: Toast;
  zine: ReturnType<typeof useZine>;
  onDismiss: () => void;
}) {
  const accent = {
    info: "#2563eb",
    success: "#16a34a",
    error: "#dc2626",
    loading: "#f26522",
  }[toast.kind];

  const icon = {
    info: <Info className="h-4 w-4" style={{ color: accent }} />,
    success: <Check className="h-4 w-4" style={{ color: accent }} />,
    error: <AlertTriangle className="h-4 w-4" style={{ color: accent }} />,
    loading: <Loader2 className="h-4 w-4 animate-spin" style={{ color: accent }} />,
  }[toast.kind];

  return (
    <div
      className="pointer-events-auto flex items-start gap-2.5 rounded-2xl border-[2.5px] px-3 py-2.5"
      style={{
        background: zine.paper,
        color: zine.ink,
        borderColor: zine.ink,
        boxShadow: `4px 4px 0 0 ${zine.ink}`,
        animation: "mb-toast-in 220ms cubic-bezier(0.2,0.8,0.2,1)",
      }}
    >
      <div
        className="mt-0.5 shrink-0 rounded-full border-2 p-1"
        style={{ background: `${accent}1a`, borderColor: accent }}
      >
        {icon}
      </div>
      <p className="flex-1 text-[12px] font-bold leading-snug">{toast.message}</p>
      {toast.kind !== "loading" && (
        <button
          onClick={onDismiss}
          className="-mr-1 shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
          style={{ color: zine.ink }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <style jsx global>{`
        @keyframes mb-toast-in {
          from { transform: translateX(14px) rotate(-1deg); opacity: 0; }
          to { transform: translateX(0) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// --- Shared modal shell ---------------------------------------------------

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function ZinePanel({
  children,
  className = "",
  maxWidth = "max-w-md",
  onClick,
  sticker = "simple",
}: {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
  onClick?: (e: React.MouseEvent) => void;
  sticker?: "none" | "simple" | "rich";
}) {
  const { ink, paper } = useZine();
  return (
    <div className={`relative ${maxWidth} w-full`}>
      {/* Floating doodles outside the modal body */}
      {sticker !== "none" && (
        <>
          <Sticker.Daisy className="absolute -top-8 -left-10 z-10" rotate={-14} size={42} />
          <Sticker.Sparkle className="absolute -top-5 right-10 z-10" rotate={18} size={22} />
          {sticker === "rich" && (
            <>
              <Sticker.Heart className="absolute -bottom-6 -right-6 z-10" rotate={14} size={30} />
              <Sticker.Scribble
                className="absolute -bottom-8 left-6 z-10"
                rotate={16}
                size={38}
                color="#f26522"
              />
              <Sticker.Lightning className="absolute top-24 -right-8 z-10" rotate={-18} size={24} />
            </>
          )}
        </>
      )}
      <div
        onClick={onClick}
        className={`relative w-full overflow-hidden rounded-3xl border-[2.5px] ${className}`}
        style={{
          background: paper,
          color: ink,
          borderColor: ink,
          boxShadow: `8px 8px 0 0 ${ink}`,
          animation: "mb-modal-in 200ms cubic-bezier(0.2,0.8,0.2,1)",
        }}
      >
        {children}
      </div>
      <style jsx global>{`
        @keyframes mb-modal-in {
          from { transform: scale(0.96) rotate(-0.5deg); opacity: 0; }
          to { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function StickerInput({
  value,
  onChange,
  placeholder,
  onKeyDown,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const { ink, paperDeep } = useZine();
  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className="w-full rounded-xl border-[2.5px] px-4 py-2.5 text-[14px] font-bold outline-none"
      style={{ background: paperDeep, color: ink, borderColor: ink, boxShadow: `3px 3px 0 0 ${ink}` }}
    />
  );
}

function StickerTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  onKeyDown,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { ink, paperDeep } = useZine();
  return (
    <textarea
      ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className="w-full resize-none rounded-xl border-[2.5px] px-4 py-2.5 text-[13px] leading-relaxed outline-none"
      style={{ background: paperDeep, color: ink, borderColor: ink, boxShadow: `3px 3px 0 0 ${ink}` }}
    />
  );
}

function ZineBtn({
  onClick,
  children,
  disabled,
  variant = "primary",
  rotate = 0,
  title,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  rotate?: number;
  title?: string;
}) {
  const { ink } = useZine();
  const bg = variant === "primary" ? "#f26522" : variant === "danger" ? "#dc2626" : "transparent";
  const color = variant === "ghost" ? ink : "#fff";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border-[2.5px] px-4 py-2 text-[12px] font-black uppercase tracking-wider transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
      style={{
        background: bg,
        color,
        borderColor: ink,
        boxShadow: variant === "ghost" ? "none" : `3px 3px 0 0 ${ink}`,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {children}
    </button>
  );
}

function DialogHeader({ title, description, onClose }: { title: string; description?: string; onClose: () => void }) {
  const { ink } = useZine();
  return (
    <div className="flex items-start justify-between border-b-[2.5px] px-5 py-4" style={{ borderColor: ink }}>
      <div>
        <span className="mb-serif-italic text-[12px] opacity-70">— {title.toLowerCase()} —</span>
        <h3 className="mb-serif-display leading-none mt-1" style={{ fontSize: "1.45rem" }}>
          {title}
        </h3>
        {description ? <p className="mt-1 text-[11.5px] opacity-80">{description}</p> : null}
      </div>
      <button
        onClick={onClose}
        className="rounded-full border-2 p-1.5"
        style={{ borderColor: ink, color: ink }}
      >
        <X className="h-4 w-4" />
      </button>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Fraunces:ital,wght@0,800;1,600;1,700&display=swap');
        .mb-serif-italic { font-style: italic; font-family: 'Fraunces', 'Georgia', 'Times New Roman', serif; font-weight: 600; letter-spacing: -0.01em; }
        .mb-serif-display { font-family: 'Fraunces', 'Georgia', serif; font-weight: 800; font-style: italic; letter-spacing: -0.03em; }
      `}</style>
    </div>
  );
}

// --- Folder picker --------------------------------------------------------

interface FolderRow {
  id: string;
  name: string;
  itemCount: number;
}

function FolderPickerModal() {
  const { open } = useUIStore((s) => s.folderPicker);
  const close = useUIStore((s) => s.closeFolderPicker);
  const { ink, paper, paperDeep } = useZine();
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

  return (
    <ModalBackdrop onClose={() => close(null)}>
      <ZinePanel onClick={(e) => e.stopPropagation()} maxWidth="max-w-md">
        <DialogHeader title="Save to folder" onClose={() => close(null)} />
        <div className="max-h-80 overflow-y-auto p-3">
          {loading && folders.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: ink, opacity: 0.6 }} />
            </div>
          ) : folders.length === 0 && !creating ? (
            <p className="px-3 py-6 text-center text-[12px]" style={{ color: ink, opacity: 0.7 }}>
              No folders yet. Create one below.
            </p>
          ) : (
            <div className="space-y-2">
              {folders.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => close(f.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border-[2.5px] px-3 py-2.5 text-left transition-transform hover:-translate-y-0.5"
                  style={{
                    background: paperDeep,
                    color: ink,
                    borderColor: ink,
                    boxShadow: `3px 3px 0 0 ${ink}`,
                    transform: `rotate(${i % 2 === 0 ? -0.5 : 0.5}deg)`,
                  }}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-white"
                    style={{ background: "#f26522", borderColor: ink }}
                  >
                    <FolderOpen className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] font-black">{f.name}</p>
                    <p className="text-[10px] font-bold" style={{ opacity: 0.7 }}>
                      {f.itemCount} item{f.itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t-[2.5px] px-3 py-3" style={{ borderColor: ink, background: paper }}>
          {creating ? (
            <div className="flex items-center gap-2">
              <StickerInput
                inputRef={newInputRef}
                value={newName}
                placeholder="Folder name"
                onChange={setNewName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createAndPick();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
              />
              <ZineBtn onClick={createAndPick} disabled={!newName.trim() || loading}>
                Create
              </ZineBtn>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-[2.5px] border-dashed py-2.5 text-[12px] font-black uppercase tracking-wider transition-transform hover:-translate-y-0.5"
              style={{ color: ink, borderColor: ink, background: "transparent" }}
            >
              <FolderPlus className="h-4 w-4" />
              New folder
            </button>
          )}
        </div>
      </ZinePanel>
    </ModalBackdrop>
  );
}

// --- Confirm --------------------------------------------------------------

function ConfirmModal() {
  const { open, title, message, confirmLabel, cancelLabel, danger } = useUIStore((s) => s.confirm);
  const close = useUIStore((s) => s.closeConfirm);

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

  return (
    <ModalBackdrop onClose={() => close(false)}>
      <ZinePanel onClick={(e) => e.stopPropagation()} maxWidth="max-w-sm">
        <div className="px-6 pt-6">
          <span className="mb-serif-italic text-[12px] opacity-70">— hold up —</span>
          <h3 className="mb-serif-display leading-none mt-1" style={{ fontSize: "1.55rem" }}>
            {title}
          </h3>
          {message ? <p className="mt-2 text-[13px] leading-relaxed" style={{ opacity: 0.8 }}>{message}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <ZineBtn onClick={() => close(false)} variant="ghost">
            {cancelLabel}
          </ZineBtn>
          <ZineBtn onClick={() => close(true)} variant={danger ? "danger" : "primary"} rotate={-1}>
            {confirmLabel}
          </ZineBtn>
        </div>
      </ZinePanel>
    </ModalBackdrop>
  );
}

// --- Prompt ---------------------------------------------------------------

function PromptModal() {
  const { open, title, description, placeholder, defaultValue, multiline, confirmLabel } = useUIStore((s) => s.prompt);
  const close = useUIStore((s) => s.closePrompt);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, defaultValue]);

  if (!open) return null;
  const submit = () => close(value);
  const cancel = () => close(null);

  return (
    <ModalBackdrop onClose={cancel}>
      <ZinePanel onClick={(e) => e.stopPropagation()} maxWidth="max-w-md">
        <DialogHeader title={title} description={description} onClose={cancel} />
        <div className="px-6 py-4">
          {multiline ? (
            <StickerTextarea
              inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={setValue}
              placeholder={placeholder}
              rows={4}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancel();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
            />
          ) : (
            <StickerInput
              inputRef={inputRef as React.RefObject<HTMLInputElement>}
              value={value}
              onChange={setValue}
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancel();
                if (e.key === "Enter") submit();
              }}
            />
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 pb-5">
          <ZineBtn onClick={cancel} variant="ghost">Cancel</ZineBtn>
          <ZineBtn onClick={submit} rotate={-1}>{confirmLabel}</ZineBtn>
        </div>
      </ZinePanel>
    </ModalBackdrop>
  );
}

// --- Share to Community ---------------------------------------------------

const SHARE_CATEGORIES = ["General", "Showcase", "Help", "Wins", "Feedback"] as const;
type ShareCategory = (typeof SHARE_CATEGORIES)[number];

function ShareModal() {
  const { open, mediaType, defaultTitle, defaultBody } = useUIStore((s) => s.share);
  const close = useUIStore((s) => s.closeShare);
  const { ink, paper, paperDeep } = useZine();
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

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    close({ title: t, body: body.trim(), category });
  };
  const cancel = () => close(null);

  return (
    <ModalBackdrop onClose={cancel}>
      <ZinePanel onClick={(e) => e.stopPropagation()} maxWidth="max-w-lg" sticker="rich">
        <DialogHeader
          title={`Share ${mediaType === "video" ? "video" : "image"} to community`}
          description="Give it a title + pick a vibe."
          onClose={cancel}
        />
        <div className="flex flex-col gap-3 px-5 py-5">
          <StickerInput
            inputRef={titleRef}
            value={title}
            onChange={setTitle}
            placeholder="Title. Keep it punchy."
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            {SHARE_CATEGORIES.map((c, i) => {
              const active = category === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="inline-flex items-center gap-1.5 rounded-full border-[2.5px] px-3 py-1 text-[11px] font-black uppercase tracking-wider transition-transform hover:-translate-y-0.5"
                  style={{
                    background: active ? "#f26522" : paperDeep,
                    color: active ? "#fff" : ink,
                    borderColor: ink,
                    boxShadow: active ? `3px 3px 0 0 ${ink}` : "none",
                    transform: active ? `rotate(${i % 2 === 0 ? -1.5 : 1.5}deg)` : "rotate(0deg)",
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <StickerTextarea
            value={body}
            onChange={setBody}
            placeholder="Say something about it (optional)…"
            rows={4}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t-[2.5px] px-5 py-3" style={{ borderColor: ink, background: paper }}>
          <ZineBtn onClick={cancel} variant="ghost">Cancel</ZineBtn>
          <ZineBtn onClick={submit} disabled={!title.trim()} rotate={-1}>Share</ZineBtn>
        </div>
      </ZinePanel>
    </ModalBackdrop>
  );
}
