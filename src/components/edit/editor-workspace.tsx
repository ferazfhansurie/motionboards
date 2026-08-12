"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Scissors, Plus, Play, Pause, Trash2, Download, Upload, MessageSquare } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useTimelinePlayer } from "@/lib/timeline-player";
import { TimelineExportDialog } from "@/components/board/timeline-export-dialog";

type DragKind = "start" | "end" | "reorder" | null;

const PIXELS_PER_SECOND = 60;
const MIN_CLIP_WIDTH = 32;

// Dedicated full-page video editor — a different surface from the /generate
// freeform board: no canvas, no moodboard, just preview + timeline + chat.
// Reads/writes the same active board's timeline & items as /generate (via
// the shared store), so clips added here also show up back on the board.
export function EditorWorkspace() {
  const timeline = useAppStore((s) => s.timeline);
  const items = useAppStore((s) => s.items);
  const addItem = useAppStore((s) => s.addItem);
  const updateItem = useAppStore((s) => s.updateItem);
  const addTimelineClip = useAppStore((s) => s.addTimelineClip);
  const updateTimelineClip = useAppStore((s) => s.updateTimelineClip);
  const removeTimelineClip = useAppStore((s) => s.removeTimelineClip);
  const reorderTimelineClip = useAppStore((s) => s.reorderTimelineClip);
  const splitTimelineClip = useAppStore((s) => s.splitTimelineClip);
  const undoTimeline = useAppStore((s) => s.undoTimeline);
  const redoTimeline = useAppStore((s) => s.redoTimeline);
  const isAIPromptOpen = useAppStore((s) => s.isAIPromptOpen);
  const setAIPromptOpen = useAppStore((s) => s.setAIPromptOpen);

  // The chat panel is `fixed right-0` and dispatches its width on resize —
  // mirrors the same listener canvas.tsx uses so this page's content isn't
  // covered by the panel when it's open.
  const [aiPanelWidth, setAiPanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 640;
    const saved = window.localStorage.getItem("motionboards_ai_panel_width");
    const n = saved ? parseInt(saved, 10) : NaN;
    return !isNaN(n) ? n : 640;
  });
  useEffect(() => {
    const onWidth = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number") setAiPanelWidth(detail);
    };
    window.addEventListener("ai-panel-width", onWidth);
    return () => window.removeEventListener("ai-panel-width", onWidth);
  }, []);

  const videoElA = useRef<HTMLVideoElement>(null);
  const videoElB = useRef<HTMLVideoElement>(null);
  const player = useTimelinePlayer(videoElA, videoElB);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DragKind>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragClipIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fmt = useCallback((s: number) => {
    const total = Math.max(0, s);
    const m = Math.floor(total / 60);
    const sec = total - m * 60;
    return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
  }, []);

  const eligibleVideos = items.filter((i) => i.type === "video" && (i.outputUrl || i.src));

  const addClipFromItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = item.outputUrl || item.src;
    probe.onloadedmetadata = () => {
      addTimelineClip(itemId, { trimIn: 0, trimOut: probe.duration || undefined, sourceDurationSec: probe.duration });
    };
    probe.onerror = () => addTimelineClip(itemId, {});
    setAddMenuOpen(false);
  };

  const handleUploadFile = async (file: File) => {
    if (!file.type.startsWith("video/")) return;
    setUploading(true);
    const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const localUrl = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      addItem({
        id: itemId,
        type: "video",
        x: 0,
        y: 0,
        width: Math.round(vid.videoWidth || 320),
        height: Math.round(vid.videoHeight || 180),
        src: localUrl,
        fileName: file.name,
        createdAt: new Date().toISOString(),
      });
      addTimelineClip(itemId, { trimIn: 0, trimOut: vid.duration || undefined, sourceDurationSec: vid.duration });

      const formData = new FormData();
      formData.append("file", file);
      fetch("/api/upload", { method: "POST", body: formData })
        .then((r) => r.json())
        .then((data) => {
          if (data.url) {
            updateItem(itemId, { src: data.url });
            URL.revokeObjectURL(localUrl);
          }
        })
        .catch(() => {})
        .finally(() => setUploading(false));
    };
    vid.src = localUrl;
  };

  const onPointerDownClip = (clipId: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.dataset.handle) return;
    e.stopPropagation();
    setSelectedClipId(clipId);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragClipIdRef.current = clipId;
    setDragging("reorder");
  };

  const beginTrimDrag = (clipId: string, kind: "start" | "end") => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedClipId(clipId);
    dragClipIdRef.current = clipId;
    setDragging(kind);
  };

  const xToOrder = useCallback((clientX: number, draggedClipId: string): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !timeline) return 0;
    const sec = Math.max(0, (clientX - rect.left) / PIXELS_PER_SECOND);
    const others = timeline.clips.filter((c) => c.id !== draggedClipId).sort((a, b) => a.order - b.order);
    if (others.length === 0) return 0;
    let acc = 0;
    for (let i = 0; i < others.length; i++) {
      const dur = Math.max(0, others[i].trimOut - others[i].trimIn);
      if (sec < acc + dur / 2) {
        const prevOrder = i > 0 ? others[i - 1].order : others[i].order - 1;
        return (prevOrder + others[i].order) / 2;
      }
      acc += dur;
    }
    return others[others.length - 1].order + 1;
  }, [timeline]);

  const onTrackPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragClipIdRef.current) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sec = Math.max(0, (e.clientX - rect.left) / PIXELS_PER_SECOND);
    const clip = timeline?.clips.find((c) => c.id === dragClipIdRef.current);
    if (!clip) return;
    if (dragging === "start") {
      const next = Math.max(0, Math.min(sec, clip.trimOut - 0.1));
      updateTimelineClip(clip.id, { trimIn: next });
    } else if (dragging === "end") {
      const cap = clip.sourceDurationSec ?? clip.trimOut + 999;
      const next = Math.min(cap, Math.max(sec, clip.trimIn + 0.1));
      updateTimelineClip(clip.id, { trimOut: next });
    } else if (dragging === "reorder") {
      reorderTimelineClip(clip.id, xToOrder(e.clientX, clip.id));
    }
  }, [dragging, timeline, updateTimelineClip, reorderTimelineClip, xToOrder]);

  const endDrag = useCallback(() => {
    setDragging(null);
    dragClipIdRef.current = null;
  }, []);

  const clips = timeline?.clips ? [...timeline.clips].sort((a, b) => a.order - b.order) : [];

  return (
    <div
      className="flex h-[100dvh] flex-col bg-[#0a0c10] text-white"
      style={{ width: isAIPromptOpen ? `calc(100dvw - ${aiPanelWidth}px)` : "100dvw" }}
    >
      {/* Header — deliberately not the MotionBoards board chrome: no logo, no
          board switcher, no dotted canvas. This is a dedicated editor. */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-3">
          <Link href="/generate" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Boards
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-xs font-semibold tracking-wide text-white">AI Video Editor</span>
        </div>
        {!isAIPromptOpen && (
          <button
            type="button"
            onClick={() => setAIPromptOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-[#f26522] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#d9541a] transition-colors"
          >
            <MessageSquare className="h-3 w-3" /> Open chat
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Preview */}
          <div className="relative flex flex-1 min-h-0 items-center justify-center bg-black">
            <div className="relative h-full max-h-full w-full max-w-full aspect-video">
              <video ref={videoElA} className={`absolute inset-0 h-full w-full object-contain ${player.activeSlot === 0 ? "opacity-100" : "opacity-0"}`} playsInline />
              <video ref={videoElB} className={`absolute inset-0 h-full w-full object-contain ${player.activeSlot === 1 ? "opacity-100" : "opacity-0"}`} playsInline />
              {clips.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
                  <p className="text-sm">No clips yet</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload a video
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Transport bar */}
          <div className="flex h-10 shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-[#0d1117]">
            <button
              type="button"
              onClick={() => (player.isPlaying ? player.pause() : player.play())}
              disabled={clips.length === 0}
              className="rounded-full bg-white/10 p-1.5 hover:bg-white/20 disabled:opacity-40 transition-colors"
            >
              {player.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" fill="white" />}
            </button>
            <span className="font-mono text-[11px] text-gray-400">
              {fmt(player.currentTime)} / {fmt(player.totalDuration)}
            </span>
          </div>

          {/* Toolbar row */}
          <div className="flex h-11 shrink-0 items-center justify-between border-t border-white/10 bg-[#0d1117] px-3">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={undoTimeline} className="rounded-md px-2 py-1 text-[10px] text-gray-300 hover:bg-white/10">
                Undo
              </button>
              <button type="button" onClick={redoTimeline} className="rounded-md px-2 py-1 text-[10px] text-gray-300 hover:bg-white/10">
                Redo
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadFile(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-gray-300 hover:bg-white/10 disabled:opacity-50"
              >
                <Upload className="h-3 w-3" /> {uploading ? "Uploading…" : "Upload"}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAddMenuOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-gray-300 hover:bg-white/10"
                >
                  <Plus className="h-3 w-3" /> Add clip
                </button>
                {addMenuOpen && (
                  <div className="absolute bottom-full right-0 mb-1 w-56 max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-[#161b22] shadow-lg">
                    {eligibleVideos.length === 0 && (
                      <div className="px-3 py-2 text-[11px] text-gray-400">No video clips yet — upload one.</div>
                    )}
                    {eligibleVideos.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addClipFromItem(item.id)}
                        className="block w-full truncate px-3 py-1.5 text-left text-[11px] text-gray-200 hover:bg-white/10"
                      >
                        {item.fileName || item.prompt?.slice(0, 40) || item.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                disabled={clips.length === 0}
                className="flex items-center gap-1 rounded-md bg-[#f26522] hover:bg-[#d9541a] px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
              >
                <Download className="h-3 w-3" /> Export
              </button>
            </div>
          </div>

          {/* Track */}
          <div
            ref={trackRef}
            onPointerMove={onTrackPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="relative h-28 shrink-0 overflow-x-auto border-t border-white/10 bg-[#0a0c10] px-3 py-3 select-none"
            style={{ touchAction: "none" }}
          >
            <div className="relative h-full" style={{ width: Math.max(300, player.totalDuration * PIXELS_PER_SECOND) }}>
              {clips.length === 0 && (
                <div className="flex h-full items-center justify-center text-[11px] text-gray-500">
                  Empty timeline. Upload or add a clip to sequence a video.
                </div>
              )}
              {clips
                .reduce<{ clip: (typeof clips)[number]; duration: number; startOffset: number }[]>((acc, clip) => {
                  const duration = Math.max(0, clip.trimOut - clip.trimIn);
                  const prevEnd = acc.length > 0 ? acc[acc.length - 1].startOffset + acc[acc.length - 1].duration : 0;
                  return [...acc, { clip, duration, startOffset: prevEnd }];
                }, [])
                .map(({ clip, duration, startOffset }) => {
                  const left = startOffset * PIXELS_PER_SECOND;
                  const width = Math.max(MIN_CLIP_WIDTH, duration * PIXELS_PER_SECOND);
                  const item = items.find((i) => i.id === clip.itemId);
                  const isSelected = selectedClipId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      onPointerDown={onPointerDownClip(clip.id)}
                      className={`absolute top-0 bottom-0 rounded-md border-2 cursor-grab active:cursor-grabbing overflow-hidden ${
                        isSelected ? "border-[#f26522]" : "border-white/20"
                      } bg-[#1c2128]`}
                      style={{ left, width }}
                      title={item?.fileName || item?.prompt || clip.itemId}
                    >
                      <div className="truncate px-1.5 py-1 text-[10px] text-white/80">
                        {item?.fileName || item?.prompt?.slice(0, 24) || "clip"}
                      </div>
                      <div
                        data-handle="start"
                        onPointerDown={beginTrimDrag(clip.id, "start")}
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-[#f26522]/70 hover:bg-[#f26522]"
                      />
                      <div
                        data-handle="end"
                        onPointerDown={beginTrimDrag(clip.id, "end")}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-[#f26522]/70 hover:bg-[#f26522]"
                      />
                      {isSelected && (
                        <div className="absolute right-1 top-1 flex gap-1 z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const local = Math.max(0.05, player.currentTime - startOffset);
                              const newId = splitTimelineClip(clip.id, Math.min(duration - 0.05, local));
                              if (newId) setSelectedClipId(newId);
                            }}
                            className="rounded bg-black/60 p-0.5 hover:bg-black/80"
                            title="Split at playhead"
                          >
                            <Scissors className="h-2.5 w-2.5 text-white" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTimelineClip(clip.id);
                              setSelectedClipId(null);
                            }}
                            className="rounded bg-black/60 p-0.5 hover:bg-black/80"
                            title="Remove"
                          >
                            <Trash2 className="h-2.5 w-2.5 text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

              {clips.length > 0 && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]"
                  style={{ left: player.currentTime * PIXELS_PER_SECOND }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {exportOpen && <TimelineExportDialog onClose={() => setExportOpen(false)} />}
    </div>
  );
}
