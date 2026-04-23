"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";

// Width / height of the minimap widget on screen.
const MM_W = 200;
const MM_H = 140;
// Padding (in canvas coordinates) around the content bounds so items never
// sit flush against the minimap edge.
const PAD = 200;

export function Minimap() {
  const { items, panX, panY, zoom, setPan, theme, selectedItemId, selectedItemIds } = useAppStore();
  const isDark = theme === "dark";
  const ref = useRef<HTMLDivElement>(null);

  // Re-read the viewport whenever the window resizes — the visible rect in
  // canvas coords depends on innerWidth / innerHeight.
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // World-space bounding box: everything the user has on the board PLUS the
  // current viewport. Including the viewport means the minimap always shows
  // where the user is looking, even on empty areas of the canvas.
  const bounds = useMemo(() => {
    const viewX = -panX / zoom;
    const viewY = -panY / zoom;
    const viewW = vp.w / zoom;
    const viewH = vp.h / zoom;

    let minX = viewX;
    let minY = viewY;
    let maxX = viewX + viewW;
    let maxY = viewY + viewH;
    for (const it of items) {
      if (it.x < minX) minX = it.x;
      if (it.y < minY) minY = it.y;
      const r = it.x + (it.width || 100);
      const b = it.y + (it.height || 100);
      if (r > maxX) maxX = r;
      if (b > maxY) maxY = b;
    }
    minX -= PAD;
    minY -= PAD;
    maxX += PAD;
    maxY += PAD;
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, viewX, viewY, viewW, viewH };
  }, [items, panX, panY, zoom, vp.w, vp.h]);

  // Scale the world bounding box into the minimap rect, preserving aspect so
  // nothing squishes. Whichever side is the binding constraint drives the
  // scale; the other side gets centered.
  const scale = bounds.w > 0 && bounds.h > 0
    ? Math.min(MM_W / bounds.w, MM_H / bounds.h)
    : 1;
  const contentW = bounds.w * scale;
  const contentH = bounds.h * scale;
  const offsetX = (MM_W - contentW) / 2;
  const offsetY = (MM_H - contentH) / 2;

  const worldToMap = (wx: number, wy: number) => ({
    x: offsetX + (wx - bounds.minX) * scale,
    y: offsetY + (wy - bounds.minY) * scale,
  });

  // Click / drag on the minimap to pan. The viewport-rect center moves to
  // wherever the user clicked.
  const handleJump = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    // minimap px → world coords
    const wx = bounds.minX + (mx - offsetX) / scale;
    const wy = bounds.minY + (my - offsetY) / scale;
    // Center the viewport on (wx, wy): panX such that view center world-x = wx
    // Screen center = (vp.w/2, vp.h/2); view center world = (-panX + vp.w/2)/zoom
    // So: panX = -wx * zoom + vp.w/2
    setPan(-wx * zoom + vp.w / 2, -wy * zoom + vp.h / 2);
  };

  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => handleJump(e.clientX, e.clientY);
    const up = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, bounds.minX, bounds.minY, scale, zoom, vp.w, vp.h]);

  // Collapse state — persisted in localStorage so it survives refreshes.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(typeof window !== "undefined" && localStorage.getItem("motionboards_minimap_collapsed") === "true");
  }, []);
  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("motionboards_minimap_collapsed", String(next)); } catch {}
      return next;
    });
  };

  const viewMap = worldToMap(bounds.viewX, bounds.viewY);
  const viewW = bounds.viewW * scale;
  const viewH = bounds.viewH * scale;

  const selectedIds = new Set(selectedItemIds.length > 0 ? selectedItemIds : (selectedItemId ? [selectedItemId] : []));

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        title="Show minimap"
        className={`fixed bottom-14 right-3 z-[40] rounded-lg border px-2 py-1 text-[10px] font-semibold shadow-md transition-colors ${
          isDark ? "bg-[#161b22]/90 border-gray-700 text-gray-300 hover:text-white" : "bg-white/90 border-gray-200 text-gray-600 hover:text-[#0d1117]"
        }`}
      >
        Minimap
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-14 right-3 z-[40] rounded-lg border shadow-lg backdrop-blur-md ${
        isDark ? "bg-[#161b22]/90 border-gray-700" : "bg-white/90 border-gray-200"
      }`}
      style={{ width: MM_W + 2, height: MM_H + 22 }}
    >
      <div className={`flex items-center justify-between px-2 h-5 text-[9px] uppercase tracking-wider font-black ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        <span>Minimap</span>
        <button
          type="button"
          onClick={toggle}
          title="Hide minimap"
          className={`leading-none ${isDark ? "hover:text-white" : "hover:text-[#0d1117]"}`}
        >
          ×
        </button>
      </div>
      <div
        ref={ref}
        className={`relative cursor-crosshair select-none ${isDark ? "bg-[#0d1117]" : "bg-gray-50"}`}
        style={{ width: MM_W, height: MM_H, margin: "0 1px" }}
        onMouseDown={(e) => {
          e.preventDefault();
          handleJump(e.clientX, e.clientY);
          setDragging(true);
        }}
      >
        {items.map((it) => {
          const p = worldToMap(it.x, it.y);
          const w = Math.max(2, (it.width || 100) * scale);
          const h = Math.max(2, (it.height || 100) * scale);
          const isSel = selectedIds.has(it.id);
          const isGen = it.type === "generation";
          const isText = it.type === "text";
          const starred = !!it.starred;
          const colour = starred
            ? "rgba(251,191,36,0.85)"           // amber
            : isSel
              ? "rgba(242,101,34,0.9)"          // brand orange
              : isGen
                ? "rgba(168,85,247,0.7)"        // purple for generations
                : isText
                  ? "rgba(100,116,139,0.6)"      // slate for text notes
                  : "rgba(59,130,246,0.7)";      // blue for media
          return (
            <div
              key={it.id}
              className="absolute rounded-[1px]"
              style={{
                left: p.x,
                top: p.y,
                width: w,
                height: h,
                backgroundColor: colour,
              }}
            />
          );
        })}
        {/* Viewport rectangle — what the user is currently seeing. */}
        <div
          className="absolute pointer-events-none border-[1.5px] border-[#f26522] rounded-sm"
          style={{
            left: viewMap.x,
            top: viewMap.y,
            width: Math.max(4, viewW),
            height: Math.max(4, viewH),
            boxShadow: "0 0 0 1px rgba(0,0,0,0.25) inset",
          }}
        />
      </div>
    </div>
  );
}
