"use client";

import { useState, useRef, useCallback } from "react";
import { X, Download, Music, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { BoardItem } from "@/lib/store";

interface ZoomPreviewProps {
  item: BoardItem;
  onClose: () => void;
}

export function ZoomPreview({ item, onClose }: ZoomPreviewProps) {
  const mediaSrc = item.outputUrl || item.src;
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale((s) => Math.max(0.5, Math.min(10, s + delta * s)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  }, [scale, pos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const resetZoom = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  const isImage = item.type === "image" || item.type === "psd-layer" || (item.type === "generation" && item.outputType === "image");
  const isVideo = item.type === "video" || (item.type === "generation" && item.outputType === "video");
  const isAudio = item.type === "audio" || (item.type === "generation" && item.outputType === "audio");

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {item.modelName && (
            <span className="text-xs font-semibold text-white/80">{item.modelName}</span>
          )}
          {item.prompt && (
            <span className="text-xs text-white/40 max-w-md truncate">{item.prompt}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isImage && (
            <>
              <button onClick={() => setScale((s) => Math.min(10, s + 0.5))} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </button>
              <span className="text-[10px] text-white/40 min-w-[3rem] text-center font-mono">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale((s) => Math.max(0.5, s - 0.5))} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </button>
              <button onClick={resetZoom} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Reset zoom">
                <RotateCcw className="h-4 w-4" />
              </button>
              <div className="w-px h-4 bg-white/10 mx-1" />
            </>
          )}
          {mediaSrc && (
            <a href={mediaSrc} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs">
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Media area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
      >
        {isImage && (
          <img
            src={mediaSrc}
            alt={item.fileName || "Preview"}
            className="max-h-[85vh] max-w-[90vw] rounded-xl select-none"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              transition: dragging ? "none" : "transform 0.15s ease-out",
              objectFit: "contain",
            }}
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              if (scale === 1) setScale(2);
            }}
          />
        )}

        {isVideo && (
          <video
            src={mediaSrc}
            controls
            autoPlay
            loop
            className="max-h-[85vh] max-w-[90vw] rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {isAudio && (
          <div className="flex flex-col items-center gap-4 rounded-xl bg-[#0d1f30] p-8" onClick={(e) => e.stopPropagation()}>
            <Music className="h-12 w-12 text-[#f26522]" />
            <p className="text-sm text-white">{item.fileName || "Audio"}</p>
            <audio src={mediaSrc} controls autoPlay className="w-80" />
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {isImage && (
        <div className="text-center py-2 shrink-0">
          <p className="text-[10px] text-white/30">Scroll to zoom &middot; Click to zoom in &middot; Drag to pan &middot; Click outside to close</p>
        </div>
      )}
    </div>
  );
}
