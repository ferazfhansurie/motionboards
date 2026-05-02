"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Play, Loader2, Music, X, AlertCircle, Pencil, Layers, Download, Trash2, AlignLeft, AlignCenter, AlignRight, Bold, Italic, ZoomIn, ImageIcon, VideoIcon, SparklesIcon, LayersIcon, Copy, Check, ClipboardPaste, Flag, Target, Share2, FolderPlus, Star } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { BoardItem } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { CropOverlay } from "./crop-overlay";
import { askShareToCommunity, pickFolder, showToast, updateToast } from "@/lib/ui-store";
import { useInViewport } from "@/lib/use-in-viewport";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const STAGES = [
  { key: "queued", label: "Queued", icon: "queue" },
  { key: "processing", label: "Processing", icon: "process" },
  { key: "generating", label: "Generating", icon: "generate" },
  { key: "complete", label: "Complete", icon: "done" },
];

function getStageIndex(text?: string): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  if (t.includes("complete") || t.includes("done") || t.includes("finish")) return 3;
  if (t.includes("generat") || t.includes("render") || t.includes("creat")) return 2;
  if (t.includes("process") || t.includes("running") || t.includes("started")) return 1;
  return 0;
}

function GeneratingProgress({ item, isDark }: { item: BoardItem; isDark: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  useEffect(() => {
    const start = new Date(item.createdAt).getTime();
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [item.createdAt]);

  const stageIdx = getStageIndex(item.progressText);
  const displayText = item.progressText || "Queued...";

  const handleCancel = () => {
    useAppStore.getState().updateItem(item.id, {
      status: "failed",
      error: "Cancelled by user",
    });
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4" style={{ height: item.height }}>
      <Loader2 className="h-5 w-5 animate-spin text-[#f26522]" />

      {/* Stage dots */}
      <div className="flex items-center gap-1 w-full max-w-[200px]">
        {STAGES.slice(0, 3).map((stage, i) => (
          <div key={stage.key} className="flex items-center flex-1">
            <div className={`h-2 w-2 rounded-full shrink-0 transition-colors ${
              i < stageIdx ? "bg-[#f26522]"
              : i === stageIdx ? "bg-[#f26522] animate-pulse"
              : isDark ? "bg-gray-700" : "bg-gray-300"
            }`} />
            {i < 2 && (
              <div className={`flex-1 h-0.5 mx-0.5 transition-colors ${
                i < stageIdx ? "bg-[#f26522]" : isDark ? "bg-gray-700" : "bg-gray-300"
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Stage labels */}
      <div className="flex justify-between w-full max-w-[200px]">
        {STAGES.slice(0, 3).map((stage, i) => (
          <span key={stage.key} className={`text-[7px] font-semibold uppercase tracking-wider ${
            i <= stageIdx ? "text-[#f26522]" : isDark ? "text-gray-600" : "text-gray-400"
          }`}>
            {stage.label}
          </span>
        ))}
      </div>

      {/* Current status + elapsed */}
      <div className="text-center">
        <p className={`text-[10px] font-medium ${isDark ? "text-gray-300" : "text-gray-600"}`}>
          {displayText}
        </p>
        <p className={`text-[9px] mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          {formatTime(elapsed)} elapsed
        </p>
      </div>

      {/* Cancel button — shows after 30s, two-step confirm to prevent misclicks */}
      {elapsed > 30 && !confirmingCancel && (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmingCancel(true); }}
          className={`text-[9px] px-3 py-1 rounded-lg transition-colors ${isDark ? "text-gray-500 hover:text-red-400 hover:bg-red-500/10" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}
        >
          Cancel
        </button>
      )}
      {elapsed > 30 && confirmingCancel && (
        <div className="flex flex-col items-center gap-1.5">
          <p className={`text-[9px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>Cancel this generation?</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); handleCancel(); }}
              className="text-[9px] px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors font-semibold"
            >
              Confirm
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmingCancel(false); }}
              className={`text-[9px] px-3 py-1 rounded-lg transition-colors ${isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-500 hover:bg-gray-100"}`}
            >
              Abort
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyablePrompt({ prompt, isDark }: { prompt: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Rough estimate — anything beyond ~4 lines (~280 chars) gets the toggle.
  // Below the threshold we hide the toggle entirely so short prompts stay
  // visually clean.
  const isLong = prompt.length > 280;
  return (
    <div
      className={`mt-1 group/prompt relative cursor-pointer rounded px-1 -mx-1 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
      title="Click to copy prompt"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <p
        className={`text-[11px] leading-relaxed pr-5 whitespace-pre-wrap ${expanded ? "" : "line-clamp-4"} ${isDark ? "text-gray-400" : "text-gray-600"}`}
      >
        {prompt}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className={`mt-0.5 text-[10px] font-semibold transition-colors ${isDark ? "text-gray-500 hover:text-[#f26522]" : "text-gray-400 hover:text-[#f26522]"}`}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
      <div className={`absolute top-0.5 right-0.5 transition-opacity ${copied ? "opacity-100" : "opacity-0 group-hover/prompt:opacity-100"}`}>
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className={`h-3 w-3 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
        )}
      </div>
    </div>
  );
}

// Global cache of loaded image URLs — survives component remounts
const loadedImageCache = new Set<string>();

// Inline player for uploaded / dropped video items on the canvas. Same UX
// as GeneratedVideo: click to play with native controls + audio; click again
// to pause. Mousedown is swallowed during playback so timeline scrub doesn't
// trigger the canvas item drag.
function UploadedVideoPreview({ src, height }: { src: string; height?: number }) {
  const [playing, setPlaying] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Defer metadata load until the card is on/near the viewport. With many
  // videos on a canvas, simultaneous metadata fetches saturate the browser's
  // per-host connection cap and visible videos starve.
  const inView = useInViewport(wrapRef, "600px");

  // iOS Safari is lazy about loading video metadata — explicit .load() kicks
  // it off, and after metadata arrives we seek a hair past zero to force the
  // first frame to actually paint (Safari otherwise leaves the element black
  // until the user hits play).
  useEffect(() => {
    if (!inView) return;
    try { videoRef.current?.load(); } catch { /* ignore */ }
  }, [src, inView]);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    try { if (v.currentTime === 0) v.currentTime = 0.001; } catch { /* ignore */ }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.muted = false;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  return (
    <div ref={wrapRef} className="relative bg-black/5" style={{ height }}>
      {inView && (
        <video
          ref={videoRef}
          src={src}
          className="h-full w-full object-cover"
          muted={!playing}
          loop
          playsInline
          controls={playing}
          preload="metadata"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={onLoadedMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onMouseDown={(e) => { if (playing) e.stopPropagation(); }}
        />
      )}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 rounded-full bg-black/70 hover:bg-black/90 active:bg-black transition-colors p-1.5 z-[2]"
          aria-label="Play video"
          title="Play"
        >
          <Play className="h-3 w-3 text-white" fill="white" />
        </button>
      )}
    </div>
  );
}

function GeneratedVideo({ item }: { item: BoardItem }) {
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [errored, setErrored] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Lazy: don't even mount the <video> element until the card is in/near
  // viewport. With 4+ generated videos on a canvas all racing for browser
  // connection slots, off-screen ones starve the visible ones — this was
  // exactly what the user saw as "loading is sooo slow." 600px margin so
  // they're ready by the time scroll catches up.
  const inView = useInViewport(wrapRef, "600px");

  // iOS Safari needs an explicit .load() to start metadata fetch, plus a
  // tiny seek (currentTime = 0.001) AFTER metadata arrives to actually
  // paint the first frame — without the seek the element stays black even
  // though metadata is loaded. 1.5s safety timer (was 4s) so a stalled
  // metadata fetch shows the play button quickly instead of perpetual
  // spinner; the video can still play once it eventually finishes loading.
  useEffect(() => {
    if (!inView) return;
    setLoaded(false);
    setErrored(false);
    const v = videoRef.current;
    if (!v) return;
    try { v.load(); } catch { /* ignore */ }
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, [item.outputUrl, inView]);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    try { if (v.currentTime === 0) v.currentTime = 0.001; } catch { /* ignore */ }
    setLoaded(true);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.muted = false;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative bg-black/5"
      style={{ minHeight: item.height || 120 }}
    >
      {!loaded && !errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-[1] pointer-events-none">
          <Loader2 className="h-5 w-5 text-[#f26522] animate-spin" />
        </div>
      )}
      {errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-[1] p-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-[10px] text-red-400 text-center">Video failed to load</p>
          <button
            className="text-[10px] text-[#f26522] active:opacity-50"
            onClick={(e) => { e.stopPropagation(); setErrored(false); setLoaded(false); videoRef.current?.load(); }}
          >Retry</button>
        </div>
      )}
      {inView && (
        <video
          ref={videoRef}
          src={item.outputUrl}
          className="w-full block"
          muted={!playing}
          loop
          playsInline
          controls={playing}
          preload="metadata"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={onLoadedMetadata}
          onLoadedData={() => setLoaded(true)}
          onCanPlay={() => setLoaded(true)}
          onError={() => setErrored(true)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onMouseDown={(e) => { if (playing) e.stopPropagation(); }}
        />
      )}
      {loaded && !errored && !playing && (
        <button
          type="button"
          onClick={togglePlay}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 rounded-full bg-black/70 hover:bg-black/90 active:bg-black transition-colors p-1.5 z-[2]"
          aria-label="Play video"
          title="Play"
        >
          <Play className="h-3 w-3 text-white" fill="white" />
        </button>
      )}
    </div>
  );
}

const IMG_RETRY_DELAYS = [2000, 4000, 8000, 16000, 30000, 60000, 60000, 60000];

function GeneratedImage({ item, onDoubleClick }: { item: BoardItem; onDoubleClick: () => void }) {
  const url = item.outputUrl || "";
  const alreadyCached = loadedImageCache.has(url);
  const [imgState, setImgState] = useState<"loading" | "loaded" | "error">(alreadyCached ? "loaded" : "loading");
  const [retrySrc, setRetrySrc] = useState(url);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state only when outputUrl changes to a genuinely different URL
  const prevUrlRef = useRef(url);
  useEffect(() => {
    if (url !== prevUrlRef.current) {
      prevUrlRef.current = url;
      retryCountRef.current = 0;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      setRetrySrc(url);
      setImgState(loadedImageCache.has(url) ? "loaded" : "loading");
    }
  }, [url]);

  useEffect(() => () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); }, []);

  return (
    <div className="relative" style={{ minHeight: imgState === "loaded" ? undefined : item.height || 120 }}>
      {/* Loading spinner overlay — shown while image is downloading */}
      {imgState === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-[1]">
          <Loader2 className="h-5 w-5 text-[#f26522] animate-spin" />
          <p className="text-[10px] text-gray-400">Loading image...</p>
        </div>
      )}

      {/* Error state */}
      {imgState === "error" && (
        <div className="flex flex-col items-center justify-center gap-2 p-4" style={{ minHeight: 80 }}>
          <ImageIcon className="h-5 w-5 text-gray-400" />
          <p className="text-[10px] text-gray-400 text-center">Image failed to display</p>
          <button
            className="text-[10px] text-[#f26522] hover:underline"
            onClick={(e) => { e.stopPropagation(); retryCountRef.current = 0; setImgState("loading"); setRetrySrc(item.outputUrl + "?t=" + Date.now()); }}
          >
            Retry
          </button>
          <a
            href={item.outputUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open original in new tab
          </a>
        </div>
      )}

      {/* The actual image — always in DOM so it can load, hidden only on error.
          No native loading="lazy": parent canvas already culls offscreen items,
          and inside a CSS-transformed container mobile Safari misjudges
          visibility and never fires onLoad. */}
      <img
        src={retrySrc}
        alt=""
        decoding="async"
        className={`w-full block pointer-events-none ${imgState === "error" ? "hidden" : imgState === "loaded" ? "" : "opacity-0"}`}
        draggable={false}
        onLoad={(e) => {
          setImgState("loaded");
          if (url) loadedImageCache.add(url);
          const img = e.target as HTMLImageElement;
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const maxW = 250;
            const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
            const expectedH = Math.round(img.naturalHeight * scale);
            if (Math.abs((item.height || 0) - expectedH) > 10) {
              useAppStore.getState().updateItem(item.id, { width: Math.round(img.naturalWidth * scale), height: expectedH });
            }
          }
        }}
        onError={() => {
          const attempt = retryCountRef.current;
          if (attempt < IMG_RETRY_DELAYS.length) {
            retryCountRef.current = attempt + 1;
            retryTimerRef.current = setTimeout(
              () => setRetrySrc(item.outputUrl + "?t=" + Date.now()),
              IMG_RETRY_DELAYS[attempt]
            );
          } else {
            setImgState("error");
          }
        }}
      />

      {/* Zoom button */}
      {imgState === "loaded" && (
        <button
          className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
          title="Zoom preview"
        >
          <ZoomIn className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

interface BoardItemCardProps {
  item: BoardItem;
  isSelected: boolean;
  isConnecting?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
  onResizeStart: (e: React.PointerEvent, edge: string) => void;
}

export function BoardItemCard({
  item,
  isSelected,
  isConnecting,
  onPointerDown,
  onDoubleClick,
  onResizeStart,
}: BoardItemCardProps) {
  const { startFrameId, endFrameId, inputRefs, audioInputId, isEditMode, setEditMode, selectItem, theme, autoEditItemId, setAutoEditItemId } = useAppStore();
  const isDark = theme === "dark";

  const isStartFrame = startFrameId === item.id;
  const isEndFrame = endFrameId === item.id;
  const isInputRef = inputRefs.includes(item.id);
  const inputIndex = inputRefs.indexOf(item.id);
  const isAudioRef = audioInputId === item.id;

  // Text editing state
  const [isEditingText, setIsEditingText] = useState(false);
  const [editTextValue, setEditTextValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-enter edit mode for freshly placed text items (flagged via store).
  useEffect(() => {
    if (item.type !== "text") return;
    if (autoEditItemId !== item.id) return;
    setEditTextValue(item.text || "");
    setIsEditingText(true);
    setAutoEditItemId(null);
  }, [autoEditItemId, item.id, item.type, item.text, setAutoEditItemId]);

  // While editing, grow the textarea + the box height to fit the content
  // BEFORE the next paint so a paste of long text doesn't flash outside the
  // box. useLayoutEffect runs synchronously after DOM mutations.
  useLayoutEffect(() => {
    if (!isEditingText) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const contentH = ta.scrollHeight;
    ta.style.height = `${contentH}px`;
    const targetH = Math.max(48, contentH + 16); // p-2 padding (8px top + 8px bottom)
    if (Math.abs((item.height || 0) - targetH) > 1) {
      useAppStore.getState().updateItem(item.id, { height: targetH });
    }
  }, [editTextValue, isEditingText, item.id, item.height, item.fontSize, item.fontFamily, item.width]);

  // Build CSS filter string from editState
  const filterStyle = item.editState
    ? {
        filter: `brightness(${item.editState.brightness}%) contrast(${item.editState.contrast}%) saturate(${item.editState.saturate}%) hue-rotate(${item.editState.hueRotate}deg)`,
      }
    : {};

  // Crop clipping via clip-path
  const cropStyle =
    item.editState && (item.editState.cropW < 1 || item.editState.cropH < 1 || item.editState.cropX > 0 || item.editState.cropY > 0)
      ? {
          clipPath: `inset(${item.editState.cropY * 100}% ${(1 - item.editState.cropX - item.editState.cropW) * 100}% ${(1 - item.editState.cropY - item.editState.cropH) * 100}% ${item.editState.cropX * 100}%)`,
        }
      : {};

  const isImageType = item.type === "image" || item.type === "psd-layer";
  const isMediaType = isImageType || item.type === "video" || (item.type === "generation" && item.outputUrl);
  const isResizable = item.type === "image" || item.type === "video" || item.type === "generation" || item.type === "psd-layer" || item.type === "text" || item.type === "drawing";

  // Right-click / long-press context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPosRef = useRef({ clientX: 0, clientY: 0 });
  const longPressFiredRef = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };
  useEffect(() => cancelLongPress, []);

  const openContextMenuAt = (clientX: number, clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    selectItem(item.id);
    setContextMenu({ x: clientX - rect.left, y: clientY - rect.top });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (longPressFiredRef.current) return; // already shown via long-press
    openContextMenuAt(e.clientX, e.clientY, e.currentTarget as HTMLElement);
  };

  const closeContextMenu = () => setContextMenu(null);

  // Close context menu on any pointer down anywhere (covers mouse + touch)
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [contextMenu]);

  const handleItemPointerDown = (e: React.PointerEvent) => {
    longPressFiredRef.current = false;
    longPressPosRef.current = { clientX: e.clientX, clientY: e.clientY };
    cancelLongPress();
    const el = e.currentTarget as HTMLElement;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      openContextMenuAt(longPressPosRef.current.clientX, longPressPosRef.current.clientY, el);
    }, 500);
    onPointerDown(e);
  };

  const handleItemPointerMove = (e: React.PointerEvent) => {
    const dx = e.clientX - longPressPosRef.current.clientX;
    const dy = e.clientY - longPressPosRef.current.clientY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelLongPress();
  };

  const handleDownload = async () => {
    closeContextMenu();
    const url = item.outputUrl || item.src;
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      // Prefer the real content-type from the blob (most reliable), then fall
      // back to the item's media kind. Generation cards have item.type ===
      // "generation" with the actual media in outputType.
      const isVideo = blob.type.startsWith("video/") || item.type === "video" || item.outputType === "video";
      const isAudio = blob.type.startsWith("audio/") || item.type === "audio" || item.outputType === "audio";
      const ext = isVideo ? "mp4" : isAudio ? "mp3" : "png";
      a.download = item.fileName || `motionboards-${item.id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
    }
  };

  const handleDoubleClick = () => {
    if (item.type === "text") {
      setEditTextValue(item.text || "");
      setIsEditingText(true);
    } else {
      onDoubleClick();
    }
  };

  return (
    <div
      className="absolute select-none group"
      onContextMenu={handleContextMenu}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        // While editing a text item, use minHeight so the outer div can grow
        // with the content (paste of long text would otherwise spill below
        // the stale item.height before the height-grow effect runs). Once
        // editing ends, item.height has been live-updated to match content
        // so the locked height is correct.
        ...(item.type === "text"
          ? (isEditingText ? { minHeight: item.height } : { height: item.height })
          : {}),
        zIndex: isSelected ? 50 : 1,
        WebkitTouchCallout: "none", // suppress iOS native long-press callout
      }}
      onPointerDown={handleItemPointerDown}
      onPointerMove={handleItemPointerMove}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onDoubleClick={handleDoubleClick}
    >
      {/* Text formatting toolbar — shown when text item is selected */}
      {item.type === "text" && isSelected && (
        <div
          className={`absolute left-0 right-0 z-20 flex flex-wrap items-center gap-1 px-1.5 py-1 rounded-lg border shadow-lg ${isDark ? "bg-[#1c2128] border-gray-700" : "bg-white border-gray-200"}`}
          style={{ bottom: "calc(100% + 8px)" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Style presets */}
          {[
            { label: "H1", size: 36, weight: "bold", family: "Inter, sans-serif" },
            { label: "H2", size: 28, weight: "bold", family: "Inter, sans-serif" },
            { label: "H3", size: 22, weight: "600", family: "Inter, sans-serif" },
            { label: "Body", size: 16, weight: "normal", family: "Inter, sans-serif" },
            { label: "Small", size: 12, weight: "normal", family: "Inter, sans-serif" },
          ].map((preset) => (
            <button
              key={preset.label}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                item.fontSize === preset.size && item.fontWeight === preset.weight
                  ? "bg-[#f26522] text-white"
                  : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => useAppStore.getState().updateItem(item.id, { fontSize: preset.size, fontWeight: preset.weight, fontFamily: preset.family })}
            >
              {preset.label}
            </button>
          ))}

          <div className={`w-px h-4 mx-0.5 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />

          {/* Font family */}
          <select
            value={item.fontFamily || "Inter, sans-serif"}
            onChange={(e) => useAppStore.getState().updateItem(item.id, { fontFamily: e.target.value })}
            className={`text-[9px] rounded px-1 py-0.5 border max-w-[80px] ${isDark ? "bg-[#0d1117] text-white border-gray-700" : "bg-white text-gray-700 border-gray-200"}`}
          >
            <option value="Inter, sans-serif">Inter</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Times New Roman', serif">Times</option>
            <option value="'Courier New', monospace">Courier</option>
            <option value="Verdana, sans-serif">Verdana</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
            <option value="Impact, sans-serif">Impact</option>
            <option value="'Comic Sans MS', cursive">Comic Sans</option>
          </select>

          {/* Font size */}
          <select
            value={item.fontSize || 16}
            onChange={(e) => useAppStore.getState().updateItem(item.id, { fontSize: Number(e.target.value) })}
            className={`text-[9px] rounded px-1 py-0.5 border w-[42px] ${isDark ? "bg-[#0d1117] text-white border-gray-700" : "bg-white text-gray-700 border-gray-200"}`}
          >
            {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className={`w-px h-4 mx-0.5 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />

          {/* Bold */}
          <button
            className={`p-0.5 rounded transition-colors ${
              item.fontWeight === "bold" || item.fontWeight === "700"
                ? "bg-[#f26522]/20 text-[#f26522]"
                : isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"
            }`}
            onClick={() => useAppStore.getState().updateItem(item.id, { fontWeight: item.fontWeight === "bold" ? "normal" : "bold" })}
          >
            <Bold className="h-3 w-3" />
          </button>

          {/* Italic */}
          <button
            className={`p-0.5 rounded transition-colors ${
              item.fontStyle === "italic"
                ? "bg-[#f26522]/20 text-[#f26522]"
                : isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"
            }`}
            onClick={() => useAppStore.getState().updateItem(item.id, { fontStyle: item.fontStyle === "italic" ? "normal" : "italic" })}
          >
            <Italic className="h-3 w-3" />
          </button>

          <div className={`w-px h-4 mx-0.5 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />

          {/* Alignment */}
          <button
            className={`p-0.5 rounded transition-colors ${item.textAlign === "left" || !item.textAlign ? "bg-[#f26522]/20 text-[#f26522]" : isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"}`}
            onClick={() => useAppStore.getState().updateItem(item.id, { textAlign: "left" })}
          >
            <AlignLeft className="h-3 w-3" />
          </button>
          <button
            className={`p-0.5 rounded transition-colors ${item.textAlign === "center" ? "bg-[#f26522]/20 text-[#f26522]" : isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"}`}
            onClick={() => useAppStore.getState().updateItem(item.id, { textAlign: "center" })}
          >
            <AlignCenter className="h-3 w-3" />
          </button>
          <button
            className={`p-0.5 rounded transition-colors ${item.textAlign === "right" ? "bg-[#f26522]/20 text-[#f26522]" : isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"}`}
            onClick={() => useAppStore.getState().updateItem(item.id, { textAlign: "right" })}
          >
            <AlignRight className="h-3 w-3" />
          </button>

          <div className={`w-px h-4 mx-0.5 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />

          {/* Text color */}
          <input
            type="color"
            value={item.fontColor || (isDark ? "#ffffff" : "#000000")}
            onChange={(e) => useAppStore.getState().updateItem(item.id, { fontColor: e.target.value })}
            className="w-5 h-5 rounded cursor-pointer border-0 p-0"
            title="Text color"
          />

          {/* Background color */}
          <div className="relative">
            <input
              type="color"
              value={item.backgroundColor && item.backgroundColor !== "transparent" ? item.backgroundColor : "#ffffff"}
              onChange={(e) => useAppStore.getState().updateItem(item.id, { backgroundColor: e.target.value })}
              className="w-5 h-5 rounded cursor-pointer border-0 p-0 opacity-60"
              title="Background color"
            />
            {item.backgroundColor && item.backgroundColor !== "transparent" && (
              <button
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-2.5 h-2.5 flex items-center justify-center text-[6px] leading-none"
                onClick={() => useAppStore.getState().updateItem(item.id, { backgroundColor: "transparent" })}
                title="Remove background"
              >
                x
              </button>
            )}
          </div>
        </div>
      )}

      {/* Smart X button — clears reference role if any, otherwise deletes the item */}
      {isSelected && (() => {
        const hasRole = isStartFrame || isEndFrame || isInputRef || isAudioRef;
        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          const store = useAppStore.getState();
          if (isStartFrame) store.setStartFrame(null);
          else if (isEndFrame) store.setEndFrame(null);
          else if (isInputRef) store.toggleInputRef(item.id);
          else if (isAudioRef) store.setAudioInput(null);
          else store.removeItem(item.id);
        };
        const tooltip = isStartFrame ? "Clear start frame" : isEndFrame ? "Clear end frame" : isInputRef ? "Remove as input" : isAudioRef ? "Remove as audio" : "Delete from canvas";
        return (
          <button
            type="button"
            onClick={handleClick}
            onMouseDown={(e) => e.stopPropagation()}
            title={tooltip}
            className={`absolute -top-2 -right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-colors ${
              hasRole
                ? "bg-[#f26522] text-white border-[#f26522] hover:bg-[#d9541a]"
                : isDark
                ? "bg-[#161b22] text-gray-400 border-gray-700 hover:bg-red-500 hover:text-white hover:border-red-500"
                : "bg-white text-gray-400 border-gray-300 hover:bg-red-500 hover:text-white hover:border-red-500"
            }`}
          >
            <X className="h-3 w-3" />
          </button>
        );
      })()}

      {/* Reference badges */}
      <div className={`absolute left-0 z-10 flex gap-1 ${item.type === "text" && isSelected ? "-top-[72px]" : "-top-7"}`}>
        {isStartFrame && (
          <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0 border-0">
            START FRAME
          </Badge>
        )}
        {isEndFrame && (
          <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0 border-0">
            END FRAME
          </Badge>
        )}
        {isInputRef && (
          <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 flex items-center gap-1 border-0">
            <span className="inline-block h-2 w-2 rounded-sm bg-yellow-400" />
            INPUT {inputIndex + 1}
          </Badge>
        )}
        {isAudioRef && (
          <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0 flex items-center gap-1 border-0">
            <Music className="h-2.5 w-2.5" />
            AUDIO
          </Badge>
        )}
        {item.type === "psd-layer" && (
          <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 flex items-center gap-1 border-0">
            <Layers className="h-2.5 w-2.5" />
            PSD
          </Badge>
        )}
        {item.starred && (
          <Badge className="bg-amber-400 text-amber-900 text-[10px] px-1.5 py-0 flex items-center gap-1 border-0">
            <Star className="h-2.5 w-2.5" fill="currentColor" />
            STARRED
          </Badge>
        )}
      </div>

      {/* Quick-toggle star button in the top-right corner. Always visible on
          starred items, fades in on hover for unstarred ones so it doesn't
          clutter the canvas. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); useAppStore.getState().toggleStar(item.id); }}
        title={item.starred ? "Unstar" : "Star"}
        className={`absolute top-1 right-1 z-[5] rounded-md p-1 transition-all ${
          item.starred
            ? "bg-amber-400/90 text-amber-900 opacity-100"
            : "bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60"
        }`}
      >
        <Star className="h-3 w-3" fill={item.starred ? "currentColor" : "none"} />
      </button>

      {/* Card */}
      <div
        className={`relative rounded-lg border-2 transition-all ${
          isConnecting
            ? "border-[#f26522] shadow-[0_0_20px_rgba(242,101,34,0.5)] ring-2 ring-[#f26522]/30"
            : isSelected
            ? "border-[#f26522] shadow-[0_0_15px_rgba(242,101,34,0.3)]"
            : isAudioRef
            ? "border-purple-500/70"
            : isStartFrame || isEndFrame || isInputRef
            ? "border-emerald-500/70"
            : isDark
            ? "border-gray-700 hover:border-gray-600 shadow-sm hover:shadow-md"
            : "border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md"
        } ${item.type === "text" || item.type === "drawing" ? "bg-transparent border-dashed" : isDark ? "bg-[#161b22]" : "bg-white"}`}
      >
        {/* Media wrapper with overflow hidden */}
        <div className="overflow-hidden rounded-md relative">
        {/* Media content */}
        {(item.type === "image" || item.type === "psd-layer") && (
          <>
            <img
              src={item.outputUrl || item.src}
              alt={item.fileName || item.psdLayerName || "Image"}
              loading="lazy"
              decoding="async"
              className="w-full pointer-events-none block"
              style={{ ...filterStyle, ...cropStyle }}
              draggable={false}
            />
            {/* Zoom button on hover */}
            <button
              className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
              title="Zoom preview"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </>
        )}

        {item.type === "video" && (
          <UploadedVideoPreview src={item.outputUrl || item.src} height={item.height} />
        )}

        {item.type === "audio" && (
          <div
            className="flex items-center gap-3 p-4"
            style={{ height: item.height }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f26522]/20">
              <Music className="h-5 w-5 text-[#f26522]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`truncate text-xs font-medium ${isDark ? "text-white" : "text-gray-700"}`}>
                {item.fileName || "Audio"}
              </p>
              <p className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>Audio file</p>
            </div>
          </div>
        )}

        {/* Text item */}
        {item.type === "text" && (
          <div
            className="p-2 w-full outline-none"
            style={{
              minHeight: 30,
              fontSize: item.fontSize || 16,
              fontFamily: item.fontFamily || "Inter, sans-serif",
              color: item.fontColor || (isDark ? "#ffffff" : "#000000"),
              fontWeight: (item.fontWeight as React.CSSProperties["fontWeight"]) || "normal",
              fontStyle: item.fontStyle || "normal",
              textAlign: item.textAlign || "left",
              backgroundColor: item.backgroundColor || "transparent",
              lineHeight: 1.4,
            }}
          >
            {isEditingText ? (
              <textarea
                ref={textareaRef}
                className="outline-none cursor-text w-full bg-transparent resize-none border-none p-0 m-0 overflow-hidden placeholder:opacity-40"
                style={{
                  fontSize: "inherit",
                  fontFamily: "inherit",
                  color: "inherit",
                  fontWeight: "inherit",
                  fontStyle: "inherit",
                  textAlign: item.textAlign || "left",
                  lineHeight: "inherit",
                  minHeight: 30,
                }}
                placeholder="Type something…"
                value={editTextValue}
                // Save on every keystroke so the text is never lost if blur
                // races with anything (formatting toolbar click, canvas
                // deselect, autosave re-render). Empty-text deletion is
                // still gated to blur/Escape.
                onChange={(e) => {
                  const v = e.target.value;
                  setEditTextValue(v);
                  useAppStore.getState().updateItem(item.id, { text: v });
                }}
                onBlur={() => {
                  if (!editTextValue.trim()) {
                    useAppStore.getState().removeItem(item.id);
                  }
                  setIsEditingText(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    if (!editTextValue.trim()) {
                      useAppStore.getState().removeItem(item.id);
                    }
                    setIsEditingText(false);
                  }
                  e.stopPropagation();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="whitespace-pre-wrap" style={{ minHeight: Math.max(20, item.height - 16), display: "block" }}>{item.text || ""}</span>
            )}
          </div>
        )}

        {/* Drawing item */}
        {item.type === "drawing" && (
          <svg width={item.width} height={item.height} className="pointer-events-none">
            <path
              d={item.drawingPaths || ""}
              fill="none"
              stroke={item.strokeColor || (isDark ? "#ffffff" : "#000000")}
              strokeWidth={item.strokeWidth || 3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {item.type === "generation" && (
          <>
            {item.status === "processing" ? (
              <GeneratingProgress item={item} isDark={isDark} />
            ) : item.status === "failed" ? (
              <div className="flex flex-col items-center justify-center gap-2 p-3" style={{ height: item.height }}>
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="text-[10px] text-red-400 text-center line-clamp-3">
                  {item.error || "Failed"}
                </p>
              </div>
            ) : item.outputUrl ? (
              item.outputType === "video" ? (
                <GeneratedVideo item={item} />
              ) : item.outputType === "audio" ? (
                <div className="flex items-center justify-center p-4" style={{ height: item.height }}>
                  <audio src={item.outputUrl} controls className="w-full" />
                </div>
              ) : (
                <GeneratedImage item={item} onDoubleClick={onDoubleClick} />
              )
            ) : (
              <div className="flex items-center justify-center" style={{ height: item.height }}>
                <p className="text-xs text-gray-400">Ready to generate</p>
              </div>
            )}
          </>
        )}

        </div>{/* end media wrapper */}

        {/* Crop overlay */}
        {isImageType && isSelected && (
          <CropOverlay item={item} />
        )}

        {/* Resize handles — edges and corners. Pointer events fire on
            both touch (iPad / phone) and mouse. On touch screens the
            handles are always shown (no hover state) and the corner
            handles are larger (h-7 w-7) to be finger-hittable.
            touch-none disables the browser's native pan gesture so
            the resize drag actually works. */}
        {isResizable && (
          <>
            {/* Right edge */}
            <div
              className={`absolute top-2 bottom-2 right-0 w-3 sm:w-2 cursor-ew-resize touch-none transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 sm:opacity-0"}`}
              onPointerDown={(e) => onResizeStart(e, "e")}
            />
            {/* Bottom edge */}
            <div
              className={`absolute left-2 right-2 bottom-0 h-3 sm:h-2 cursor-ns-resize touch-none transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 sm:opacity-0"}`}
              onPointerDown={(e) => onResizeStart(e, "s")}
            />
            {/* Left edge */}
            <div
              className={`absolute top-2 bottom-2 left-0 w-3 sm:w-2 cursor-ew-resize touch-none transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 sm:opacity-0"}`}
              onPointerDown={(e) => onResizeStart(e, "w")}
            />
            {/* Top edge */}
            <div
              className={`absolute left-2 right-2 top-0 h-3 sm:h-2 cursor-ns-resize touch-none transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 sm:opacity-0"}`}
              onPointerDown={(e) => onResizeStart(e, "n")}
            />
            {/* Bottom-right corner — larger and always visible when
                selected so it's an obvious touch target on phones. */}
            <div
              className={`absolute bottom-0 right-0 h-7 w-7 sm:h-4 sm:w-4 cursor-nwse-resize touch-none flex items-end justify-end p-0.5 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 sm:opacity-0"}`}
              onPointerDown={(e) => onResizeStart(e, "se")}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" className="text-gray-400">
                <path d="M14 14L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M14 14L14 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            {/* Bottom-left corner */}
            <div
              className={`absolute bottom-0 left-0 h-7 w-7 sm:h-4 sm:w-4 cursor-nesw-resize touch-none transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 sm:opacity-0"}`}
              onPointerDown={(e) => onResizeStart(e, "sw")}
            />
            {/* Top-right corner */}
            <div
              className={`absolute top-0 right-0 h-7 w-7 sm:h-4 sm:w-4 cursor-nesw-resize touch-none transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 sm:opacity-0"}`}
              onPointerDown={(e) => onResizeStart(e, "ne")}
            />
            {/* Top-left corner */}
            <div
              className={`absolute top-0 left-0 h-7 w-7 sm:h-4 sm:w-4 cursor-nwse-resize touch-none transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 sm:opacity-0"}`}
              onPointerDown={(e) => onResizeStart(e, "nw")}
            />
          </>
        )}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }} />
          <div
            className={`absolute z-[101] rounded-xl border shadow-xl py-1 min-w-[160px] overflow-hidden ${isDark ? "bg-[#161b22] border-gray-700" : "bg-white border-gray-200"}`}
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {isMediaType && (
              <button
                type="button"
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-50"}`}
                onClick={handleDownload}
              >
                <Download className="h-3.5 w-3.5 text-gray-400" />
                Download
              </button>
            )}
            {isImageType && (
              <button
                type="button"
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-50"}`}
                onClick={() => { closeContextMenu(); selectItem(item.id); setEditMode(true); }}
              >
                <Pencil className="h-3.5 w-3.5 text-gray-400" />
                Edit
              </button>
            )}
            {isMediaType && (
              <button
                type="button"
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-50"}`}
                onClick={async () => {
                  closeContextMenu();
                  const mediaUrl = item.outputUrl || item.src;
                  const mediaType: "image" | "video" =
                    item.type === "video" || item.outputType === "video" ? "video" : "image";
                  if (!mediaUrl) return;
                  const defaultTitle = item.prompt
                    ? item.prompt.slice(0, 80)
                    : item.fileName || "";
                  const payload = await askShareToCommunity({
                    mediaType,
                    defaultTitle,
                    defaultBody: item.prompt || "",
                  });
                  if (!payload) return;
                  const toastId = showToast("Sharing to community…", { kind: "loading" });
                  try {
                    const res = await fetch("/api/community/posts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: payload.title,
                        body: payload.body,
                        category: payload.category,
                        mediaUrl,
                        mediaType,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      updateToast(toastId, { kind: "error", message: data.error || "Failed to share. Are you signed in?" });
                    } else {
                      updateToast(toastId, { kind: "success", message: "Shared to community." });
                    }
                  } catch {
                    updateToast(toastId, { kind: "error", message: "Network error." });
                  }
                }}
              >
                <Share2 className="h-3.5 w-3.5 text-gray-400" />
                Share to Community
              </button>
            )}
            {isMediaType && (
              <button
                type="button"
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-50"}`}
                onClick={async () => {
                  closeContextMenu();
                  const mediaUrl = item.outputUrl || item.src;
                  const mediaType: "image" | "video" =
                    item.type === "video" || item.outputType === "video" ? "video" : "image";
                  if (!mediaUrl) return;
                  const folderId = await pickFolder();
                  if (!folderId) return;
                  const toastId = showToast("Saving to folder…", { kind: "loading" });
                  try {
                    const res = await fetch(`/api/folders/${folderId}/items`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        mediaUrl,
                        mediaType,
                        fileName: item.fileName || item.prompt || "Untitled",
                      }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      updateToast(toastId, { kind: "error", message: err.error || "Failed to save." });
                    } else {
                      updateToast(toastId, { kind: "success", message: "Saved to folder." });
                      useAppStore.getState().setFoldersOpen(true);
                    }
                  } catch {
                    updateToast(toastId, { kind: "error", message: "Network error." });
                  }
                }}
              >
                <FolderPlus className="h-3.5 w-3.5 text-gray-400" />
                Save to Folder
              </button>
            )}

            {/* Reference frame toggles — for image-like items */}
            {isImageType || (item.type === "generation" && item.outputType === "image") ? (
              <>
                <div className={`h-px my-0.5 ${isDark ? "bg-gray-700" : "bg-gray-100"}`} />
                <button
                  type="button"
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-50"}`}
                  onClick={() => {
                    closeContextMenu();
                    const store = useAppStore.getState();
                    store.setStartFrame(isStartFrame ? null : item.id);
                  }}
                >
                  <Flag className={`h-3.5 w-3.5 ${isStartFrame ? "text-[#f26522]" : "text-gray-400"}`} />
                  {isStartFrame ? "Clear Start Frame" : "Set as Start Frame"}
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-50"}`}
                  onClick={() => {
                    closeContextMenu();
                    const store = useAppStore.getState();
                    store.setEndFrame(isEndFrame ? null : item.id);
                  }}
                >
                  <Flag className={`h-3.5 w-3.5 ${isEndFrame ? "text-[#f26522]" : "text-gray-400"}`} />
                  {isEndFrame ? "Clear End Frame" : "Set as End Frame"}
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-50"}`}
                  onClick={() => { closeContextMenu(); useAppStore.getState().toggleInputRef(item.id); }}
                >
                  <Target className={`h-3.5 w-3.5 ${isInputRef ? "text-[#f26522]" : "text-gray-400"}`} />
                  {isInputRef ? "Remove as Input" : "Set as Input"}
                </button>
              </>
            ) : null}

            <button
              type="button"
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-50"}`}
              onClick={() => { closeContextMenu(); useAppStore.getState().toggleStar(item.id); }}
            >
              <Star className={`h-3.5 w-3.5 ${item.starred ? "text-amber-400" : "text-gray-400"}`} fill={item.starred ? "currentColor" : "none"} />
              {item.starred ? "Unstar" : "Star"}
            </button>

            {/* Copy / Paste */}
            <div className={`h-px my-0.5 ${isDark ? "bg-gray-700" : "bg-gray-100"}`} />
            <button
              type="button"
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-50"}`}
              onClick={() => {
                closeContextMenu();
                selectItem(item.id);
                useAppStore.getState().copySelectedItems();

                // Also write the actual image bytes to the OS clipboard so it
                // can be pasted into the chat (or any other app).
                const url = item.outputUrl || item.src;
                const isImage = item.type === "image" || item.type === "psd-layer" ||
                  (item.type === "generation" && item.outputType !== "video" && item.outputType !== "audio");
                if (!url || !isImage) {
                  showToast(`Copied ${item.type} (no image to clipboard)`, { kind: "info" });
                  return;
                }
                if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
                  showToast("Clipboard API not supported on this browser", { kind: "error" });
                  return;
                }
                showToast(`Copying… url=${url.slice(0, 40)}`, { kind: "loading", durationMs: 2000 });
                try {
                  // Safari needs ClipboardItem created synchronously with a Promise<Blob>
                  const ci = new ClipboardItem({
                    "image/png": fetch(url).then(async (res) => {
                      const blob = await res.blob();
                      if (blob.type === "image/png") return blob;
                      // Convert to PNG via canvas
                      const objectUrl = URL.createObjectURL(blob);
                      const img = new Image();
                      img.crossOrigin = "anonymous";
                      await new Promise<void>((resolve, reject) => {
                        img.onload = () => resolve();
                        img.onerror = () => reject(new Error("img load failed"));
                        img.src = objectUrl;
                      });
                      const canvas = document.createElement("canvas");
                      canvas.width = img.naturalWidth;
                      canvas.height = img.naturalHeight;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) throw new Error("no canvas ctx");
                      ctx.drawImage(img, 0, 0);
                      URL.revokeObjectURL(objectUrl);
                      return new Promise<Blob>((resolve, reject) =>
                        canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob null")), "image/png")
                      );
                    }),
                  });
                  navigator.clipboard.write([ci])
                    .then(() => showToast("Image in clipboard ✓ now paste in chat", { kind: "success" }))
                    .catch((err) => showToast(`Clipboard write failed: ${err.message || err}`, { kind: "error" }));
                } catch (err) {
                  showToast(`ClipboardItem failed: ${err instanceof Error ? err.message : err}`, { kind: "error" });
                }
              }}
            >
              <Copy className="h-3.5 w-3.5 text-gray-400" />
              Copy
            </button>
            <button
              type="button"
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-50"}`}
              onClick={() => { closeContextMenu(); useAppStore.getState().pasteItems(item.x + 30, item.y + 30); }}
            >
              <ClipboardPaste className="h-3.5 w-3.5 text-gray-400" />
              Paste
            </button>

            <div className={`h-px my-0.5 ${isDark ? "bg-gray-700" : "bg-gray-100"}`} />
            <button
              type="button"
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
              onClick={() => { closeContextMenu(); useAppStore.getState().removeItem(item.id); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Info below card */}
      <div className="mt-2 px-0.5">
        {item.psdLayerName && (
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider truncate">
            {item.psdLayerName}
          </p>
        )}
        {item.modelName && (
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-bold tracking-wide ${isDark ? "text-gray-200" : "text-[#0d1117]"}`}>
              {item.modelName}
            </span>
            {item.cost && (
              <span className="text-[9px] font-semibold text-[#f26522] bg-[#f26522]/10 px-1.5 py-0.5 rounded-full">
                {item.cost}
              </span>
            )}
          </div>
        )}
        {item.prompt && (
          <CopyablePrompt prompt={item.prompt} isDark={isDark} />
        )}
        {!item.modelName && item.cost && (
          <div className="mt-1 inline-flex rounded bg-emerald-500/20 px-1.5 py-0.5">
            <span className="text-[10px] font-medium text-emerald-400">
              {item.cost}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
