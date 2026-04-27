"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";

// Default size. Position is now anchored to the top-right of the viewport
// permanently (no drag-to-move). Only width/height are user-resizable.
const DEFAULT_W = 200;
const DEFAULT_H = 140;
const MIN_W = 140;
const MIN_H = 100;
const MAX_W = 500;
const MAX_H = 400;
// Distance from viewport edges (right + top) — clears the floating toolbar.
const ANCHOR_RIGHT = 12;
const ANCHOR_TOP = 56;
// Padding (in canvas coordinates) around the content bounds so items never
// sit flush against the minimap edge.
const PAD = 200;
const STORAGE_KEY = "motionboards_minimap_state";

interface MinimapState { w: number; h: number }

function loadState(): MinimapState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.w === "number" && typeof parsed?.h === "number") {
      return { w: parsed.w, h: parsed.h };
    }
  } catch {}
  return null;
}

function saveState(s: MinimapState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export function Minimap() {
  const { items, panX, panY, zoom, setPan, theme, selectedItemId, selectedItemIds } = useAppStore();
  const isDark = theme === "dark";
  const mapRef = useRef<HTMLDivElement>(null);

  // Viewport (browser window) dimensions.
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Minimap size — position is fixed (top-right anchor), only w/h are persisted.
  const [state, setState] = useState<MinimapState>({ w: DEFAULT_W, h: DEFAULT_H });
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || vp.w === 0) return;
    hydratedRef.current = true;
    const saved = loadState();
    const w = saved?.w ? Math.min(Math.max(saved.w, MIN_W), MAX_W) : DEFAULT_W;
    const h = saved?.h ? Math.min(Math.max(saved.h, MIN_H), MAX_H) : DEFAULT_H;
    setState({ w, h });
  }, [vp.w, vp.h]);

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

  const scale = bounds.w > 0 && bounds.h > 0
    ? Math.min(state.w / bounds.w, state.h / bounds.h)
    : 1;
  const contentW = bounds.w * scale;
  const contentH = bounds.h * scale;
  const offsetX = (state.w - contentW) / 2;
  const offsetY = (state.h - contentH) / 2;

  const worldToMap = (wx: number, wy: number) => ({
    x: offsetX + (wx - bounds.minX) * scale,
    y: offsetY + (wy - bounds.minY) * scale,
  });

  // ---- Pan-via-click on the map surface ----
  const handleJump = (clientX: number, clientY: number) => {
    const el = mapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const wx = bounds.minX + (mx - offsetX) / scale;
    const wy = bounds.minY + (my - offsetY) / scale;
    setPan(-wx * zoom + vp.w / 2, -wy * zoom + vp.h / 2);
  };

  const [panDragging, setPanDragging] = useState(false);
  useEffect(() => {
    if (!panDragging) return;
    const move = (e: PointerEvent) => handleJump(e.clientX, e.clientY);
    const up = () => setPanDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panDragging, bounds.minX, bounds.minY, scale, zoom, vp.w, vp.h, offsetX, offsetY]);

  // ---- Resize-via-drag on the bottom-left corner handle ----
  // Anchored top-right, so dragging the bottom-LEFT corner makes width grow
  // leftward (negative dx → bigger w) and height grow downward (positive dy).
  const resizeRef = useRef<{ startClientX: number; startClientY: number; startW: number; startH: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      const d = resizeRef.current;
      if (!d) return;
      const dx = e.clientX - d.startClientX;
      const dy = e.clientY - d.startClientY;
      const nextW = Math.min(Math.max(d.startW - dx, MIN_W), MAX_W);
      const nextH = Math.min(Math.max(d.startH + dy, MIN_H), MAX_H);
      setState({ w: nextW, h: nextH });
    };
    const onUp = () => {
      setResizing(false);
      resizeRef.current = null;
      setState((prev) => { saveState(prev); return prev; });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizing]);

  // ---- Collapse ----
  // Default = collapsed. Only opens if the user explicitly toggled it open.
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(localStorage.getItem("motionboards_minimap_collapsed") !== "false");
  }, []);
  const toggleCollapse = () => {
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
        onClick={toggleCollapse}
        title="Show minimap"
        style={{ right: ANCHOR_RIGHT, top: ANCHOR_TOP }}
        className={`fixed z-[40] rounded-lg border px-2 py-1 text-[10px] font-semibold shadow-md transition-colors ${
          isDark ? "bg-[#161b22]/90 border-gray-700 text-gray-300 hover:text-white" : "bg-white/90 border-gray-200 text-gray-600 hover:text-[#0d1117]"
        }`}
      >
        Minimap
      </button>
    );
  }

  return (
    <div
      className={`fixed z-[40] rounded-lg border shadow-lg backdrop-blur-md ${
        isDark ? "bg-[#161b22]/90 border-gray-700" : "bg-white/90 border-gray-200"
      }`}
      style={{ right: ANCHOR_RIGHT, top: ANCHOR_TOP, width: state.w + 2, height: state.h + 22 }}
    >
      {/* Header — fixed in place, no longer draggable. */}
      <div
        className={`flex items-center justify-between px-2 h-5 text-[9px] uppercase tracking-wider font-black ${isDark ? "text-gray-500" : "text-gray-400"}`}
      >
        <span>Minimap</span>
        <button
          type="button"
          onClick={toggleCollapse}
          title="Hide minimap"
          className={`leading-none ${isDark ? "hover:text-white" : "hover:text-[#0d1117]"}`}
        >
          ×
        </button>
      </div>

      <div
        ref={mapRef}
        className={`relative cursor-crosshair select-none ${isDark ? "bg-[#0d1117]" : "bg-gray-50"}`}
        style={{ width: state.w, height: state.h, margin: "0 1px" }}
        onPointerDown={(e) => {
          e.preventDefault();
          handleJump(e.clientX, e.clientY);
          setPanDragging(true);
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
            ? "rgba(251,191,36,0.9)"
            : isSel
              ? "rgba(242,101,34,1)"
              : isGen
                ? "rgba(242,101,34,0.75)"
                : isText
                  ? "rgba(242,101,34,0.35)"
                  : "rgba(242,101,34,0.55)";
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

        {/* Bottom-LEFT resize grip — drag to grow leftward + downward. */}
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            resizeRef.current = { startClientX: e.clientX, startClientY: e.clientY, startW: state.w, startH: state.h };
            setResizing(true);
          }}
          title="Drag to resize"
          className="absolute bottom-0 left-0 h-4 w-4 cursor-nesw-resize touch-none"
          style={{
            background: `linear-gradient(45deg, transparent 0%, transparent 50%, ${isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)"} 50%, ${isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)"} 100%)`,
          }}
        />
      </div>
    </div>
  );
}
