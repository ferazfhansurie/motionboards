"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, X, Download, ChevronLeft, ChevronRight, Play, Trash2, Upload, Loader2, Sparkles,
  Images as ImagesIcon, Image as ImageIcon, Film, Folder,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { UILayer } from "@/components/ui/ui-layer";
import { askConfirm, askPrompt, showToast, updateToast } from "@/lib/ui-store";
import { FathopesAgent, type AgentRef } from "@/components/fathopes/agent-panel";

const MEDIA_BASE = (process.env.NEXT_PUBLIC_FATHOPES_BASE || "").replace(/\/$/, "");
const mediaUrl = (src: string) => (MEDIA_BASE ? `${MEDIA_BASE}${src}` : src);

type TypeFilter = "all" | "image" | "video";

interface MediaItem {
  id: string;
  src: string;
  thumb: string;
  ratio: number;
  category: string;
  catSlug: string;
  type: "image" | "video";
  name: string;
}

// Build a downscaled webp thumbnail + aspect ratio from an image File, honouring
// EXIF orientation so sideways phone shots come out upright.
async function makeImageThumb(file: File): Promise<{ blob: Blob; ratio: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image", resizeHeight: 500, resizeQuality: "high" });
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0);
  const ratio = bmp.width / bmp.height;
  bmp.close?.();
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/webp", 0.72));
  return { blob, ratio };
}

async function videoRatio(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9);
    v.onerror = () => resolve(16 / 9);
    v.src = URL.createObjectURL(file);
  });
}

