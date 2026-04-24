"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { Download, Copy, Trash2, X, LayoutGrid } from "lucide-react";
import { useAppStore, type BoardItem } from "@/lib/store";
import { BoardItemCard } from "./board-item";
import { PromptBar } from "./prompt-bar";
import { ModelPanel } from "./model-panel";
import { Toolbar } from "./toolbar";
import { ZoomPreview } from "./zoom-preview";
import { EditPanel } from "./edit-panel";
import { TemplatesPanel } from "./templates-panel";
import { ProfilePanel, HistoryPanel } from "./dashboard-modal";
import { AIPromptPanel } from "./ai-prompt-panel";
import { FoldersPanel } from "./folders-panel";
import { Minimap } from "./minimap";
import { UILayer } from "@/components/ui/ui-layer";
import { parsePsdBuffer } from "@/lib/psd";
import { requireAuth } from "@/lib/auth-gate";

// Upload a file and return a hosted URL. Streams the file to /api/upload
// with Transfer-Encoding: chunked (via file.stream() + duplex:"half") so
// Vercel's edge doesn't pre-reject on Content-Length for large bodies.
// Server pipes the stream into Vercel Blob and returns the public URL.
async function uploadFile(file: File): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 120_000);
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "content-type": file.type || "application/octet-stream",
        "x-filename": file.name || "upload.bin",
      },
      body: file.stream(),
      signal: ctrl.signal,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      duplex: "half",
    } as RequestInit & { duplex?: "half" });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data.url) return data.url;
  } catch {}
  // Fallback: data URI (keeps the item visible locally even on upload failure).
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
}

