"use client";

import { useCallback, useRef, useState } from "react";
import { X, Scissors, Plus, Play, Pause, Trash2, Download } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useTimelinePlayer } from "@/lib/timeline-player";
import { TimelineExportDialog } from "./timeline-export-dialog";

type DragKind = "start" | "end" | "reorder" | null;

const PIXELS_PER_SECOND = 40;
const MIN_CLIP_WIDTH = 24;

export function TimelinePanel() {
  const isTimelineOpen = useAppStore((s) => s.isTimelineOpen);
  const setTimelineOpen = useAppStore((s) => s.setTimelineOpen);
  const timeline = useAppStore((s) => s.timeline);
  const items = useAppStore((s) => s.items);
  const addTimelineClip = useAppStore((s) => s.addTimelineClip);
  const updateTimelineClip = useAppStore((s) => s.updateTimelineClip);
  const removeTimelineClip = useAppStore((s) => s.removeTimelineClip);
  const reorderTimelineClip = useAppStore((s) => s.reorderTimelineClip);
  const splitTimelineClip = useAppStore((s) => s.splitTimelineClip);
  const undoTimeline = useAppStore((s) => s.undoTimeline);
  const redoTimeline = useAppStore((s) => s.redoTimeline);
  const theme = useAppStore((s) => s.theme);

  const videoElA = useRef<HTMLVideoElement>(null);
  const videoElB = useRef<HTMLVideoElement>(null);
  const player = useTimelinePlayer(videoElA, videoElB);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DragKind>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragClipIdRef = useRef<string | null>(null);

  const dark = theme === "dark";
  const panelBg = dark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-200";
  const subText = dark ? "text-gray-400" : "text-gray-500";
  const hoverBg = dark ? "hover:bg-white/10" : "hover:bg-black/5";

  const fmt = useCallback((s: number) => {
    const total = Math.max(0, s);
    const m = Math.floor(total / 60);
    const sec = total - m * 60;
    return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
  }, []);

  const eligibleVideos = items.filter((i) => i.type === "video" && (i.outputUrl || i.src));

  const handleAddClip = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    // Probe duration client-side via a throwaway video element before adding,
    // so trimOut defaults to the full source instead of a 5s guess.
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = item.outputUrl || item.src;
    probe.onloadedmetadata = () => {
      addTimelineClip(itemId, { trimIn: 0, trimOut: probe.duration || undefined, sourceDurationSec: probe.duration });
    };
    probe.onerror = () => {
      addTimelineClip(itemId, {});
    };
    setAddMenuOpen(false);
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

  // Resolve a drag x-position into a target `order` value, interpolated between
  // the two neighboring clips (excluding the one being dragged) so reordering
  // never collides with an existing order value.
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

  if (!isTimelineOpen) return null;

  const clips = timeline?.clips ? [...timeline.clips].sort((a, b) => a.order - b.order) : [];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[150] border-t ${panelBg} shadow-[0_-8px_24px_rgba(0,0,0,0.25)]`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/30">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Timeline</span>
          <span className={`text-[10px] ${subText}`}>{fmt(player.totalDuration)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => (player.isPlaying ? player.pause() : player.play())}
            disabled={clips.length === 0}
            className={`rounded-md p-1.5 ${hoverBg} disabled:opacity-40`}
            title={player.isPlaying ? "Pause" : "Play"}
          >
            {player.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={undoTimeline}
            className={`rounded-md px-2 py-1 text-[10px] ${hoverBg}`}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redoTimeline}
            className={`rounded-md px-2 py-1 text-[10px] ${hoverBg}`}
          >
            Redo
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddMenuOpen((v) => !v)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${hoverBg}`}
            >
              <Plus className="h-3 w-3" /> Add clip
            </button>
            {addMenuOpen && (
              <div className={`absolute bottom-full right-0 mb-1 w-56 max-h-64 overflow-y-auto rounded-lg border ${panelBg} shadow-lg`}>
                {eligibleVideos.length === 0 && (
                  <div className={`px-3 py-2 text-[11px] ${subText}`}>No video clips on this board yet.</div>
                )}
                {eligibleVideos.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddClip(item.id)}
                    className={`block w-full truncate px-3 py-1.5 text-left text-[11px] ${hoverBg}`}
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
            className="flex items-center gap-1 rounded-md bg-[#f26522] hover:bg-[#d9541a] px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> Export
          </button>
          <button type="button" onClick={() => setTimelineOpen(false)} className={`rounded-md p-1.5 ${hoverBg}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center justify-center bg-black py-2">
        <div className="relative h-40 max-w-full aspect-video bg-black">
          <video ref={videoElA} className={`absolute inset-0 h-full w-full object-contain ${player.activeSlot === 0 ? "opacity-100" : "opacity-0"}`} playsInline muted={false} />
          <video ref={videoElB} className={`absolute inset-0 h-full w-full object-contain ${player.activeSlot === 1 ? "opacity-100" : "opacity-0"}`} playsInline muted={false} />
          {clips.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-500">
              Add a clip to preview
            </div>
          )}
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onPointerMove={onTrackPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative h-20 overflow-x-auto px-2 py-2 select-none"
        style={{ touchAction: "none" }}
      >
        <div className="relative h-full" style={{ width: Math.max(200, player.totalDuration * PIXELS_PER_SECOND) }}>
          {clips.length === 0 && (
            <div className={`flex h-full items-center justify-center text-[11px] ${subText}`}>
              Empty timeline. Click &ldquo;Add clip&rdquo; to sequence a video.
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
                  className={`absolute top-1 bottom-1 rounded-md border-2 cursor-grab active:cursor-grabbing overflow-hidden ${
                    isSelected ? "border-[#f26522]" : "border-white/20"
                  } bg-[#1c2128]`}
                  style={{ left, width }}
                  title={item?.fileName || item?.prompt || clip.itemId}
                >
                  <div className="truncate px-1.5 py-1 text-[9px] text-white/80">
                    {item?.fileName || item?.prompt?.slice(0, 20) || "clip"}
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

          {/* Playhead */}
          {clips.length > 0 && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]"
              style={{ left: player.currentTime * PIXELS_PER_SECOND }}
            />
          )}
        </div>
      </div>

      {exportOpen && <TimelineExportDialog onClose={() => setExportOpen(false)} />}
    </div>
  );
}