export default function FathopesMediaPage() {
  const { theme } = useAppStore();
  const isDark = theme === "dark";

  const c = isDark
    ? { bg: "#14100c", side: "#1c1712", line: "#2a231a", text: "#f4ece0", dim: "#9a8f7d", tile: "#221c14", hover: "#2a231a" }
    : { bg: "#fdf6ec", side: "#fff8ec", line: "#e7ddc9", text: "#0d1117", dim: "#8a7d68", tile: "#f0e6d4", hover: "#f3ebdb" };
  const accent = "#f26522";

  const [allItems, setAllItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [rowHeight, setRowHeight] = useState(200);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [references, setReferences] = useState<AgentRef[]>([]);

  function addReference(item: MediaItem) {
    setReferences((prev) => (prev.some((r) => r.id === item.id) ? prev : [...prev, { id: item.id, src: item.src, name: item.name, type: item.type }]));
    setAgentOpen(true);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/fathopes").then((r) => r.json());
      setAllItems(Array.isArray(res?.items) ? res.items : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const categories = useMemo(() => {
    const map = new Map<string, { label: string; slug: string; count: number }>();
    for (const m of allItems) {
      if (!map.has(m.catSlug)) map.set(m.catSlug, { label: m.category, slug: m.catSlug, count: 0 });
      map.get(m.catSlug)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [allItems]);

  const items = useMemo(
    () =>
      allItems.filter(
        (m) => (activeCat === "all" || m.catSlug === activeCat) && (typeFilter === "all" || m.type === typeFilter),
      ),
    [allItems, activeCat, typeFilter],
  );

  const title = activeCat === "all" ? "All Media" : categories.find((x) => x.slug === activeCat)?.label ?? "";

  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : (i + 1) % items.length));
      else if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : (i - 1 + items.length) % items.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, items.length]);

  async function onFilesChosen(files: FileList | null) {
    if (!files || !files.length) return;
    // Upload into the active category, or ask for a name when on "All Media".
    let category = activeCat === "all" ? "" : categories.find((x) => x.slug === activeCat)?.label ?? "";
    if (!category) {
      const typed = await askPrompt({
        title: "Add to which category?",
        description: "New or existing — e.g. Strand Mall, Ranger Training.",
        placeholder: "Category name",
        defaultValue: "Uncategorised",
        confirmLabel: "Upload",
      });
      if (typed === null) return;
      category = typed.trim() || "Uncategorised";
    }

    setUploading(true);
    const toastId = showToast(`Uploading 0/${files.length}…`, { kind: "loading" });
    let done = 0, failed = 0;
    const added: MediaItem[] = [];

    for (const file of Array.from(files)) {
      try {
        const isVideo = file.type.startsWith("video/");
        const presign = await fetch("/api/fathopes/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream", category }),
        });
        if (presign.status === 401) { updateToast(toastId, { kind: "error", message: "Please log in to upload." }); break; }
        if (!presign.ok) throw new Error("presign failed");
        const { originalUploadUrl, thumbUploadUrl, originalPath, thumbPath } = await presign.json();

        await fetch(originalUploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });

        let thumb = originalPath;
        let ratio = 16 / 9;
        if (isVideo) {
          ratio = await videoRatio(file);
        } else {
          const t = await makeImageThumb(file);
          ratio = t.ratio;
          await fetch(thumbUploadUrl, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: t.blob });
          thumb = thumbPath;
        }

        const saved = await fetch("/api/fathopes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ src: originalPath, thumb, ratio, category, type: isVideo ? "video" : "image", name: file.name }),
        });
        if (!saved.ok) throw new Error("save failed");
        const { item } = await saved.json();
        added.push(item);
      } catch {
        failed++;
      }
      done++;
      updateToast(toastId, { kind: "loading", message: `Uploading ${done}/${files.length}…` });
    }

    if (added.length) setAllItems((prev) => [...prev, ...added]);
    setUploading(false);
    if (added.length) updateToast(toastId, { kind: "success", message: `Added ${added.length}${failed ? `, ${failed} failed` : ""}.` });
    else if (failed) updateToast(toastId, { kind: "error", message: "Upload failed." });
    if (fileInput.current) fileInput.current.value = "";
  }

  async function removeItem(item: MediaItem) {
    const ok = await askConfirm({ title: "Delete this file?", message: "It will be removed from the gallery and storage.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const toastId = showToast("Deleting…", { kind: "loading" });
    const res = await fetch(`/api/fathopes?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (res.status === 401) { updateToast(toastId, { kind: "error", message: "Please log in to delete." }); return; }
    if (res.ok) {
      setAllItems((prev) => prev.filter((x) => x.id !== item.id));
      setLightbox(null);
      updateToast(toastId, { kind: "success", message: "Deleted." });
    } else {
      updateToast(toastId, { kind: "error", message: "Delete failed." });
    }
  }

  function NavItem({ label, count, active, onClick, icon }: { label: string; count: number; active: boolean; onClick: () => void; icon: React.ReactNode }) {
    return (
      <button
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors"
        style={{ background: active ? accent : "transparent", color: active ? "#fff" : c.text }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = c.hover; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ color: active ? "#fff" : c.dim, display: "flex" }}>{icon}</span>
        <span className="flex-1 truncate font-medium">{label}</span>
        <span className="text-[11px] tabular-nums" style={{ color: active ? "rgba(255,255,255,0.8)" : c.dim }}>{count}</span>
      </button>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: c.bg, color: c.text }}>
      <input ref={fileInput} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => onFilesChosen(e.target.files)} />

      {/* Sidebar */}
      <aside className="hidden md:flex w-[244px] shrink-0 flex-col border-r" style={{ background: c.side, borderColor: c.line }}>
        <div className="px-3 pt-3">
          <Link href="/generate" className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: c.dim }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to canvas
          </Link>
          <h1 className="mt-3 px-1 text-[20px] font-bold tracking-tight">FatHopes</h1>
          <p className="px-1 text-[12px]" style={{ color: c.dim }}>{allItems.length} items</p>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto px-2 pb-6">
          <NavItem label="All Media" count={allItems.length} active={activeCat === "all"} onClick={() => setActiveCat("all")} icon={<ImagesIcon className="h-4 w-4" />} />

          <p className="px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.dim }}>Media Types</p>
          <NavItem label="Photos" count={allItems.filter((m) => m.type === "image").length} active={typeFilter === "image"} onClick={() => setTypeFilter((t) => (t === "image" ? "all" : "image"))} icon={<ImageIcon className="h-4 w-4" />} />
          <NavItem label="Videos" count={allItems.filter((m) => m.type === "video").length} active={typeFilter === "video"} onClick={() => setTypeFilter((t) => (t === "video" ? "all" : "video"))} icon={<Film className="h-4 w-4" />} />

          <p className="px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.dim }}>Categories</p>
          {categories.map((cat) => (
            <NavItem key={cat.slug} label={cat.label} count={cat.count} active={activeCat === cat.slug} onClick={() => setActiveCat(cat.slug)} icon={<Folder className="h-4 w-4" />} />
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-2.5" style={{ background: `${c.bg}f2`, borderColor: c.line, backdropFilter: "blur(8px)" }}>
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold leading-tight">{title}</h2>
            <p className="text-[12px] leading-tight" style={{ color: c.dim }}>{items.length} {items.length === 1 ? "item" : "items"}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
              style={{ background: accent }}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </button>
            <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: c.tile }}>
              <button onClick={() => setRowHeight((h) => Math.max(120, h - 40))} className="rounded-md px-2 py-1.5 text-[15px] font-bold leading-none" style={{ color: c.text }} title="Smaller">−</button>
              <button onClick={() => setRowHeight((h) => Math.min(340, h + 40))} className="rounded-md px-2 py-1.5 text-[15px] font-bold leading-none" style={{ color: c.text }} title="Larger">+</button>
            </div>
          </div>
        </header>

        {/* Mobile category bar */}
        <div className="md:hidden flex gap-2 overflow-x-auto border-b px-3 py-2" style={{ borderColor: c.line }}>
          <MobileChip label="All" count={allItems.length} active={activeCat === "all"} onClick={() => setActiveCat("all")} c={c} accent={accent} />
          {categories.map((cat) => (
            <MobileChip key={cat.slug} label={cat.label} count={cat.count} active={activeCat === cat.slug} onClick={() => setActiveCat(cat.slug)} c={c} accent={accent} />
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-[3px]">
          {loading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: accent }} /></div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center" style={{ color: c.dim }}>
              <p className="text-[15px]">No media here yet.</p>
              <button onClick={() => fileInput.current?.click()} className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ background: accent }}>Upload files</button>
            </div>
          ) : (
            <div className="flex flex-wrap" style={{ gap: 3 }}>
              {items.map((m, i) => {
                const ratio = m.ratio || (m.type === "video" ? 16 / 9 : 1);
                return (
                  <button key={m.id} onClick={() => setLightbox(i)} className="group relative overflow-hidden" style={{ height: rowHeight, flexGrow: ratio, flexBasis: `${ratio * rowHeight}px`, background: c.tile }}>
                    {m.type === "video" ? (
                      <>
                        <video src={mediaUrl(m.src)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                        <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55"><Play className="h-3 w-3 fill-white text-white" /></span>
                      </>
                    ) : (
                      <img src={mediaUrl(m.thumb)} alt={m.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    )}
                    <span className="pointer-events-none absolute inset-0 transition-colors group-hover:bg-black/10" />
                  </button>
                );
              })}
              <i style={{ flexGrow: 10 }} aria-hidden />
            </div>
          )}
        </main>
      </div>

      {lightbox !== null && items[lightbox] && (
        <Lightbox
          item={items[lightbox]}
          index={lightbox}
          total={items.length}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((i) => (i === null ? i : (i - 1 + items.length) % items.length))}
          onNext={() => setLightbox((i) => (i === null ? i : (i + 1) % items.length))}
          onDelete={() => removeItem(items[lightbox])}
          onUseAsReference={() => { addReference(items[lightbox]); setLightbox(null); }}
        />
      )}

      <FathopesAgent
        open={agentOpen}
        setOpen={setAgentOpen}
        references={references}
        setReferences={setReferences}
        onSaved={(item) => setAllItems((prev) => [...prev, item])}
        library={allItems}
      />

      <UILayer />
    </div>
  );
}

function MobileChip({ label, count, active, onClick, c, accent }: { label: string; count: number; active: boolean; onClick: () => void; c: { tile: string; text: string; dim: string }; accent: string }) {
  return (
    <button onClick={onClick} className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium" style={{ background: active ? accent : c.tile, color: active ? "#fff" : c.text }}>
      {label} <span style={{ color: active ? "rgba(255,255,255,0.8)" : c.dim }}>{count}</span>
    </button>
  );
}

function Lightbox({ item, index, total, onClose, onPrev, onNext, onDelete, onUseAsReference }: {
  item: MediaItem; index: number; total: number; onClose: () => void; onPrev: () => void; onNext: () => void; onDelete: () => void; onUseAsReference: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[150] flex flex-col" style={{ background: "rgba(0,0,0,0.92)" }} onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-white/60">{item.category}</p>
          <p className="truncate text-[13px] font-medium">{item.name} · {index + 1} / {total}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onUseAsReference} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white" style={{ background: "#f26522" }} title="Use as AI reference"><Sparkles className="h-4 w-4" /> Use as reference</button>
          <a href={mediaUrl(item.src)} download className="rounded-full p-2 hover:bg-white/10" title="Download"><Download className="h-5 w-5" /></a>
          <button onClick={onDelete} className="rounded-full p-2 hover:bg-white/10" style={{ color: "#ff6b6b" }} title="Delete"><Trash2 className="h-5 w-5" /></button>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" title="Close"><X className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-6" onClick={(e) => e.stopPropagation()}>
        {total > 1 && <button onClick={onPrev} className="absolute left-3 rounded-full p-2 text-white hover:bg-white/10" aria-label="Previous"><ChevronLeft className="h-8 w-8" /></button>}
        {item.type === "video" ? (
          <video src={mediaUrl(item.src)} controls autoPlay preload="metadata" className="max-h-full max-w-full" />
        ) : (
          <img src={mediaUrl(item.src)} alt={item.name} className="max-h-full max-w-full object-contain" />
        )}
        {total > 1 && <button onClick={onNext} className="absolute right-3 rounded-full p-2 text-white hover:bg-white/10" aria-label="Next"><ChevronRight className="h-8 w-8" /></button>}
      </div>
    </div>
  );
}
