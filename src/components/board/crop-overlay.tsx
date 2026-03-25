"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAppStore, defaultEditState } from "@/lib/store";
import type { BoardItem } from "@/lib/store";

interface CropOverlayProps {
  item: BoardItem;
}

type Handle = "tl" | "tr" | "bl" | "br" | "move";

export function CropOverlay({ item }: CropOverlayProps) {
  const { isCropMode, updateEditState } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const editState = item.editState || defaultEditState;
  const { cropX, cropY, cropW, cropH } = editState;

  const [dragging, setDragging] = useState<Handle | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cx: 0, cy: 0, cw: 0, ch: 0 });

  if (!isCropMode) return null;

  const handleMouseDown = (handle: Handle) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(handle);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cx: cropX,
      cy: cropY,
      cw: cropW,
      ch: cropH,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const dx = (e.clientX - dragStart.x) / rect.width;
      const dy = (e.clientY - dragStart.y) / rect.height;

      let newX = dragStart.cx;
      let newY = dragStart.cy;
      let newW = dragStart.cw;
      let newH = dragStart.ch;

      if (dragging === "move") {
        newX = Math.max(0, Math.min(1 - newW, dragStart.cx + dx));
        newY = Math.max(0, Math.min(1 - newH, dragStart.cy + dy));
      } else if (dragging === "tl") {
        newX = Math.max(0, Math.min(dragStart.cx + dragStart.cw - 0.05, dragStart.cx + dx));
        newY = Math.max(0, Math.min(dragStart.cy + dragStart.ch - 0.05, dragStart.cy + dy));
        newW = dragStart.cx + dragStart.cw - newX;
        newH = dragStart.cy + dragStart.ch - newY;
      } else if (dragging === "tr") {
        newW = Math.max(0.05, Math.min(1 - dragStart.cx, dragStart.cw + dx));
        newY = Math.max(0, Math.min(dragStart.cy + dragStart.ch - 0.05, dragStart.cy + dy));
        newH = dragStart.cy + dragStart.ch - newY;
      } else if (dragging === "bl") {
        newX = Math.max(0, Math.min(dragStart.cx + dragStart.cw - 0.05, dragStart.cx + dx));
        newW = dragStart.cx + dragStart.cw - newX;
        newH = Math.max(0.05, Math.min(1 - dragStart.cy, dragStart.ch + dy));
      } else if (dragging === "br") {
        newW = Math.max(0.05, Math.min(1 - dragStart.cx, dragStart.cw + dx));
        newH = Math.max(0.05, Math.min(1 - dragStart.cy, dragStart.ch + dy));
      }

      updateEditState(item.id, { cropX: newX, cropY: newY, cropW: newW, cropH: newH });
    },
    [dragging, dragStart, item.id, updateEditState]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const handleSize = 8;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
      style={{ pointerEvents: "auto" }}
    >
      {/* Dark overlay for non-cropped areas */}
      {/* Top */}
      <div
        className="absolute bg-black/60"
        style={{ top: 0, left: 0, right: 0, height: `${cropY * 100}%` }}
      />
      {/* Bottom */}
      <div
        className="absolute bg-black/60"
        style={{ bottom: 0, left: 0, right: 0, height: `${(1 - cropY - cropH) * 100}%` }}
      />
      {/* Left */}
      <div
        className="absolute bg-black/60"
        style={{
          top: `${cropY * 100}%`,
          left: 0,
          width: `${cropX * 100}%`,
          height: `${cropH * 100}%`,
        }}
      />
      {/* Right */}
      <div
        className="absolute bg-black/60"
        style={{
          top: `${cropY * 100}%`,
          right: 0,
          width: `${(1 - cropX - cropW) * 100}%`,
          height: `${cropH * 100}%`,
        }}
      />

      {/* Crop area border */}
      <div
        className="absolute border-2 border-white/80 cursor-move"
        style={{
          left: `${cropX * 100}%`,
          top: `${cropY * 100}%`,
          width: `${cropW * 100}%`,
          height: `${cropH * 100}%`,
        }}
        onMouseDown={handleMouseDown("move")}
      >
        {/* Rule of thirds grid */}
        <div className="absolute inset-0">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
        </div>
      </div>

      {/* Corner handles */}
      {(["tl", "tr", "bl", "br"] as Handle[]).map((handle) => {
        const isLeft = handle.includes("l");
        const isTop = handle.includes("t");
        return (
          <div
            key={handle}
            className="absolute bg-white border border-neutral-400 shadow-sm"
            style={{
              left: `calc(${(isLeft ? cropX : cropX + cropW) * 100}% - ${handleSize / 2}px)`,
              top: `calc(${(isTop ? cropY : cropY + cropH) * 100}% - ${handleSize / 2}px)`,
              width: handleSize,
              height: handleSize,
              cursor:
                handle === "tl" || handle === "br" ? "nwse-resize" : "nesw-resize",
            }}
            onMouseDown={handleMouseDown(handle)}
          />
        );
      })}
    </div>
  );
}
