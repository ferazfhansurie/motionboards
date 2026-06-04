"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, X, Download, ChevronLeft, ChevronRight, Play,
  Images as ImagesIcon, Image as ImageIcon, Film, Folder, Minus, Plus,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { UILayer } from "@/components/ui/ui-layer";
import { FATHOPES_MEDIA, FATHOPES_CATEGORIES, FATHOPES_TOTAL } from "@/lib/fathopes-media";

// When NEXT_PUBLIC_FATHOPES_BASE is set (the R2 public bucket URL) media is
// served from there; otherwise it falls back to /public so local dev still works.
const MEDIA_BASE = (process.env.NEXT_PUBLIC_FATHOPES_BASE || "").replace(/\/$/, "");
const mediaUrl = (src: string) => (MEDIA_BASE ? `${MEDIA_BASE}${src}` : src);

const PHOTO_COUNT = FATHOPES_MEDIA.filter((m) => m.type === "image").length;
const VIDEO_COUNT = FATHOPES_MEDIA.filter((m) => m.type === "video").length;

type TypeFilter = "all" | "image" | "video";

export default function FathopesMediaPage() {
  const { theme } = useAppStore();
  const isDark = theme === "dark";

  // ADletic / MotionBoards palette (paper + ink + orange).
  const c = isDark
    ? { bg: "#14100c", side: "#1c1712", line: "#2a231a", text: "#f4ece0", dim: "#9a8f7d", tile: "#221c14", hover: "#2a231a" }
    : { bg: "#fdf6ec", side: "#fff8ec", line: "#e7ddc9", text: "#0d1117", dim: "#8a7d68", tile: "#f0e6d4", hover: "#f3ebdb" };
  const accent = "#f26522";

  const [activeCat, setActiveCat] = useState<string>("all"); // "all" or a category slug
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [rowHeight, setRowHeight] = useState(200);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const items = useMemo(
    () =>
      FATHOPES_MEDIA.filter(
        (m) => (activeCat === "all" || m.catSlug === activeCat) && (typeFilter === "all" || m.type === typeFilter),
      ),
    [activeCat, typeFilter],
  );

  const title = activeCat === "all" ? "All Media" : FATHOPES_CATEGORIES.find((x) => x.slug === activeCat)?.label ?? "";

  // Keyboard navigation for the lightbox.
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

  function NavItem({
    label, count, active, onClick, icon,
  }: { label: string; count: number; active: boolean; onClick: () => void; icon: React.ReactNode }) {
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
      {/* Sidebar (desktop) */}
      <aside
        className="hidden md:flex w-[244px] shrink-0 flex-col border-r"
        style={{ background: c.side, borderColor: c.line }}
      >
        <div className="px-3 pt-3">
          <Link href="/generate" className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: c.dim }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to canvas
          </Link>
          <h1 className="mt-3 px-1 text-[20px] font-bold tracking-tight">FatHopes</h1>
          <p className="px-1 text-[12px]" style={{ color: c.dim }}>{FATHOPES_TOTAL} items</p>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto px-2 pb-6">
          <NavItem label="All Media" count={FATHOPES_TOTAL} active={activeCat === "all"} onClick={() => setActiveCat("all")} icon={<ImagesIcon className="h-4 w-4" />} />

          <p className="px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.dim }}>Media Types</p>
          <NavItem label="Photos" count={PHOTO_COUNT} active={typeFilter === "image"} onClick={() => setTypeFilter((t) => (t === "image" ? "all" : "image"))} icon={<ImageIcon className="h-4 w-4" />} />
          <NavItem label="Videos" count={VIDEO_COUNT} active={typeFilter === "video"} onClick={() => setTypeFilter((t) => (t === "video" ? "all" : "video"))} icon={<Film className="h-4 w-4" />} />

          <p className="px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.dim }}>Categories</p>
          {FATHOPES_CATEGORIES.map((cat) => (
            <NavItem
              key={cat.slug}
              label={cat.label}
              count={cat.count}
              active={activeCat === cat.slug}
              onClick={() => setActiveCat(cat.slug)}
              icon={<Folder className="h-4 w-4" />}
            />
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <header
          className="sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-2.5"
          style={{ background: `${c.bg}f2`, borderColor: c.line, backdropFilter: "blur(8px)" }}
        >
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold leading-tight">{title}</h2>
            <p className="text-[12px] leading-tight" style={{ color: c.dim }}>
              {items.length} {items.length === 1 ? "item" : "items"}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1 rounded-lg p-0.5" style={{ background: c.tile }}>
            <button
              onClick={() => setRowHeight((h) => Math.max(120, h - 40))}
              className="rounded-md p-1.5"
              style={{ color: c.text }}
              title="Smaller thumbnails"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setRowHeight((h) => Math.min(340, h + 40))}
              className="rounded-md p-1.5"
              style={{ color: c.text }}
              title="Larger thumbnails"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Mobile category bar */}
        <div className="md:hidden flex gap-2 overflow-x-auto border-b px-3 py-2" style={{ borderColor: c.line }}>
          <MobileChip label="All" count={FATHOPES_TOTAL} active={activeCat === "all"} onClick={() => setActiveCat("all")} c={c} accent={accent} />
          {FATHOPES_CATEGORIES.map((cat) => (
            <MobileChip key={cat.slug} label={cat.label} count={cat.count} active={activeCat === cat.slug} onClick={() => setActiveCat(cat.slug)} c={c} accent={accent} />
          ))}
        </div>

        {/* Justified photo grid */}
        <main className="flex-1 overflow-y-auto p-[3px]">
          <div className="flex flex-wrap" style={{ gap: 3 }}>
            {items.map((m, i) => {
              const ratio = m.ratio || (m.type === "video" ? 16 / 9 : 1);
              return (
                <button
                  key={m.src}
                  onClick={() => setLightbox(i)}
                  className="group relative overflow-hidden"
                  style={{ height: rowHeight, flexGrow: ratio, flexBasis: `${ratio * rowHeight}px`, background: c.tile }}
                >
                  {m.type === "video" ? (
                    <>
                      <video src={mediaUrl(m.src)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55">
                        <Play className="h-3 w-3 fill-white text-white" />
                      </span>
                    </>
                  ) : (
                    <img
                      src={mediaUrl(m.thumb)}
                      alt={m.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="pointer-events-none absolute inset-0 transition-colors group-hover:bg-black/10" />
                </button>
              );
            })}
            {/* keep the last row left-aligned instead of stretching */}
            <i style={{ flexGrow: 10 }} aria-hidden />
          </div>
        </main>
      </div>

      {lightbox !== null && items[lightbox] && (
        <Lightbox
          item={items[lightbox]}
          index={lightbox}
          total={items.length}
          isDark={isDark}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((i) => (i === null ? i : (i - 1 + items.length) % items.length))}
          onNext={() => setLightbox((i) => (i === null ? i : (i + 1) % items.length))}
        />
      )}

      <UILayer />
    </div>
  );
}

function MobileChip({
  label, count, active, onClick, c, accent,
}: { label: string; count: number; active: boolean; onClick: () => void; c: { tile: string; text: string; dim: string }; accent: string }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium"
      style={{ background: active ? accent : c.tile, color: active ? "#fff" : c.text }}
    >
      {label} <span style={{ color: active ? "rgba(255,255,255,0.8)" : c.dim }}>{count}</span>
    </button>
  );
}

function Lightbox({
  item, index, total, isDark, onClose, onPrev, onNext,
}: {
  item: { src: string; name: string; type: "image" | "video"; category: string };
  index: number;
  total: number;
  isDark: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  void isDark;
  return (
    <div className="fixed inset-0 z-[150] flex flex-col" style={{ background: "rgba(0,0,0,0.92)" }} onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-white/60">{item.category}</p>
          <p className="truncate text-[13px] font-medium">{item.name} · {index + 1} / {total}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={mediaUrl(item.src)} download className="rounded-full p-2 hover:bg-white/10" title="Download">
            <Download className="h-5 w-5" />
          </a>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="relative flex flex-1 items-center justify-center px-4 pb-6" onClick={(e) => e.stopPropagation()}>
        {total > 1 && (
          <button onClick={onPrev} className="absolute left-3 rounded-full p-2 text-white hover:bg-white/10" aria-label="Previous">
            <ChevronLeft className="h-8 w-8" />
          </button>
        )}
        {item.type === "video" ? (
          <video src={mediaUrl(item.src)} controls autoPlay preload="metadata" className="max-h-full max-w-full" />
        ) : (
          <img src={mediaUrl(item.src)} alt={item.name} className="max-h-full max-w-full object-contain" />
        )}
        {total > 1 && (
          <button onClick={onNext} className="absolute right-3 rounded-full p-2 text-white hover:bg-white/10" aria-label="Next">
            <ChevronRight className="h-8 w-8" />
          </button>
        )}
      </div>
    </div>
  );
}
