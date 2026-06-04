"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, X, Download, Film, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { UILayer } from "@/components/ui/ui-layer";
import { FATHOPES_MEDIA, FATHOPES_CATEGORIES, FATHOPES_TOTAL } from "@/lib/fathopes-media";

// When NEXT_PUBLIC_FATHOPES_BASE is set (e.g. the R2 public bucket URL) media is
// served from there; otherwise it falls back to /public so local dev just works.
const MEDIA_BASE = (process.env.NEXT_PUBLIC_FATHOPES_BASE || "").replace(/\/$/, "");
const mediaUrl = (src: string) => (MEDIA_BASE ? `${MEDIA_BASE}${src}` : src);

export default function FathopesMediaPage() {
  const { theme } = useAppStore();
  const isDark = theme === "dark";

  const ink = isDark ? "#f4ece0" : "#0d1117";
  const paper = isDark ? "#14100c" : "#fdf6ec";
  const paperAlt = isDark ? "#1c1712" : "#fff8ec";

  const [activeCat, setActiveCat] = useState<string>(FATHOPES_CATEGORIES[0]?.slug ?? "");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const items = useMemo(
    () => FATHOPES_MEDIA.filter((m) => m.catSlug === activeCat),
    [activeCat],
  );
  const activeCatLabel = FATHOPES_CATEGORIES.find((c) => c.slug === activeCat)?.label ?? "";

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

  return (
    <div className="relative min-h-screen" style={{ background: paper, color: ink }}>
      {/* Dot paper texture */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: isDark
            ? "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)"
            : "radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "4px 4px",
          opacity: 0.6,
        }}
      />

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b-[2.5px]" style={{ borderColor: ink, background: paperAlt }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/generate" className="flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.12em] hover:text-[#f26522]">
            <ArrowLeft className="h-4 w-4" /> Back to canvas
          </Link>
          <div className="text-[13px] font-black uppercase tracking-[0.2em]">FatHopes · Media</div>
          <div className="text-[12px] font-bold opacity-70">{FATHOPES_TOTAL} files</div>
        </div>
      </header>

      {/* Masthead */}
      <section className="relative mx-auto max-w-6xl px-5 pt-8 pb-2">
        <span className="text-[13px] opacity-70 font-medium">Every shot, clip and asset in one place</span>
        <h1 className="mt-1 font-black uppercase leading-[0.92] tracking-tight" style={{ fontSize: "clamp(2.6rem, 7vw, 4.5rem)" }}>
          FatHopes footage
        </h1>
      </section>

      {/* Category nav */}
      <nav className="sticky top-[49px] z-10 border-b-[2.5px]" style={{ borderColor: ink, background: paper }}>
        <div className="mx-auto max-w-6xl px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {FATHOPES_CATEGORIES.map((c) => {
              const on = c.slug === activeCat;
              return (
                <button
                  key={c.slug}
                  onClick={() => setActiveCat(c.slug)}
                  className="rounded-full border-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-transform hover:-translate-y-0.5"
                  style={{
                    borderColor: ink,
                    background: on ? "#f26522" : paperAlt,
                    color: on ? "#fff" : ink,
                    boxShadow: `2px 2px 0 0 ${ink}`,
                  }}
                >
                  {c.label} <span className="opacity-70">{c.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Grid */}
      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-black" style={{ fontSize: "1.25rem" }}>{activeCatLabel}</h2>
          <span className="flex-1 border-t-[2px] border-dashed" style={{ borderColor: ink, opacity: 0.35 }} />
          <span className="text-[11px] font-black uppercase tracking-wider" style={{ opacity: 0.6 }}>
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((m, i) => (
            <button
              key={m.src}
              onClick={() => setLightbox(i)}
              className="group relative aspect-square overflow-hidden rounded-2xl border-[2.5px] transition-transform hover:-translate-y-1"
              style={{
                background: paperAlt,
                borderColor: ink,
                boxShadow: `4px 4px 0 0 ${ink}`,
                transform: `rotate(${i % 2 === 0 ? -0.5 : 0.5}deg)`,
              }}
            >
              {m.type === "video" ? (
                <video src={mediaUrl(m.src)} muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                <img
                  src={mediaUrl(m.src)}
                  alt={m.name}
                  loading="lazy"
                  className={`h-full w-full ${m.png ? "object-contain p-2" : "object-cover"}`}
                />
              )}
              <div
                className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2 py-1.5 text-[9.5px] font-black uppercase tracking-wider text-white"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
              >
                <span
                  className="inline-flex items-center rounded-md border px-1 py-[1px]"
                  style={{ background: m.type === "video" ? "#a855f7" : "#f26522", borderColor: "#0d1117" }}
                >
                  {m.type === "video" ? <Film className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
                </span>
                <span className="truncate flex-1">{m.name}</span>
              </div>
            </button>
          ))}
        </div>
      </main>

      {lightbox !== null && items[lightbox] && (
        <Lightbox
          item={items[lightbox]}
          index={lightbox}
          total={items.length}
          ink={ink}
          paper={paperAlt}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((i) => (i === null ? i : (i - 1 + items.length) % items.length))}
          onNext={() => setLightbox((i) => (i === null ? i : (i + 1) % items.length))}
        />
      )}

      <UILayer />
    </div>
  );
}

function Lightbox({
  item,
  index,
  total,
  ink,
  paper,
  onClose,
  onPrev,
  onNext,
}: {
  item: { src: string; name: string; type: "image" | "video"; category: string };
  index: number;
  total: number;
  ink: string;
  paper: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      {/* Prev / Next */}
      {total > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border-2 p-2 text-white"
            style={{ borderColor: "#fff", background: "rgba(0,0,0,0.4)" }}
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border-2 p-2 text-white"
            style={{ borderColor: "#fff", background: "rgba(0,0,0,0.4)" }}
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div
        className="relative w-full max-w-4xl rounded-3xl border-[2.5px] overflow-hidden"
        style={{ background: paper, color: ink, borderColor: ink, boxShadow: `8px 8px 0 0 ${ink}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-[2.5px] px-5 py-3" style={{ borderColor: ink }}>
          <div className="min-w-0">
            <p className="text-[11px] opacity-70 font-medium uppercase tracking-wider">{item.category}</p>
            <p className="text-[12px] font-bold truncate">{item.name} · {index + 1} / {total}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={mediaUrl(item.src)} download className="rounded-full border-2 p-1.5" style={{ borderColor: ink, color: ink }} title="Download">
              <Download className="h-4 w-4" />
            </a>
            <button onClick={onClose} className="rounded-full border-2 p-1.5" style={{ borderColor: ink, color: ink }}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center bg-black" style={{ maxHeight: "80vh" }}>
          {item.type === "video" ? (
            <video src={mediaUrl(item.src)} controls autoPlay preload="metadata" className="max-h-[80vh] w-full" />
          ) : (
            <img src={mediaUrl(item.src)} alt={item.name} className="max-h-[80vh] w-full object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}
