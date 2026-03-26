"use client";

import { useState } from "react";
import { Play, Loader2, Music, X, AlertCircle, Pencil, Layers, Download, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { BoardItem } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { CropOverlay } from "./crop-overlay";

interface BoardItemCardProps {
  item: BoardItem;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onResizeStart: (e: React.MouseEvent, edge: string) => void;
}

export function BoardItemCard({
  item,
  isSelected,
  onMouseDown,
  onDoubleClick,
  onResizeStart,
}: BoardItemCardProps) {
  const { startFrameId, endFrameId, inputRefs, isEditMode, setEditMode, selectItem } = useAppStore();

  const isStartFrame = startFrameId === item.id;
  const isEndFrame = endFrameId === item.id;
  const isInputRef = inputRefs.includes(item.id);
  const inputIndex = inputRefs.indexOf(item.id);

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

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectItem(item.id);
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleDownload = async () => {
    closeContextMenu();
    const url = item.outputUrl || item.src;
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const ext = item.type === "video" ? "mp4" : item.type === "audio" ? "mp3" : "png";
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

  return (
    <div
      className="absolute select-none group"
      onContextMenu={handleContextMenu}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        zIndex: isSelected ? 50 : 1,
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {/* Reference badges */}
      <div className="absolute -top-7 left-0 z-10 flex gap-1">
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
        {item.type === "psd-layer" && (
          <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 flex items-center gap-1 border-0">
            <Layers className="h-2.5 w-2.5" />
            PSD
          </Badge>
        )}
      </div>

      {/* Card */}
      <div
        className={`relative rounded-lg border-2 transition-all ${
          isSelected
            ? "border-[#f26522] shadow-[0_0_15px_rgba(242,101,34,0.3)]"
            : isStartFrame || isEndFrame || isInputRef
            ? "border-emerald-500/70"
            : "border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md"
        } bg-white`}
      >
        {/* Media wrapper with overflow hidden */}
        <div className="overflow-hidden rounded-md">
        {/* Media content */}
        {(item.type === "image" || item.type === "psd-layer") && (
          <img
            src={item.outputUrl || item.src}
            alt={item.fileName || item.psdLayerName || "Image"}
            className="w-full pointer-events-none"
            style={{ height: item.height, objectFit: "cover", ...filterStyle, ...cropStyle }}
            draggable={false}
          />
        )}

        {item.type === "video" && (
          <div className="relative" style={{ height: item.height }}>
            <video
              src={item.outputUrl || item.src}
              className="h-full w-full object-cover"
              muted
              loop
              playsInline
              draggable={false}
            />
            <div className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5">
              <Play className="h-3 w-3 text-white" fill="white" />
            </div>
          </div>
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
              <p className="truncate text-xs font-medium text-white">
                {item.fileName || "Audio"}
              </p>
              <p className="text-[10px] text-white/40">Audio file</p>
            </div>
          </div>
        )}

        {item.type === "generation" && (
          <div style={{ height: item.height }}>
            {item.status === "processing" ? (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-[#f26522]" />
                <p className="text-[10px] text-gray-400">Generating...</p>
              </div>
            ) : item.status === "failed" ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="text-[10px] text-red-400 text-center line-clamp-3">
                  {item.error || "Failed"}
                </p>
              </div>
            ) : item.outputUrl ? (
              item.outputType === "video" ? (
                <div className="relative h-full">
                  <video
                    src={item.outputUrl}
                    className="h-full w-full object-cover"
                    muted
                    loop
                    playsInline
                    draggable={false}
                  />
                  <div className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5">
                    <Play className="h-3 w-3 text-white" fill="white" />
                  </div>
                </div>
              ) : item.outputType === "audio" ? (
                <div className="flex h-full items-center justify-center p-4">
                  <audio src={item.outputUrl} controls className="w-full" />
                </div>
              ) : (
                <img
                  src={item.outputUrl}
                  alt="Generated"
                  className="h-full w-full object-cover pointer-events-none"
                  draggable={false}
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-xs text-gray-400">Ready to generate</p>
              </div>
            )}
          </div>
        )}

        </div>{/* end media wrapper */}

        {/* Crop overlay */}
        {isImageType && isSelected && (
          <CropOverlay item={item} />
        )}

        {/* Resize handles — edges and corners, visible on hover or selected */}
        {(item.type === "image" || item.type === "video" || item.type === "generation" || item.type === "psd-layer") && (
          <>
            {/* Right edge */}
            <div
              className={`absolute top-2 bottom-2 right-0 w-2 cursor-ew-resize transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onMouseDown={(e) => onResizeStart(e, "e")}
            />
            {/* Bottom edge */}
            <div
              className={`absolute left-2 right-2 bottom-0 h-2 cursor-ns-resize transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onMouseDown={(e) => onResizeStart(e, "s")}
            />
            {/* Left edge */}
            <div
              className={`absolute top-2 bottom-2 left-0 w-2 cursor-ew-resize transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onMouseDown={(e) => onResizeStart(e, "w")}
            />
            {/* Top edge */}
            <div
              className={`absolute left-2 right-2 top-0 h-2 cursor-ns-resize transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onMouseDown={(e) => onResizeStart(e, "n")}
            />
            {/* Bottom-right corner */}
            <div
              className={`absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onMouseDown={(e) => onResizeStart(e, "se")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" className="text-gray-400">
                <path d="M14 14L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M14 14L14 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            {/* Bottom-left corner */}
            <div
              className={`absolute bottom-0 left-0 h-4 w-4 cursor-nesw-resize transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onMouseDown={(e) => onResizeStart(e, "sw")}
            />
            {/* Top-right corner */}
            <div
              className={`absolute top-0 right-0 h-4 w-4 cursor-nesw-resize transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onMouseDown={(e) => onResizeStart(e, "ne")}
            />
            {/* Top-left corner */}
            <div
              className={`absolute top-0 left-0 h-4 w-4 cursor-nwse-resize transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onMouseDown={(e) => onResizeStart(e, "nw")}
            />
          </>
        )}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }} />
          <div
            className="absolute z-[101] bg-white rounded-xl border border-gray-200 shadow-xl py-1 min-w-[160px] overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {isMediaType && (
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium text-[#0d1117] hover:bg-gray-50 transition-colors"
                onClick={handleDownload}
              >
                <Download className="h-3.5 w-3.5 text-gray-400" />
                Download
              </button>
            )}
            {isImageType && (
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[11px] font-medium text-[#0d1117] hover:bg-gray-50 transition-colors"
                onClick={() => { closeContextMenu(); selectItem(item.id); setEditMode(true); }}
              >
                <Pencil className="h-3.5 w-3.5 text-gray-400" />
                Edit
              </button>
            )}
            <div className="h-px bg-gray-100 my-0.5" />
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
      <div className="mt-1.5 px-0.5">
        {item.psdLayerName && (
          <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide truncate">
            {item.psdLayerName}
          </p>
        )}
        {item.modelName && (
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            {item.modelName}
          </p>
        )}
        {item.prompt && (
          <p className="mt-0.5 text-[11px] leading-snug text-gray-500 line-clamp-3">
            {item.prompt}
          </p>
        )}
        {item.cost && (
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
