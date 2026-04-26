"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  X,
  Download,
  Trash2,
  Image as ImageIcon,
  Film,
  Music,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { askConfirm, showToast, updateToast } from "@/lib/ui-store";
import { UILayer } from "@/components/ui/ui-layer";

interface MediaFile {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

function mediaKind(mime: string): "image" | "video" | "audio" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "other";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Group files by day so the grid reads as a timeline.
function groupByDay(files: MediaFile[]): { day: string; files: MediaFile[] }[] {
  const buckets = new Map<string, MediaFile[]>();
  for (const f of files) {
    const d = new Date(f.createdAt);
    const key = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(f);
  }
  return Array.from(buckets.entries()).map(([day, files]) => ({ day, files }));
}

export default function MediaLibraryPage() {
  const { theme } = useAppStore();
  const isDark = theme === "dark";

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [active, setActive] = useState<MediaFile | null>(null);

  const ink = isDark ? "#f4ece0" : "#0d1117";
  const paper = isDark ? "#14100c" : "#fdf6ec";
  const paperAlt = isDark ? "#1c1712" : "#fff8ec";

  async function load(opts: { reset?: boolean } = {}) {
    const reset = opts.reset !== false;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "40");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (!reset && nextCursor) params.set("before", nextCursor);
      const res = await fetch(`/api/media?${params.toString()}`).then((r) => r.json());
      const incoming: MediaFile[] = Array.isArray(res?.files) ? res.files : [];
      setFiles((prev) => (reset ? incoming : [...prev, ...incoming]));
      setNextCursor(res?.nextCursor || null);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // First load + reload whenever the date range changes.
  useEffect(() => {
    load({ reset: true });

  }, [from, to]);

  async function removeFile(f: MediaFile) {
    const ok = await askConfirm({
      title: "Delete this file?",
      message: "It will be permanently removed from your library.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const toastId = showToast("Deleting…", { kind: "loading" });
    const res = await fetch(`/api/media?id=${encodeURIComponent(f.id)}`, { method: "DELETE" });
    if (res.ok) {
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
      if (active?.id === f.id) setActive(null);
      updateToast(toastId, { kind: "success", message: "Deleted." });
    } else {
      updateToast(toastId, { kind: "error", message: "Delete failed." });
    }
  }

  const groups = groupByDay(files);

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
      <header
        className="sticky top-0 z-20 border-b-[2.5px]"
        style={{ borderColor: ink, background: paperAlt }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/generate" className="flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.12em] hover:text-[#f26522]">
            <ArrowLeft className="h-4 w-4" /> Back to canvas
          </Link>
          <div className="text-[13px] font-black uppercase tracking-[0.2em]">Media · Library</div>
          <div className="text-[12px] font-bold opacity-70">{files.length} loaded</div>
        </div>
      </header>

      {/* Masthead + date range */}
      <section className="relative mx-auto max-w-6xl px-5 pt-8 pb-4">
        <div className="relative inline-block">
          <span className="text-[13px] opacity-70 font-medium">Every file you've made</span>
          <h1 className="mt-1 font-black uppercase leading-[0.92] tracking-tight" style={{ fontSize: "clamp(2.6rem, 7vw, 4.5rem)" }}>
            Your library
          </h1>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <DateField label="From" value={from} onChange={setFrom} ink={ink} paper={paperAlt} />
          <DateField label="To" value={to} onChange={setTo} ink={ink} paper={paperAlt} />
          {(from || to) && (
            <button
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="rounded-full border-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider"
              style={{ borderColor: ink, color: ink, background: "transparent" }}
            >
              Clear range
            </button>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => {
                  const now = new Date();
                  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
                  setFrom(past.toISOString().slice(0, 10));
                  setTo(now.toISOString().slice(0, 10));
                }}
                className="rounded-full border-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-transform hover:-translate-y-0.5"
                style={{
                  borderColor: ink,
                  background: paperAlt,
                  color: ink,
                  boxShadow: `2px 2px 0 0 ${ink}`,
                }}
              >
                Last {days} days
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <main className="relative mx-auto max-w-6xl px-5 pb-20">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-[#f26522]" />
          </div>
        ) : files.length === 0 ? (
          <div
            className="rounded-3xl border p-10 text-center"
            style={{ borderColor: ink, background: paperAlt }}
          >
            <h3 className="font-black mt-2" style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)" }}>
              Nothing in this range.
            </h3>
            <p className="mt-2 text-[13px]" style={{ opacity: 0.75 }}>
              Try a wider date window, or head back to the canvas and make something.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(({ day, files }) => (
              <div key={day}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-black" style={{ fontSize: "1.1rem" }}>
                    {day}
                  </h3>
                  <span className="flex-1 border-t-[2px] border-dashed" style={{ borderColor: ink, opacity: 0.35 }} />
                  <span className="text-[11px] font-black uppercase tracking-wider" style={{ opacity: 0.6 }}>
                    {files.length} file{files.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {files.map((f, i) => (
                    <MediaTile
                      key={f.id}
                      file={f}
                      ink={ink}
                      paper={paperAlt}
                      tilt={i % 2 === 0 ? -0.5 : 0.5}
                      onClick={() => setActive(f)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {nextCursor && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => load({ reset: false })}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-full border-[2.5px] px-5 py-2.5 text-[12px] font-black uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
                  style={{ background: "#f26522", borderColor: ink, boxShadow: `4px 4px 0 0 ${ink}` }}
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Load more
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {active && (
        <PreviewModal
          file={active}
          ink={ink}
          paper={paperAlt}
          onClose={() => setActive(null)}
          onDelete={() => removeFile(active)}
        />
      )}

      <UILayer />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  ink,
  paper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ink: string;
  paper: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.15em]" style={{ opacity: 0.7 }}>
        <Calendar className="h-3 w-3" /> {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border-[2.5px] px-3 py-2 text-[13px] font-bold outline-none"
        style={{
          background: paper,
          color: ink,
          borderColor: ink,
          boxShadow: `2px 2px 0 0 ${ink}`,
          colorScheme: "dark",
        }}
      />
    </label>
  );
}

function MediaTile({
  file,
  ink,
  paper,
  tilt,
  onClick,
}: {
  file: MediaFile;
  ink: string;
  paper: string;
  tilt: number;
  onClick: () => void;
}) {
  const kind = mediaKind(file.mimeType);
  const src = `/api/files/${file.id}`;
  return (
    <button
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-2xl border-[2.5px] transition-transform hover:-translate-y-1"
      style={{
        background: paper,
        borderColor: ink,
        boxShadow: `4px 4px 0 0 ${ink}`,
        transform: `rotate(${tilt}deg)`,
      }}
    >
      {kind === "image" ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : kind === "video" ? (
        <video
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : kind === "audio" ? (
        <div className="flex h-full w-full items-center justify-center" style={{ background: "#f26522" }}>
          <Music className="h-8 w-8 text-white" />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-bold" style={{ background: paper }}>
          {file.mimeType.split("/")[1] || "file"}
        </div>
      )}

      <div
        className="absolute inset-x-0 bottom-0 px-2 py-1.5 flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-white"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
      >
        <KindBadge kind={kind} />
        <span className="truncate flex-1">{formatDate(file.createdAt)}</span>
        <span className="opacity-70">{formatSize(file.sizeBytes)}</span>
      </div>
    </button>
  );
}

function KindBadge({ kind }: { kind: "image" | "video" | "audio" | "other" }) {
  const Icon =
    kind === "video" ? Film : kind === "audio" ? Music : kind === "image" ? ImageIcon : ImageIcon;
  const bg = kind === "video" ? "#a855f7" : kind === "audio" ? "#22c55e" : "#f26522";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px]"
      style={{ background: bg, borderColor: "#0d1117" }}
    >
      <Icon className="h-2.5 w-2.5" />
    </span>
  );
}

function PreviewModal({
  file,
  ink,
  paper,
  onClose,
  onDelete,
}: {
  file: MediaFile;
  ink: string;
  paper: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  const kind = mediaKind(file.mimeType);
  const src = `/api/files/${file.id}`;
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl border-[2.5px] overflow-hidden"
        style={{ background: paper, color: ink, borderColor: ink, boxShadow: `8px 8px 0 0 ${ink}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-[2.5px] px-5 py-3" style={{ borderColor: ink }}>
          <div>
            <p className="text-[11px] opacity-70 font-medium">{file.mimeType}</p>
            <p className="text-[12px] font-bold">{formatDate(file.createdAt)} · {formatSize(file.sizeBytes)}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={src}
              download
              className="rounded-full border-2 p-1.5"
              style={{ borderColor: ink, color: ink }}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={onDelete}
              className="rounded-full border-2 p-1.5"
              style={{ borderColor: ink, color: "#dc2626" }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-full border-2 p-1.5"
              style={{ borderColor: ink, color: ink }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center bg-black" style={{ maxHeight: "80vh" }}>
          {kind === "video" ? (
            <video src={src} controls preload="metadata" className="max-h-[80vh] w-full" />
          ) : kind === "audio" ? (
            <audio src={src} controls className="w-full p-8" />
          ) : kind === "image" ? (
            <img src={src} alt="" className="max-h-[80vh] w-full object-contain" />
          ) : (
            <a href={src} download className="p-8 text-white underline">
              Download {file.mimeType}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