export function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    items,
    panX,
    panY,
    zoom,
    setPan,
    setZoom,
    addItem,
    selectItem,
    selectItems,
    selectedItemId,
    selectedItemIds,
    activeCanvasTool,
    setActiveCanvasTool,
    drawingColor,
    drawingStrokeWidth,
    connections,
    theme,
    connectingFromId,
    isAIPromptOpen,
    organizeMode,
    organizeActiveId,
  } = useAppStore();

  // AI panel is user-resizable; the panel dispatches ai-panel-width events.
  // Start from localStorage so we don't flash the wrong width on mount.
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

  const isDark = theme === "dark";

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [previewItem, setPreviewItem] = useState<BoardItem | null>(null);

  // Drag state for moving items
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [resizeId, setResizeId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Space held for pan mode
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [drawOrigin, setDrawOrigin] = useState({ x: 0, y: 0 });

  // Marquee selection state (right-click drag). Coords are in screen space.
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Space key tracking + keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        useAppStore.getState().undo();
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        useAppStore.getState().redo();
      }
      // Tool shortcuts (only when not typing in an input)
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      // Organize mode — arrow keys drive cycle + nudge, Enter auto-packs.
      // Handled before other shortcuts so Escape exits the mode rather than
      // switching tools.
      const st = useAppStore.getState();
      if (st.organizeMode) {
        if (e.key === "ArrowUp") { e.preventDefault(); st.cycleOrganizeActive("prev"); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); st.cycleOrganizeActive("next"); return; }
        if (e.key === "ArrowLeft") { e.preventDefault(); st.nudgeOrganizeActive(-20, 0); return; }
        if (e.key === "ArrowRight") { e.preventDefault(); st.nudgeOrganizeActive(20, 0); return; }
        if (e.key === "Enter") { e.preventDefault(); st.autoPackSelection(); return; }
        if (e.key === "Escape") { e.preventDefault(); st.toggleOrganizeMode(); return; }
      }
      if (e.key === "v" || e.key === "V") useAppStore.getState().setActiveCanvasTool("select");
      if (e.key === "t" || e.key === "T") useAppStore.getState().setActiveCanvasTool("text");
      if (e.key === "d" || e.key === "D") useAppStore.getState().setActiveCanvasTool("draw");
      if (e.key === "l" || e.key === "L") useAppStore.getState().setActiveCanvasTool("connect");
      // Escape: back to select, cancel connecting
      if (e.key === "Escape") {
        useAppStore.getState().setActiveCanvasTool("select");
        useAppStore.getState().setConnectingFromId(null);
      }
      // Delete selected item(s)
      if ((e.key === "Delete" || e.key === "Backspace") && tag !== "INPUT" && tag !== "TEXTAREA") {
        useAppStore.getState().removeSelectedItems();
      }
      // Copy: Ctrl+C — only if we have a selection (otherwise let browser copy text)
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        const s = useAppStore.getState();
        if (s.selectedItemIds.length > 0 || s.selectedItemId) {
          s.copySelectedItems();
        }
      }
      // Paste: Ctrl+V — only intercept if we have in-app clipboard; otherwise let
      // the browser "paste" event fire so OS-clipboard images can be pasted.
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        const s = useAppStore.getState();
        if (s.clipboard.length > 0) {
          e.preventDefault();
          s.pasteItems();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Left-click on empty canvas
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const isCanvas = target === canvasRef.current || !!target.dataset.canvas;

      // Right-click drag on empty canvas → start marquee selection
      if (e.button === 2 && isCanvas) {
        e.preventDefault();
        setMarquee({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
        return;
      }

      if (isCanvas) {
        selectItem(null);
        // Cancel connecting if clicking empty canvas
        if (connectingFromId) {
          useAppStore.getState().setConnectingFromId(null);
        }
      }

      // Text tool: click on canvas to add text and immediately enter edit mode
      if (e.button === 0 && isCanvas && activeCanvasTool === "text" && !spaceHeld && !e.altKey) {
        e.preventDefault();
        const canvasX = (e.clientX - panX) / zoom;
        const canvasY = (e.clientY - panY) / zoom;
        const newId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const store = useAppStore.getState();
        store.addItem({
          id: newId,
          type: "text",
          x: canvasX,
          y: canvasY,
          width: 240,
          height: 48,
          src: "",
          text: "",
          fontSize: 16,
          fontFamily: "Inter, sans-serif",
          fontColor: isDark ? "#ffffff" : "#000000",
          fontWeight: "normal",
          textAlign: "left",
          backgroundColor: "transparent",
          createdAt: new Date().toISOString(),
        });
        store.selectItem(newId);
        store.setAutoEditItemId(newId);
        store.setActiveCanvasTool("select");
        return;
      }

      // Draw tool: start drawing
      if (e.button === 0 && isCanvas && activeCanvasTool === "draw" && !spaceHeld && !e.altKey) {
        e.preventDefault();
        const canvasX = (e.clientX - panX) / zoom;
        const canvasY = (e.clientY - panY) / zoom;
        setIsDrawing(true);
        setDrawOrigin({ x: canvasX, y: canvasY });
        setDrawPoints([{ x: canvasX, y: canvasY }]);
        return;
      }

      // Pan: middle-click, alt+click, space+click, or left-click on empty canvas (select/connect tool)
      if (
        e.button === 1 ||
        (e.button === 0 && e.altKey) ||
        (e.button === 0 && spaceHeld) ||
        (e.button === 0 && isCanvas && (!activeCanvasTool || activeCanvasTool === "select" || activeCanvasTool === "connect"))
      ) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
        e.preventDefault();
      }
    },
    [panX, panY, selectItem, spaceHeld, activeCanvasTool, zoom, connectingFromId, isDark]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Update marquee box while dragging
      if (marquee) {
        setMarquee({ ...marquee, x2: e.clientX, y2: e.clientY });
        return;
      }
      if (isPanning) {
        setPan(e.clientX - panStart.x, e.clientY - panStart.y);
        return;
      }
      // Drawing in progress
      if (isDrawing) {
        const canvasX = (e.clientX - panX) / zoom;
        const canvasY = (e.clientY - panY) / zoom;
        setDrawPoints((prev) => [...prev, { x: canvasX, y: canvasY }]);
        return;
      }
      if (resizeId) {
        const dx = (e.clientX - resizeStart.x) / zoom;
        const dy = (e.clientY - resizeStart.y) / zoom;
        const ratio = resizeStart.h / resizeStart.w;
        const updates: Partial<BoardItem> = {};

        if (resizeEdge.includes("e")) {
          updates.width = Math.max(50, Math.round(resizeStart.w + dx));
        }
        if (resizeEdge.includes("s")) {
          updates.height = Math.max(50, Math.round(resizeStart.h + dy));
        }
        if (resizeEdge.includes("w")) {
          const newW = Math.max(50, Math.round(resizeStart.w - dx));
          updates.width = newW;
          updates.x = resizeItemStart.x + (resizeStart.w - newW);
        }
        if (resizeEdge.includes("n")) {
          const newH = Math.max(50, Math.round(resizeStart.h - dy));
          updates.height = newH;
          updates.y = resizeItemStart.y + (resizeStart.h - newH);
        }

        // Keep aspect ratio for corner drags
        if (resizeEdge.length === 2) {
          const w = updates.width || resizeStart.w;
          updates.height = Math.round(w * ratio);
          if (resizeEdge.includes("n")) {
            updates.y = resizeItemStart.y + resizeStart.h - updates.height;
          }
        }

        useAppStore.getState().updateItem(resizeId, updates);
        if (updates.x !== undefined || updates.y !== undefined) {
          useAppStore.getState().moveItem(resizeId, updates.x ?? resizeItemStart.x, updates.y ?? resizeItemStart.y);
        }
        return;
      }
      if (dragId) {
        const x = (e.clientX - panX - dragOffset.x) / zoom;
        const y = (e.clientY - panY - dragOffset.y) / zoom;
        useAppStore.getState().moveItem(dragId, x, y);
      }
    },
    [isPanning, panStart, dragId, dragOffset, resizeId, resizeStart, panX, panY, zoom, setPan, isDrawing, marquee]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDragId(null);
    setResizeId(null);

    // Finalize marquee selection — find all items whose bounding box intersects the marquee
    if (marquee) {
      const mx = Math.min(marquee.x1, marquee.x2);
      const my = Math.min(marquee.y1, marquee.y2);
      const mw = Math.abs(marquee.x2 - marquee.x1);
      const mh = Math.abs(marquee.y2 - marquee.y1);
      // Ignore near-zero drags (treat as simple right-click, no marquee)
      if (mw > 4 || mh > 4) {
        const selectedIds = items.filter((item) => {
          // Convert item canvas coords to screen coords
          const ix1 = panX + item.x * zoom;
          const iy1 = panY + item.y * zoom;
          const ix2 = ix1 + item.width * zoom;
          const iy2 = iy1 + item.height * zoom;
          // AABB overlap test
          return ix1 < mx + mw && ix2 > mx && iy1 < my + mh && iy2 > my;
        }).map((i) => i.id);
        selectItems(selectedIds);
      }
      setMarquee(null);
    }

    // Finalize drawing
    if (isDrawing && drawPoints.length > 1) {
      const { drawingColor: color, drawingStrokeWidth: sw } = useAppStore.getState();
      const xs = drawPoints.map((p) => p.x);
      const ys = drawPoints.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const padding = sw + 2;

      const pathData = drawPoints
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x - minX + padding} ${p.y - minY + padding}`)
        .join(" ");

      useAppStore.getState().addItem({
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: "drawing",
        x: minX - padding,
        y: minY - padding,
        width: Math.max(maxX - minX + padding * 2, 20),
        height: Math.max(maxY - minY + padding * 2, 20),
        src: "",
        drawingPaths: pathData,
        strokeColor: color,
        strokeWidth: sw,
        createdAt: new Date().toISOString(),
      });
    }
    setIsDrawing(false);
    setDrawPoints([]);
  }, [isDrawing, drawPoints, marquee, items, panX, panY, zoom, selectItems]);

  // Zoom with scroll — zooms toward screen center
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const newZoom = Math.max(0.1, Math.min(3, zoom + delta));
      if (newZoom === zoom) return;

      // Zoom toward screen center: adjust pan so the center point stays fixed
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const scale = newZoom / zoom;
      const newPanX = cx - scale * (cx - panX);
      const newPanY = cy - scale * (cy - panY);

      setPan(newPanX, newPanY);
      setZoom(newZoom);
    },
    [zoom, panX, panY, setZoom, setPan]
  );

  // Item drag start (or connect)
  const handleItemDragStart = useCallback(
    (id: string, e: React.MouseEvent) => {
      // If space is held, pan instead of drag
      if (spaceHeld) return;

      // Connect tool: handle connection creation
      if (activeCanvasTool === "connect") {
        e.stopPropagation();
        const { connectingFromId: fromId } = useAppStore.getState();
        if (fromId) {
          if (fromId !== id) {
            useAppStore.getState().addConnection(fromId, id);
          }
          useAppStore.getState().setConnectingFromId(null);
        } else {
          useAppStore.getState().setConnectingFromId(id);
        }
        selectItem(id);
        return;
      }

      const item = items.find((i) => i.id === id);
      if (!item) return;
      e.stopPropagation();
      // Push undo before drag so undo restores pre-drag position
      useAppStore.getState().pushUndo();
      selectItem(id);
      setDragId(id);
      setDragOffset({
        x: e.clientX - panX - item.x * zoom,
        y: e.clientY - panY - item.y * zoom,
      });
    },
    [items, panX, panY, zoom, selectItem, spaceHeld, activeCanvasTool]
  );

  // Item resize start
  const [resizeEdge, setResizeEdge] = useState("se");
  const [resizeItemStart, setResizeItemStart] = useState({ x: 0, y: 0 });
  const handleResizeStart = useCallback(
    (id: string, e: React.MouseEvent, edge: string) => {
      e.stopPropagation();
      e.preventDefault();
      const item = items.find((i) => i.id === id);
      if (!item) return;
      // Push undo before resize
      useAppStore.getState().pushUndo();
      setResizeId(id);
      setResizeEdge(edge);
      setResizeStart({ x: e.clientX, y: e.clientY, w: item.width, h: item.height });
      setResizeItemStart({ x: item.x, y: item.y });
    },
    [items]
  );

  // Item double-click => zoom preview (or edit text)
  const handleItemDoubleClick = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      // Text items: don't open zoom preview (editing is handled in BoardItemCard)
      if (item.type === "text") return;
      setPreviewItem(item);
    },
    [items]
  );

  // Paste from clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Ignore pastes that originate inside the AI panel or any text input —
      // the AI panel has its own paste handler that should receive the file.
      const active = document.activeElement as HTMLElement | null;
      const target = e.target as HTMLElement | null;
      const insideAIPanel = !!(
        (active && active.closest?.("[data-ai-panel]")) ||
        (target && target.closest?.("[data-ai-panel]"))
      );
      const inEditable = active && (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        (active as HTMLElement).isContentEditable
      );
      if (insideAIPanel || inEditable) return;

      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (const clipItem of Array.from(clipboardItems)) {
        if (clipItem.type.startsWith("image/")) {
          e.preventDefault();
          const file = clipItem.getAsFile();
          if (!file) continue;

          // Show placeholder immediately with data URI (survives refresh unlike blob URLs)
          const placeholderId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            const dataUri = readerEvent.target?.result as string;
            const tempImg = new window.Image();
            tempImg.onload = () => {
              const maxW = 500;
              const scale = tempImg.naturalWidth > maxW ? maxW / tempImg.naturalWidth : 1;
              const w = Math.round(tempImg.naturalWidth * scale);
              const h = Math.round(tempImg.naturalHeight * scale);
              addItem({
                id: placeholderId,
                type: "image",
                x: (-panX + window.innerWidth / 2 - w / 2) / zoom,
                y: (-panY + window.innerHeight / 2 - h / 2) / zoom,
                width: w,
                height: h,
                src: dataUri,
                fileName: file.name,
                sizeBytes: file.size,
                createdAt: new Date().toISOString(),
              });
              // Upload in background, replace data URI with hosted URL
              uploadFile(file).then((url) => {
                useAppStore.getState().updateItem(placeholderId, { src: url });
              });
            };
            tempImg.src = dataUri;
          };
          reader.readAsDataURL(file);
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addItem, panX, panY, zoom]);

  // Drop files onto canvas
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      files.forEach(async (file, i) => {
        const baseX = (e.clientX - canvasRect.left - panX) / zoom + i * 20;
        const baseY = (e.clientY - canvasRect.top - panY) / zoom + i * 20;

        // PSD file handling
        if (file.name.toLowerCase().endsWith(".psd")) {
          try {
            const buffer = await file.arrayBuffer();
            const parsed = parsePsdBuffer(buffer);
            const groupId = `psd_${Date.now()}`;
            const maxW = 500;
            const scale = parsed.width > maxW ? maxW / parsed.width : 1;

            parsed.layers.forEach((layer) => {
              if (layer.hidden) return;
              addItem({
                id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                type: "psd-layer",
                x: baseX + layer.left * scale,
                y: baseY + layer.top * scale,
                width: Math.round(layer.width * scale),
                height: Math.round(layer.height * scale),
                src: layer.dataUrl,
                fileName: layer.name,
                psdGroupId: groupId,
                psdLayerName: layer.name,
                psdLayerOrder: layer.order,
                psdBlendMode: layer.blendMode,
                psdOpacity: layer.opacity,
                psdHidden: layer.hidden,
                createdAt: new Date().toISOString(),
              });
            });
          } catch (err) {
            console.error("Failed to parse PSD:", err);
          }
          return;
        }

        let type: BoardItem["type"] = "image";
        if (file.type.startsWith("video/")) type = "video";
        else if (file.type.startsWith("audio/")) type = "audio";

        // Show instant local preview, upload in background
        const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const localUrl = URL.createObjectURL(file);

        if (type === "image") {
          const img = new window.Image();
          img.onload = () => {
            const maxW = 500;
            const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
            addItem({
              id: itemId,
              type,
              x: baseX, y: baseY,
              width: Math.round(img.naturalWidth * scale),
              height: Math.round(img.naturalHeight * scale),
              src: localUrl, fileName: file.name,
              sizeBytes: file.size,
              createdAt: new Date().toISOString(),
            });
            // Upload in background
            uploadFile(file).then((url) => {
              useAppStore.getState().updateItem(itemId, { src: url });
              URL.revokeObjectURL(localUrl);
            });
          };
          img.src = localUrl;
        } else if (type === "video") {
          const vid = document.createElement("video");
          vid.preload = "metadata";
          vid.onloadedmetadata = () => {
            const maxW = 500;
            const scale = vid.videoWidth > maxW ? maxW / vid.videoWidth : 1;
            addItem({
              id: itemId, type,
              x: baseX, y: baseY,
              width: Math.round(vid.videoWidth * scale),
              height: Math.round(vid.videoHeight * scale),
              src: localUrl, fileName: file.name,
              sizeBytes: file.size,
              createdAt: new Date().toISOString(),
            });
            uploadFile(file).then((url) => {
              useAppStore.getState().updateItem(itemId, { src: url });
              URL.revokeObjectURL(localUrl);
            });
          };
          vid.src = localUrl;
        } else {
            addItem({
              id: itemId,
              type,
              x: baseX, y: baseY,
              width: 280, height: 80,
              src: localUrl, fileName: file.name,
              sizeBytes: file.size,
              createdAt: new Date().toISOString(),
            });
            uploadFile(file).then((url) => {
              useAppStore.getState().updateItem(itemId, { src: url });
              URL.revokeObjectURL(localUrl);
            });
          }
      });
    },
    [addItem, panX, panY, zoom]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const cursorClass = spaceHeld || isPanning
    ? "cursor-grabbing"
    : activeCanvasTool === "draw" ? "cursor-crosshair"
    : activeCanvasTool === "text" ? "cursor-text"
    : activeCanvasTool === "connect" ? "cursor-crosshair"
    : "cursor-default";

  return (
    <div
      className={`relative h-screen overflow-hidden transition-[width] duration-200 ${isDark ? "bg-[#0d1117]" : "bg-white"}`}
      style={{ width: isAIPromptOpen ? `calc(100vw - ${aiPanelWidth}px)` : "100vw" }}
    >
      {/* Canvas area */}
      <div
        ref={canvasRef}
        data-canvas="true"
        className={`absolute inset-0 ${cursorClass}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => {
          // Suppress native right-click menu on canvas so marquee drag works
          const target = e.target as HTMLElement;
          if (target === canvasRef.current || !!target.dataset.canvas) {
            e.preventDefault();
          }
        }}
        onWheel={handleWheel}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            const touch = e.touches[0];
            const target = touch.target as HTMLElement;
            const isCanvas = target === canvasRef.current || !!target.dataset.canvas;
            if (isCanvas) {
              selectItem(null);
              setIsPanning(true);
              setPanStart({ x: touch.clientX - panX, y: touch.clientY - panY });
            }
          }
        }}
        onTouchMove={(e) => {
          if (isPanning && e.touches.length === 1) {
            const touch = e.touches[0];
            setPan(touch.clientX - panStart.x, touch.clientY - panStart.y);
          }
          if (e.touches.length === 2) {
            // Pinch to zoom
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const el = canvasRef.current as HTMLElement & { _lastPinchDist?: number };
            if (el._lastPinchDist) {
              const delta = (dist - el._lastPinchDist) * 0.005;
              setZoom(zoom + delta);
            }
            el._lastPinchDist = dist;
          }
        }}
        onTouchEnd={(e) => {
          setIsPanning(false);
          setDragId(null);
          setResizeId(null);
          const el = canvasRef.current as HTMLElement & { _lastPinchDist?: number };
          if (el) el._lastPinchDist = undefined;
          if (e.touches.length === 0) {
            // All fingers lifted
          }
        }}
        style={{ touchAction: "none" }}
      >
        {/* Grid pattern — perspective dots */}
        <div
          className="absolute inset-0"
          data-canvas="true"
          style={{
            backgroundImage: `radial-gradient(circle, ${isDark ? "rgba(255,255,255,0.08)" : "rgba(13,17,23,0.12)"} 1.2px, transparent 1.2px)`,
            backgroundSize: `${30 * zoom}px ${30 * zoom}px`,
            backgroundPosition: `${panX}px ${panY}px`,
          }}
        />
        {/* Subtle radial gradient for depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          data-canvas="true"
          style={{
            background: isDark
              ? `radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.3) 100%)`
              : `radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(8,19,31,0.04) 100%)`,
          }}
        />

        {/* Transform container */}
        <div
          data-canvas="true"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Connection lines */}
          <svg className="absolute pointer-events-none" style={{ overflow: "visible", left: 0, top: 0, width: 1, height: 1 }}>
            {connections.map((conn) => {
              const fromItem = items.find((i) => i.id === conn.fromId);
              const toItem = items.find((i) => i.id === conn.toId);
              if (!fromItem || !toItem) return null;
              const x1 = fromItem.x + fromItem.width / 2;
              const y1 = fromItem.y + fromItem.height / 2;
              const x2 = toItem.x + toItem.width / 2;
              const y2 = toItem.y + toItem.height / 2;
              return (
                <g
                  key={conn.id}
                  onClick={(e) => { e.stopPropagation(); useAppStore.getState().removeConnection(conn.id); }}
                  style={{ cursor: "pointer", pointerEvents: "stroke" }}
                >
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isDark ? "#f26522" : "#f26522"} strokeWidth={2} strokeDasharray="8 4" opacity={0.7} />
                  {/* Wider invisible hit area for clicking */}
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} />
                  {/* Small dot at midpoint */}
                  <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={4} fill="#f26522" opacity={0.5} />
                </g>
              );
            })}
          </svg>

          {/* Active drawing preview */}
          {isDrawing && drawPoints.length > 1 && (
            <svg className="absolute pointer-events-none" style={{ overflow: "visible", left: 0, top: 0, width: 1, height: 1 }}>
              <path
                d={drawPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                fill="none"
                stroke={drawingColor}
                strokeWidth={drawingStrokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {items.map((item) => (
            <BoardItemCard
              key={item.id}
              item={item}
              isSelected={item.id === selectedItemId || selectedItemIds.includes(item.id)}
              isConnecting={activeCanvasTool === "connect" && connectingFromId === item.id}
              onMouseDown={(e) => handleItemDragStart(item.id, e)}
              onDoubleClick={() => handleItemDoubleClick(item.id)}
              onResizeStart={(e, edge) => handleResizeStart(item.id, e, edge)}
            />
          ))}
        </div>
      </div>

      {/* Top toolbar */}
      <Toolbar />

      {/* Bottom prompt bar */}
      <PromptBar />

      {/* Model panel */}
      <ModelPanel />

      {/* Edit panel */}
      <EditPanel />

      {/* Templates panel */}
      <TemplatesPanel />
      <ProfilePanel />
      <HistoryPanel />
      <AIPromptPanel />
      <FoldersPanel />
      <Minimap />
      <UILayer />

      {/* Marquee selection rectangle (right-click drag) */}
      {marquee && (
        <div
          className="pointer-events-none fixed z-[40] border border-[#f26522] bg-[#f26522]/10"
          style={{
            left: Math.min(marquee.x1, marquee.x2),
            top: Math.min(marquee.y1, marquee.y2),
            width: Math.abs(marquee.x2 - marquee.x1),
            height: Math.abs(marquee.y2 - marquee.y1),
          }}
        />
      )}

      {/* Bulk action bar — appears when multiple items are selected */}
      {selectedItemIds.length > 1 && !marquee && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-[45] flex items-center gap-1 rounded-xl border px-2 py-1.5 shadow-xl backdrop-blur-md pointer-events-auto ${
            isDark ? "bg-[#161b22]/90 border-gray-700" : "bg-white/90 border-gray-200"
          }`}
        >
          <span className={`text-[11px] font-semibold px-2 ${isDark ? "text-white" : "text-[#0d1117]"}`}>
            {selectedItemIds.length} selected
          </span>
          <div className={`h-4 w-px mx-1 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          <button
            type="button"
            title="Download all"
            onClick={async () => {
              const selected = items.filter((it) => selectedItemIds.includes(it.id));
              for (let i = 0; i < selected.length; i++) {
                const it = selected[i];
                const url = it.outputUrl || it.src;
                if (!url) continue;
                try {
                  const res = await fetch(url);
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  const ext = it.type === "video" || it.outputType === "video" ? "mp4"
                    : it.type === "audio" || it.outputType === "audio" ? "mp3" : "png";
                  a.download = it.fileName || `motionboards-${it.id}.${ext}`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(a.href);
                  // Stagger so the browser doesn't block the bulk download
                  await new Promise((r) => setTimeout(r, 250));
                } catch {
                  // skip silently
                }
              }
            }}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              isDark ? "text-gray-300 hover:bg-white/10 hover:text-white" : "text-gray-600 hover:bg-gray-100 hover:text-[#0d1117]"
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            type="button"
            title="Copy (Ctrl+C)"
            onClick={() => useAppStore.getState().copySelectedItems()}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              isDark ? "text-gray-300 hover:bg-white/10 hover:text-white" : "text-gray-600 hover:bg-gray-100 hover:text-[#0d1117]"
            }`}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
          <button
            type="button"
            title={organizeMode ? "Exit organize mode (Esc)" : "Organize — ↑↓ pick item · ←→ nudge · Enter auto-pack"}
            onClick={() => useAppStore.getState().toggleOrganizeMode()}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              organizeMode
                ? "bg-[#f26522]/15 text-[#f26522]"
                : isDark ? "text-gray-300 hover:bg-white/10 hover:text-white" : "text-gray-600 hover:bg-gray-100 hover:text-[#0d1117]"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {organizeMode ? "Organizing" : "Organize"}
          </button>
          <button
            type="button"
            title="Delete (Del)"
            onClick={() => {
              if (confirm(`Delete ${selectedItemIds.length} items?`)) {
                useAppStore.getState().removeSelectedItems();
              }
            }}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <div className={`h-4 w-px mx-1 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          <button
            type="button"
            title="Deselect all (Esc)"
            onClick={() => useAppStore.getState().selectItems([])}
            className={`rounded-lg p-1.5 transition-colors ${
              isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"
            }`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Organize mode hint — keyboard legend under the bulk bar */}
      {organizeMode && selectedItemIds.length > 1 && !marquee && (
        <div
          className={`fixed top-[84px] left-1/2 -translate-x-1/2 z-[45] rounded-lg border px-3 py-1.5 text-[10px] shadow-md backdrop-blur-md pointer-events-none flex items-center gap-2 ${
            isDark ? "bg-[#161b22]/95 border-[#f26522]/40 text-gray-300" : "bg-white/95 border-[#f26522]/40 text-gray-700"
          }`}
        >
          <kbd className={`px-1 rounded ${isDark ? "bg-white/10" : "bg-black/10"}`}>↑↓</kbd>
          <span>pick item</span>
          <span className="opacity-30">·</span>
          <kbd className={`px-1 rounded ${isDark ? "bg-white/10" : "bg-black/10"}`}>←→</kbd>
          <span>nudge</span>
          <span className="opacity-30">·</span>
          <kbd className={`px-1 rounded ${isDark ? "bg-white/10" : "bg-black/10"}`}>Enter</kbd>
          <span>auto-pack</span>
          <span className="opacity-30">·</span>
          <kbd className={`px-1 rounded ${isDark ? "bg-white/10" : "bg-black/10"}`}>Esc</kbd>
          <span>exit</span>
        </div>
      )}

      {/* Organize active-item ring — a pulsing amber outline over the item
          currently being controlled by the keyboard. Rendered in screen space
          so it tracks pan/zoom through the same transform as the canvas. */}
      {organizeMode && organizeActiveId && (() => {
        const it = items.find((i) => i.id === organizeActiveId);
        if (!it) return null;
        const pad = 6;
        const iw = it.width || 200;
        const ih = it.height || 200;
        return (
          <div
            className="pointer-events-none fixed z-[5] rounded-[6px] border-2 border-amber-400 animate-pulse"
            style={{
              left: panX + (it.x - pad) * zoom,
              top: panY + (it.y - pad) * zoom,
              width: (iw + pad * 2) * zoom,
              height: (ih + pad * 2) * zoom,
              boxShadow: "0 0 20px rgba(251,191,36,0.35)",
            }}
          />
        );
      })()}

      {/* Zoom preview */}
      {previewItem && (
        <ZoomPreview item={previewItem} onClose={() => setPreviewItem(null)} />
      )}
    </div>
  );
}
