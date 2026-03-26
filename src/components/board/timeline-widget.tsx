"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Film, Download, Play, Pause, Plus, Trash2, GripVertical } from "lucide-react";
import { useAppStore, type TimelineClip } from "@/lib/store";

export function TimelineWidget() {
  const { isTimelineOpen, setTimelineOpen, timelineClips, items, removeTimelineClip, reorderTimelineClips, updateTimelineClip, theme } = useAppStore();
  const isDark = theme === "dark";
  const [exporting, setExporting] = useState(false);
  const [playheadPos, setPlayheadPos] = useState(0); // pixels
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewIsVideo, setPreviewIsVideo] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Trim drag state
  const [trimming, setTrimming] = useState<{ clipId: string; edge: "left" | "right"; startX: number; startVal: number } | null>(null);

  const PX_PER_SEC = 60;

  if (!isTimelineOpen) return null;

  const getItem = (clip: TimelineClip) => items.find((i) => i.id === clip.itemId);
  const getThumb = (clip: TimelineClip) => { const it = getItem(clip); return it ? (it.outputUrl || it.src) : null; };
  const isVideoClip = (clip: TimelineClip) => { const it = getItem(clip); return it?.type === "video" || (it?.type === "generation" && it?.outputType === "video"); };
  const clipDuration = (clip: TimelineClip) => { const end = clip.trimEnd > 0 ? clip.trimEnd : clip.duration; return Math.max(0.2, end - clip.trimStart); };
  const totalDuration = timelineClips.reduce((s, c) => s + clipDuration(c), 0);
  const totalWidth = totalDuration * PX_PER_SEC;

  // Update preview when playhead moves or clips change
  const updatePreview = useCallback((px: number) => {
    let accum = 0;
    for (const clip of timelineClips) {
      const dur = clipDuration(clip);
      const clipStart = accum * PX_PER_SEC;
      const clipEnd = (accum + dur) * PX_PER_SEC;
      if (px >= clipStart && px < clipEnd) {
        const thumb = getThumb(clip);
        if (thumb) {
          setPreviewSrc(thumb);
          setPreviewIsVideo(isVideoClip(clip));
        }
        return;
      }
      accum += dur;
    }
  }, [timelineClips, items]);

  // Click on track to move playhead
  const handleTrackClick = (e: React.MouseEvent) => {
    if (trimming) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + (trackRef.current?.scrollLeft || 0);
    setPlayheadPos(Math.max(0, Math.min(x, totalWidth)));
    updatePreview(x);
  };

  // Trim handle drag
  const handleTrimStart = (e: React.MouseEvent, clipId: string, edge: "left" | "right") => {
    e.stopPropagation();
    e.preventDefault();
    const clip = timelineClips.find((c) => c.id === clipId);
    if (!clip) return;
    setTrimming({
      clipId,
      edge,
      startX: e.clientX,
      startVal: edge === "left" ? clip.trimStart : (clip.trimEnd > 0 ? clip.trimEnd : clip.duration),
    });
  };

  useEffect(() => {
    if (!trimming) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - trimming.startX;
      const dtSec = dx / PX_PER_SEC;
      const clip = timelineClips.find((c) => c.id === trimming.clipId);
      if (!clip) return;

      if (trimming.edge === "left") {
        const newStart = Math.max(0, Math.min(clip.duration - 0.2, trimming.startVal + dtSec));
        updateTimelineClip(clip.id, { trimStart: Math.round(newStart * 10) / 10 });
      } else {
        const newEnd = Math.max(clip.trimStart + 0.2, Math.min(clip.duration, trimming.startVal + dtSec));
        updateTimelineClip(clip.id, { trimEnd: Math.round(newEnd * 10) / 10 });
      }
    };
    const handleUp = () => setTrimming(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [trimming, timelineClips, updateTimelineClip]);

  // Drag reorder
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const arr = [...timelineClips];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    reorderTimelineClips(arr);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // Export as MP4 (WebM with vp9 — browser native, widely compatible)
  const handleExport = async () => {
    if (timelineClips.length === 0) return;
    setExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm; codecs=vp9", videoBitsPerSecond: 8000000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      recorder.start();

      for (const clip of timelineClips) {
        const item = getItem(clip);
        if (!item) continue;
        const url = item.outputUrl || item.src;
        const dur = clipDuration(clip);

        if (isVideoClip(clip)) {
          await new Promise<void>((resolve) => {
            const vid = document.createElement("video");
            vid.crossOrigin = "anonymous"; vid.muted = true; vid.playsInline = true; vid.src = url;
            vid.currentTime = clip.trimStart;
            vid.onloadeddata = () => {
              vid.play();
              const draw = () => {
                if (vid.currentTime >= (clip.trimEnd > 0 ? clip.trimEnd : vid.duration) || vid.ended) { vid.pause(); resolve(); return; }
                const sc = Math.min(canvas.width / vid.videoWidth, canvas.height / vid.videoHeight);
                const w = vid.videoWidth * sc, h = vid.videoHeight * sc;
                ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(vid, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                requestAnimationFrame(draw);
              };
              draw();
            };
            vid.onerror = () => resolve();
          });
        } else {
          await new Promise<void>((resolve) => {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const t0 = performance.now();
              const draw = () => {
                if ((performance.now() - t0) / 1000 >= dur) { resolve(); return; }
                const sc = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
                const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
                ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                requestAnimationFrame(draw);
              };
              draw();
            };
            img.onerror = () => resolve();
            img.src = url;
          });
        }
      }

      recorder.stop();
      await done;
      const blob = new Blob(chunks, { type: "video/mp4" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `motionboards-export-${Date.now()}.mp4`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Some media may have CORS restrictions.");
    } finally {
      setExporting(false);
    }
  };

  // Timecode markers
  const markers = [];
  for (let t = 0; t <= Math.ceil(totalDuration); t++) {
    markers.push(t);
  }

  return (
    <div
      className="absolute left-0 right-0 bottom-10 z-[55]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={`border-t ${isDark ? "border-gray-700 bg-[#0d1117]" : "border-gray-200 bg-[#1a1a2e]"}`}>

        {/* Preview + controls bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10">
          {/* Preview thumbnail */}
          <div className="w-24 h-14 rounded overflow-hidden bg-black/50 flex items-center justify-center shrink-0">
            {previewSrc ? (
              previewIsVideo ? (
                <video ref={previewVideoRef} src={previewSrc} className="h-full w-full object-contain" muted playsInline />
              ) : (
                <img src={previewSrc} alt="" className="h-full w-full object-contain" />
              )
            ) : (
              <Film className="h-4 w-4 text-gray-500" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400 font-medium">
              {timelineClips.length} clip{timelineClips.length !== 1 ? "s" : ""} &middot; {totalDuration.toFixed(1)}s
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              className="flex items-center gap-1 px-2.5 py-1 bg-[#f26522] text-white text-[10px] font-bold rounded-md hover:bg-[#d9541a] transition-colors disabled:opacity-40"
              onClick={handleExport}
              disabled={exporting || timelineClips.length === 0}
            >
              {exporting ? (
                <><div className="h-2.5 w-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Exporting...</>
              ) : (
                <><Download className="h-3 w-3" /> Export MP4</>
              )}
            </button>
            <button
              className="p-1 text-gray-500 hover:text-white transition-colors"
              onClick={() => setTimelineOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Timecode ruler */}
        <div className="relative overflow-x-auto" ref={trackRef} onClick={handleTrackClick}>
          <div className="relative" style={{ width: Math.max(totalWidth, 600), minHeight: 16 }}>
            <div className="flex border-b border-white/5 h-4">
              {markers.map((t) => (
                <div key={t} className="shrink-0 border-l border-white/10 relative" style={{ width: PX_PER_SEC }}>
                  <span className="absolute top-0 left-1 text-[8px] text-gray-500 font-mono leading-none">{t}s</span>
                </div>
              ))}
            </div>

            {/* Track area */}
            <div className="relative" style={{ minHeight: 56 }}>
              {/* Dotted guide lines */}
              <div className="absolute inset-0 border-t border-b border-dashed border-white/10" style={{ top: 4, bottom: 4 }} />

              {/* Clips */}
              {timelineClips.length === 0 ? (
                <div className="flex items-center justify-center h-14 text-gray-500">
                  <Film className="h-4 w-4 mr-2 opacity-50" />
                  <span className="text-[11px]">Drag material here and start to create</span>
                </div>
              ) : (
                <div className="flex h-14 items-center">
                  {timelineClips.map((clip, idx) => {
                    const dur = clipDuration(clip);
                    const w = dur * PX_PER_SEC;
                    const thumb = getThumb(clip);
                    const isVid = isVideoClip(clip);
                    const item = getItem(clip);

                    return (
                      <div
                        key={clip.id}
                        className={`relative h-12 rounded-sm overflow-hidden shrink-0 group cursor-grab active:cursor-grabbing transition-all ${
                          dragOverIdx === idx ? "ring-2 ring-[#f26522]" : ""
                        }`}
                        style={{ width: w, marginRight: 2 }}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={() => handleDrop(idx)}
                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (thumb) { setPreviewSrc(thumb); setPreviewIsVideo(isVid); }
                        }}
                      >
                        {/* Clip background — thumbnail strip */}
                        <div className="absolute inset-0">
                          {thumb ? (
                            <div className="flex h-full">
                              {Array.from({ length: Math.max(1, Math.ceil(w / 48)) }, (_, i) => (
                                <div key={i} className="h-full shrink-0 overflow-hidden" style={{ width: 48 }}>
                                  {isVid ? (
                                    <video src={thumb} className="h-full w-full object-cover opacity-70" muted playsInline preload="metadata" />
                                  ) : (
                                    <img src={thumb} alt="" className="h-full w-full object-cover opacity-70" draggable={false} />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-full w-full bg-gray-700" />
                          )}
                        </div>

                        {/* Color tint overlay */}
                        <div className={`absolute inset-0 ${isVid ? "bg-blue-500/20" : "bg-green-500/20"}`} />

                        {/* Top bar with name */}
                        <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-1 py-0.5 bg-black/50">
                          <span className="text-[7px] text-white font-medium truncate">
                            {item?.fileName || item?.modelName || (isVid ? "Video" : "Image")}
                          </span>
                          <span className="text-[7px] text-white/50 ml-auto shrink-0">{dur.toFixed(1)}s</span>
                        </div>

                        {/* Left trim handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize bg-white/0 hover:bg-white/30 transition-colors z-10 flex items-center justify-center"
                          onMouseDown={(e) => handleTrimStart(e, clip.id, "left")}
                        >
                          <div className="w-0.5 h-6 bg-white/60 rounded-full" />
                        </div>

                        {/* Right trim handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize bg-white/0 hover:bg-white/30 transition-colors z-10 flex items-center justify-center"
                          onMouseDown={(e) => handleTrimStart(e, clip.id, "right")}
                        >
                          <div className="w-0.5 h-6 bg-white/60 rounded-full" />
                        </div>

                        {/* Delete button */}
                        <button
                          className="absolute top-0.5 right-2.5 bg-red-500/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                          onClick={(e) => { e.stopPropagation(); removeTimelineClip(clip.id); }}
                        >
                          <X className="h-2 w-2" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-px bg-white z-30 pointer-events-none"
                style={{ left: playheadPos }}
              >
                <div className="absolute -top-1 -left-1.5 w-3 h-2 bg-white rounded-b-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom scroll bar indicator */}
        <div className="h-1 bg-[#f26522]/30 relative">
          <div
            className="h-full bg-[#f26522] rounded-full"
            style={{ width: `${Math.min(100, (600 / Math.max(totalWidth, 600)) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
