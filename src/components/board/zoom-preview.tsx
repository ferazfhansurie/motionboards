"use client";

import { useState, useRef, useCallback } from "react";
import { X, Download, Music, ZoomIn, ZoomOut, RotateCcw, Info, Copy, Check } from "lucide-react";
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
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const handleMouseUp = useCallback(() => setDragging(false), []);
  const resetZoom = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  const isImage = item.type === "image" || item.type === "psd-layer" || (item.type === "generation" && item.outputType === "image");
  const isVideo = item.type === "video" || (item.type === "generation" && item.outputType === "video");
  const isAudio = item.type === "audio" || (item.type === "generation" && item.outputType === "audio");

  const getFormat = () => {
    if (item.fileName) {
      const ext = item.fileName.split(".").pop()?.toUpperCase();
      if (ext) return ext;
    }
    if (isVideo) return "MP4";
    if (isAudio) return "MP3";
    return "PNG";
  };

  const getTypeLabel = () => {
    if (item.type === "generation") return item.outputType === "video" ? "Generated Video" : "Generated Image";
    if (item.type === "psd-layer") return "PSD Layer";
    return item.type.charAt(0).toUpperCase() + item.type.slice(1);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 min-w-0">
          {item.modelName && <span className="text-xs font-semibold text-white/80">{item.modelName}</span>}
          {item.prompt && <span className="text-xs text-white/40 truncate max-w-md">{item.prompt}</span>}
        </div>
        <div className="flex items-center gap-1">
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
          {/* File info toggle */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-1.5 rounded-lg transition-colors ${showInfo ? "bg-white/15 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
            title="File Info"
          >
            <Info className="h-4 w-4" />
          </button>
          {mediaSrc && (
            <a href={mediaSrc} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs">
              <Download className="h-3.5 w-3.5" />
            </a>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
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
              onClick={(e) => { e.stopPropagation(); if (scale === 1) setScale(2); }}
            />
          )}
          {isVideo && (
            <video src={mediaSrc} controls autoPlay loop className="max-h-[85vh] max-w-[90vw] rounded-xl" onClick={(e) => e.stopPropagation()} />
          )}
          {isAudio && (
            <div className="flex flex-col items-center gap-4 rounded-xl bg-[#0d1f30] p-8" onClick={(e) => e.stopPropagation()}>
              <Music className="h-12 w-12 text-[#f26522]" />
              <p className="text-sm text-white">{item.fileName || "Audio"}</p>
              <audio src={mediaSrc} controls autoPlay className="w-80" />
            </div>
          )}
        </div>

        {/* File Info Panel - slides in from right */}
        {showInfo && (
          <div className="w-[280px] shrink-0 bg-[#161b22] border-l border-gray-800 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">File Info</h3>
                <button onClick={() => setShowInfo(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* File Name */}
                {(item.fileName || mediaSrc) && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">File Name</p>
                    <div className="flex items-start gap-2">
                      <p className="text-[11px] text-gray-300 break-all flex-1">{item.fileName || "Untitled"}</p>
                      {mediaSrc && (
                        <button onClick={() => copyToClipboard(mediaSrc)} className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors shrink-0" title="Copy URL">
                          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Format */}
                <div>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Format</p>
                  <p className="text-sm font-bold text-white">{getFormat()}</p>
                </div>

                {/* Type */}
                <div>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Type</p>
                  <p className="text-sm font-bold text-white">{getTypeLabel()}</p>
                </div>

                {/* Dimensions */}
                <div>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Dimensions</p>
                  <p className="text-sm font-bold text-white">{Math.round(item.width)} x {Math.round(item.height)}</p>
                </div>

                {/* Date */}
                {item.createdAt && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Added</p>
                    <p className="text-sm font-bold text-white">{new Date(item.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                )}

                {/* Model */}
                {item.modelName && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Model</p>
                    <p className="text-sm font-bold text-[#f26522]">{item.modelName}</p>
                  </div>
                )}

                {/* Cost */}
                {item.cost && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Cost</p>
                    <p className="text-sm font-bold text-emerald-400">{item.cost}</p>
                  </div>
                )}

                {/* Prompt */}
                {item.prompt && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Prompt</p>
                    <div className="bg-black/30 rounded-lg p-2.5 border border-gray-800">
                      <p className="text-[10px] text-gray-300 leading-relaxed">{item.prompt}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(item.prompt || "")}
                      className="mt-1.5 flex items-center gap-1 text-[9px] text-gray-500 hover:text-[#f26522] transition-colors"
                    >
                      <Copy className="h-2.5 w-2.5" />
                      Copy prompt
                    </button>
                  </div>
                )}

                {/* Source URL */}
                {mediaSrc && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Path</p>
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg px-2.5 py-2 border border-gray-800">
                      <p className="text-[9px] text-gray-400 truncate flex-1">{mediaSrc}</p>
                      <button onClick={() => copyToClipboard(mediaSrc)} className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors shrink-0">
                        <Copy className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* PSD info */}
                {item.psdLayerName && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">PSD Layer</p>
                    <p className="text-sm font-bold text-blue-400">{item.psdLayerName}</p>
                    {item.psdBlendMode && <p className="text-[10px] text-gray-500 mt-0.5">Blend: {item.psdBlendMode}</p>}
                    {item.psdOpacity !== undefined && <p className="text-[10px] text-gray-500">Opacity: {Math.round(item.psdOpacity * 100)}%</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {isImage && !showInfo && (
        <div className="text-center py-2 shrink-0">
          <p className="text-[10px] text-white/20">Scroll to zoom &middot; Click to zoom in &middot; Drag to pan &middot; Press (i) for file info</p>
        </div>
      )}
    </div>
  );
}
