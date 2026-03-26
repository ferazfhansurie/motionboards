"use client";

import { useState, useRef, useCallback } from "react";
import { X, GripVertical, Trash2, Film, Download, Play, Pause, ChevronUp, ChevronDown, Image, ZoomIn, ZoomOut } from "lucide-react";
import { useAppStore, type TimelineClip } from "@/lib/store";

export function TimelineWidget() {
  const { isTimelineOpen, setTimelineOpen, timelineClips, items, removeTimelineClip, reorderTimelineClips, updateTimelineClip, theme } = useAppStore();
  const isDark = theme === "dark";
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1); // 0.5x to 5x

  if (!isTimelineOpen) return null;

  const getItemForClip = (clip: TimelineClip) => items.find((i) => i.id === clip.itemId);

  const getThumbUrl = (clip: TimelineClip) => {
    const item = getItemForClip(clip);
    if (!item) return null;
    return item.outputUrl || item.src;
  };

  const getClipDuration = (clip: TimelineClip) => {
    const end = clip.trimEnd > 0 ? clip.trimEnd : clip.duration;
    return Math.max(0.1, end - clip.trimStart);
  };

  const totalDuration = timelineClips.reduce((sum, c) => sum + getClipDuration(c), 0);

  // Drag reorder
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newClips = [...timelineClips];
    const [moved] = newClips.splice(dragIdx, 1);
    newClips.splice(idx, 0, moved);
    reorderTimelineClips(newClips);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // Export: stitch clips into a single video using canvas + MediaRecorder
  const handleExport = async () => {
    if (timelineClips.length === 0) return;
    setExporting(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm; codecs=vp9" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const exportPromise = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();

      for (const clip of timelineClips) {
        const item = getItemForClip(clip);
        if (!item) continue;
        const url = item.outputUrl || item.src;
        const clipDur = getClipDuration(clip);

        if (item.type === "image" || item.type === "psd-layer") {
          // Draw image for its duration
          await new Promise<void>((resolve) => {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const startTime = performance.now();
              const drawFrame = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed >= clipDur) { resolve(); return; }
                // Fit image to canvas
                const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
                const w = img.naturalWidth * scale;
                const h = img.naturalHeight * scale;
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                requestAnimationFrame(drawFrame);
              };
              drawFrame();
            };
            img.onerror = () => resolve();
            img.src = url;
          });
        } else if (item.type === "video" || (item.type === "generation" && item.outputType === "video")) {
          // Play video segment
          await new Promise<void>((resolve) => {
            const vid = document.createElement("video");
            vid.crossOrigin = "anonymous";
            vid.muted = true;
            vid.playsInline = true;
            vid.src = url;
            vid.currentTime = clip.trimStart;

            vid.onloadeddata = () => {
              vid.play();
              const drawFrame = () => {
                if (vid.currentTime >= (clip.trimEnd > 0 ? clip.trimEnd : vid.duration) || vid.ended) {
                  vid.pause();
                  resolve();
                  return;
                }
                const scale = Math.min(canvas.width / vid.videoWidth, canvas.height / vid.videoHeight);
                const w = vid.videoWidth * scale;
                const h = vid.videoHeight * scale;
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(vid, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                requestAnimationFrame(drawFrame);
              };
              drawFrame();
            };
            vid.onerror = () => resolve();
          });
        }
      }

      recorder.stop();
      await exportPromise;

      const blob = new Blob(chunks, { type: "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `motionboards-timeline-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Some media may have CORS restrictions.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 bottom-12 z-[55] transition-all ${minimized ? "w-auto" : "w-[90vw] max-w-[800px]"}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={`rounded-2xl border shadow-2xl overflow-hidden ${isDark ? "border-gray-700 bg-[#161b22]" : "border-gray-200 bg-white"}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDark ? "border-gray-700" : "border-gray-100"}`}>
          <div className="flex items-center gap-2">
            <Film className="h-3.5 w-3.5 text-[#f26522]" />
            <span className={`text-[11px] font-bold ${isDark ? "text-white" : "text-[#0d1117]"}`}>Timeline</span>
            <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
              {timelineClips.length} clip{timelineClips.length !== 1 ? "s" : ""} &middot; {totalDuration.toFixed(1)}s
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className={`rounded p-1 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-400 hover:bg-gray-100"}`}
              onClick={() => setMinimized(!minimized)}
              title={minimized ? "Expand" : "Minimize"}
            >
              {minimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              className={`rounded p-1 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-400 hover:bg-gray-100"}`}
              onClick={() => setTimelineOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Timeline track */}
        {!minimized && (
          <div className="p-2">
            {timelineClips.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-center">
                <div>
                  <Film className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                  <p className={`text-[11px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Right-click any image or video on the canvas and select "Add to Timeline"
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Zoom controls + timecode ruler */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      className={`rounded p-0.5 ${isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"}`}
                      onClick={() => setTimelineZoom(Math.max(0.3, timelineZoom - 0.3))}
                    >
                      <ZoomOut className="h-3 w-3" />
                    </button>
                    <input
                      type="range"
                      min={0.3}
                      max={5}
                      step={0.1}
                      value={timelineZoom}
                      onChange={(e) => setTimelineZoom(Number(e.target.value))}
                      className="w-16 h-1 accent-[#f26522]"
                      title={`Zoom: ${timelineZoom.toFixed(1)}x`}
                    />
                    <button
                      className={`rounded p-0.5 ${isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"}`}
                      onClick={() => setTimelineZoom(Math.min(5, timelineZoom + 0.3))}
                    >
                      <ZoomIn className="h-3 w-3" />
                    </button>
                    <span className="text-[8px] text-gray-400 ml-1">{timelineZoom.toFixed(1)}x</span>
                  </div>
                  {/* Timecode markers */}
                  <div className="flex-1 relative h-3 overflow-hidden">
                    <div className="flex" style={{ width: totalDuration * 30 * timelineZoom }}>
                      {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                        <div
                          key={i}
                          className="flex-shrink-0 border-l border-gray-300/30 relative"
                          style={{ width: 30 * timelineZoom }}
                        >
                          <span className="absolute top-0 left-0.5 text-[7px] text-gray-400 leading-none">
                            {i}s
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Scrollable clip row */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300">
                  {timelineClips.map((clip, idx) => {
                    const item = getItemForClip(clip);
                    const thumbUrl = getThumbUrl(clip);
                    const clipDur = getClipDuration(clip);
                    const isVideo = item?.type === "video" || (item?.type === "generation" && item?.outputType === "video");

                    return (
                      <div
                        key={clip.id}
                        className={`relative flex-shrink-0 rounded-lg border-2 transition-all cursor-grab active:cursor-grabbing ${
                          dragOverIdx === idx
                            ? "border-[#f26522] scale-105"
                            : isDark ? "border-gray-700 hover:border-gray-600" : "border-gray-200 hover:border-gray-300"
                        }`}
                        style={{ width: Math.max(60, clipDur * 30 * timelineZoom) }}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={() => handleDrop(idx)}
                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      >
                        {/* Thumbnail */}
                        <div className="relative overflow-hidden rounded-t-md" style={{ height: Math.max(56, Math.min(56 * timelineZoom, 140)) }}>
                          {thumbUrl ? (
                            isVideo ? (
                              <video src={thumbUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                            ) : (
                              <img src={thumbUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                            )
                          ) : (
                            <div className={`h-full w-full flex items-center justify-center ${isDark ? "bg-gray-800" : "bg-gray-100"}`}>
                              <Image className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          {/* Duration badge */}
                          <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                            {clipDur.toFixed(1)}s
                          </span>
                          {/* Drag handle */}
                          <div className="absolute top-0.5 left-0.5 bg-black/40 rounded p-0.5">
                            <GripVertical className="h-2.5 w-2.5 text-white/80" />
                          </div>
                          {/* Type icon */}
                          {isVideo && (
                            <div className="absolute top-0.5 right-0.5 bg-black/40 rounded-full p-0.5">
                              <Play className="h-2 w-2 text-white" fill="white" />
                            </div>
                          )}
                        </div>

                        {/* Clip info & trim controls */}
                        <div className={`px-1.5 py-1 ${isDark ? "bg-[#0d1117]" : "bg-gray-50"} rounded-b-md`}>
                          <p className={`text-[8px] font-medium truncate ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                            {item?.fileName || item?.modelName || (isVideo ? "Video" : "Image")}
                          </p>
                          {/* Trim controls for video clips */}
                          {isVideo && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <input
                                type="number"
                                min={0}
                                max={clip.duration}
                                step={0.5}
                                value={clip.trimStart}
                                onChange={(e) => updateTimelineClip(clip.id, { trimStart: Math.max(0, Number(e.target.value)) })}
                                className={`w-8 text-[7px] text-center rounded border p-0 ${isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-700"}`}
                                title="Trim start (s)"
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                              <span className="text-[7px] text-gray-400">-</span>
                              <input
                                type="number"
                                min={0}
                                max={clip.duration}
                                step={0.5}
                                value={clip.trimEnd > 0 ? clip.trimEnd : clip.duration}
                                onChange={(e) => updateTimelineClip(clip.id, { trimEnd: Math.max(clip.trimStart + 0.5, Number(e.target.value)) })}
                                className={`w-8 text-[7px] text-center rounded border p-0 ${isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-700"}`}
                                title="Trim end (s)"
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                            </div>
                          )}
                          {/* Duration control for images */}
                          {!isVideo && (
                            <div className="flex items-center gap-0.5 mt-0.5">
                              <input
                                type="number"
                                min={0.5}
                                max={30}
                                step={0.5}
                                value={clip.duration}
                                onChange={(e) => updateTimelineClip(clip.id, { duration: Math.max(0.5, Number(e.target.value)) })}
                                className={`w-10 text-[7px] text-center rounded border p-0 ${isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-700"}`}
                                title="Duration (s)"
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                              <span className="text-[7px] text-gray-400">sec</span>
                            </div>
                          )}
                        </div>

                        {/* Remove button */}
                        <button
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity shadow-sm"
                          style={{ opacity: 1 }}
                          onClick={(e) => { e.stopPropagation(); removeTimelineClip(clip.id); }}
                          title="Remove from timeline"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Export bar */}
                <div className={`flex items-center justify-between mt-2 pt-2 border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                  <span className="text-[9px] text-gray-400">
                    {timelineClips.length} clip{timelineClips.length !== 1 ? "s" : ""} &middot; Total: {totalDuration.toFixed(1)}s &middot; 1280x720 WebM
                  </span>
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f26522] text-white text-[10px] font-bold rounded-lg hover:bg-[#d9541a] transition-colors disabled:opacity-50"
                    onClick={handleExport}
                    disabled={exporting || timelineClips.length === 0}
                  >
                    {exporting ? (
                      <>
                        <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        Export Video
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
