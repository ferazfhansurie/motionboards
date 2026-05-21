"use client";

import { useRef } from "react";
import { ZoomIn, ZoomOut, Undo, Redo, HelpCircle, FileUp, Download, ScrollText, ImagePlus, Type, PenTool, MousePointer, Link2, Sun, Moon, FolderOpen, Users, MessageSquare, Library } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { parsePsdBuffer, buildPsdFromItems, downloadPsd } from "@/lib/psd";
import { requireAuth } from "@/lib/auth-gate";

export function Toolbar() {
  const { zoom, setZoom, setPan, panX, panY, items, addItem, boardName, undo, redo, undoStack, redoStack, activeCanvasTool, setActiveCanvasTool, theme, setTheme, drawingColor, setDrawingColor, drawingStrokeWidth, setDrawingStrokeWidth, isFoldersOpen, setFoldersOpen } = useAppStore();
  const isDark = theme === "dark";
  const psdInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const { panX, panY, zoom: z } = useAppStore.getState();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const localUrl = URL.createObjectURL(file);
      const baseX = (-panX + window.innerWidth / 2 - 150) / z + i * 30;
      const baseY = (-panY + window.innerHeight / 2 - 100) / z + i * 30;

      let type: "image" | "video" | "audio" = "image";
      if (file.type.startsWith("video/")) type = "video";
      else if (file.type.startsWith("audio/")) type = "audio";

      if (type === "image") {
        const img = new window.Image();
        img.onload = () => {
          const maxW = 500;
          const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
          addItem({
            id: itemId, type, x: baseX, y: baseY,
            width: Math.round(img.naturalWidth * scale),
            height: Math.round(img.naturalHeight * scale),
            src: localUrl, fileName: file.name,
            createdAt: new Date().toISOString(),
          });
          // Upload in background
          uploadFileToStorage(file).then((url) => {
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
            id: itemId, type, x: baseX, y: baseY,
            width: Math.round(vid.videoWidth * scale),
            height: Math.round(vid.videoHeight * scale),
            src: localUrl, fileName: file.name,
            createdAt: new Date().toISOString(),
          });
          uploadFileToStorage(file).then((url) => {
            useAppStore.getState().updateItem(itemId, { src: url });
            URL.revokeObjectURL(localUrl);
          });
        };
        vid.src = localUrl;
      } else {
        addItem({
          id: itemId, type, x: baseX, y: baseY,
          width: 280, height: 80,
          src: localUrl, fileName: file.name,
          createdAt: new Date().toISOString(),
        });
        uploadFileToStorage(file).then((url) => {
          useAppStore.getState().updateItem(itemId, { src: url });
          URL.revokeObjectURL(localUrl);
        });
      }
    }
    e.target.value = "";
  };

  async function uploadFileToStorage(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) return data.url;
    } catch {}
    return URL.createObjectURL(file);
  }

  const handleImportPsd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parsePsdBuffer(buffer);
      const groupId = `psd_${Date.now()}`;
      const maxW = 500;
      const scale = parsed.width > maxW ? maxW / parsed.width : 1;
      const { panX, panY, zoom: z } = useAppStore.getState();
      const baseX = (-panX + window.innerWidth / 2 - (parsed.width * scale) / 2) / z;
      const baseY = (-panY + window.innerHeight / 2 - (parsed.height * scale) / 2) / z;

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
      console.error("Failed to import PSD:", err);
    }

    e.target.value = "";
  };

  const handleExportPsd = async () => {
    const imageItems = items.filter(
      (i) =>
        i.type === "image" ||
        i.type === "psd-layer" ||
        (i.type === "generation" && i.outputType === "image" && i.outputUrl)
    );

    if (imageItems.length === 0) return;

    // Calculate bounding box
    const minX = Math.min(...imageItems.map((i) => i.x));
    const minY = Math.min(...imageItems.map((i) => i.y));
    const maxX = Math.max(...imageItems.map((i) => i.x + i.width));
    const maxY = Math.max(...imageItems.map((i) => i.y + i.height));

    // Normalize positions to start at 0,0
    const normalized = imageItems.map((i) => ({
      ...i,
      x: i.x - minX,
      y: i.y - minY,
    }));

    try {
      const buffer = await buildPsdFromItems(
        normalized,
        Math.round(maxX - minX),
        Math.round(maxY - minY)
      );
      downloadPsd(buffer, `${boardName || "MotionBoards"}.psd`);
    } catch (err) {
      console.error("Failed to export PSD:", err);
    }
  };

  const btnBase = `rounded p-1.5 transition-colors`;
  const btnInactive = isDark
    ? "text-gray-400 hover:bg-white/10 hover:text-white"
    : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]";
  const btnActive = isDark
    ? "bg-white/10 text-white"
    : "bg-gray-100 text-[#0d1117]";
  const btnAccent = "bg-[#f26522]/10 text-[#f26522]";

  // Buttons inside the orange capsule. In dark mode the capsule is solid
  // brand orange, so icons use white with white-tint hover/active; in light
  // mode we keep the neutral hover set so the peach tint still reads.
  const capInactive = isDark
    ? "text-white hover:bg-white/20"
    : btnInactive;
  const capActive = isDark
    ? "bg-white/25 text-white"
    : btnActive;
  const capAccent = isDark
    ? "bg-white/25 text-white"
    : btnAccent;
  const capDisabled = isDark
    ? "text-white/40 cursor-not-allowed"
    : "text-gray-300 cursor-not-allowed";
  const capSeparator = isDark ? "bg-white/25" : "bg-gray-200";

  return (
    <>
      {/* Top-left: Logo + actions.
          Mobile: tighter gaps, smaller logo, capped width with horizontal
          scroll so the capsule never collides with the right cluster. */}
      <div
        className="absolute left-2 md:left-3 top-2 md:top-3 z-30 flex items-center gap-1 md:gap-2 pointer-events-auto rounded-xl px-1.5 md:px-2 py-1 md:py-1.5 backdrop-blur-md border shadow-sm overflow-x-auto max-w-[calc(100vw-130px)] md:max-w-none no-scrollbar"
        style={{
          // Sleeker neutral pill — was loud orange. Dark / light translucent
          // backgrounds with a subtle border, so the toolbar reads as chrome
          // not as a feature.
          backgroundColor: isDark ? "rgba(13,17,23,0.85)" : "rgba(255,255,255,0.85)",
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          marginTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="flex items-center px-0.5 md:px-1 py-0.5 rounded-lg shrink-0">
          <img src="/logo.jpg" alt="MotionBoards" className="h-8 md:h-12 w-auto rounded-lg" />
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 ml-2">
          <button
            className={`${btnBase} ${undoStack.length > 0 ? capInactive : capDisabled}`}
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-3.5 w-3.5" />
          </button>
          <button
            className={`${btnBase} ${redoStack.length > 0 ? capInactive : capDisabled}`}
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Separator */}
        <div className={`h-4 w-px mx-1 ${capSeparator}`} />

        {/* Canvas tools: Select, Text, Draw, Connect */}
        <div className="flex items-center gap-0.5">
          <button
            className={`${btnBase} ${!activeCanvasTool || activeCanvasTool === "select" ? capActive : capInactive}`}
            onClick={() => setActiveCanvasTool("select")}
            title="Select (V)"
          >
            <MousePointer className="h-3.5 w-3.5" />
          </button>
          <button
            className={`${btnBase} ${activeCanvasTool === "text" ? capAccent : capInactive}`}
            onClick={() => setActiveCanvasTool(activeCanvasTool === "text" ? "select" : "text")}
            title="Add Text (T)"
          >
            <Type className="h-3.5 w-3.5" />
          </button>
          <button
            className={`${btnBase} ${activeCanvasTool === "draw" ? capAccent : capInactive}`}
            onClick={() => setActiveCanvasTool(activeCanvasTool === "draw" ? "select" : "draw")}
            title="Draw (D)"
          >
            <PenTool className="h-3.5 w-3.5" />
          </button>
          <button
            className={`${btnBase} ${activeCanvasTool === "connect" ? capAccent : capInactive}`}
            onClick={() => {
              setActiveCanvasTool(activeCanvasTool === "connect" ? "select" : "connect");
              useAppStore.getState().setConnectingFromId(null);
            }}
            title="Connect Items (L)"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Drawing controls — visible when draw tool active */}
        {activeCanvasTool === "draw" && (
          <>
            <div className={`h-4 w-px mx-1 ${capSeparator}`} />
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={drawingColor}
                onChange={(e) => setDrawingColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                title="Stroke color"
              />
              <select
                value={drawingStrokeWidth}
                onChange={(e) => setDrawingStrokeWidth(Number(e.target.value))}
                className={`text-[10px] rounded px-1 py-0.5 border ${isDark ? "bg-white/10 text-white border-white/20" : "bg-white text-gray-700 border-gray-200"}`}
                title="Stroke width"
              >
                <option value={1}>1px</option>
                <option value={2}>2px</option>
                <option value={3}>3px</option>
                <option value={5}>5px</option>
                <option value={8}>8px</option>
                <option value={12}>12px</option>
              </select>
            </div>
          </>
        )}

        {/* Separator */}
        <div className={`h-4 w-px mx-1 ${capSeparator}`} />

        {/* Upload + PSD Import/Export */}
        <div className="flex items-center gap-0.5">
          <button
            className={`${btnBase} ${capInactive}`}
            onClick={() => uploadInputRef.current?.click()}
            title="Upload files to canvas — files auto-delete after 14 days"
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            className={`${btnBase} ${capInactive}`}
            onClick={() => psdInputRef.current?.click()}
            title="Import PSD"
          >
            <FileUp className="h-3.5 w-3.5" />
          </button>
          <input
            ref={psdInputRef}
            type="file"
            accept=".psd"
            className="hidden"
            onChange={handleImportPsd}
          />
          <button
            className={`${btnBase} ${capInactive}`}
            onClick={handleExportPsd}
            title="Export as PSD"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            className={`${btnBase} ${isFoldersOpen ? capAccent : capInactive}`}
            onClick={() => setFoldersOpen(!isFoldersOpen)}
            title="Folders"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Top-right: Zoom controls + theme toggle. On mobile we keep only
          zoom + theme; the external-link buttons (logs, community, WhatsApp,
          tutorials) are hidden below md since they all exist in the Profile
          panel / dedicated routes anyway. */}
      <div className="absolute right-2 md:right-3 top-2 md:top-3 z-30 flex items-center gap-1 md:gap-1.5 pointer-events-auto">
        <div
          className="flex items-center gap-0.5 rounded-lg border p-0.5 shadow-sm"
          style={{
            backgroundColor: isDark ? "#f26522" : "rgba(242,101,34,0.22)",
            borderColor: isDark ? "#f26522" : "rgba(242,101,34,0.4)",
          }}
        >
          <button
            className={`rounded p-1 transition-colors ${capInactive}`}
            onClick={() => {
              const nz = Math.max(0.1, zoom - 0.1);
              const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
              const s = nz / zoom;
              setPan(cx - s * (cx - panX), cy - s * (cy - panY));
              setZoom(nz);
            }}
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <button
            className={`min-w-[2.5rem] px-1 text-center text-[10px] font-medium rounded py-0.5 transition-colors ${isDark ? "text-white hover:bg-white/20" : "text-[#374151] hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={() => { setZoom(1); setPan(0, 0); }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className={`rounded p-1 transition-colors ${capInactive}`}
            onClick={() => {
              const nz = Math.min(3, zoom + 0.1);
              const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
              const s = nz / zoom;
              setPan(cx - s * (cx - panX), cy - s * (cy - panY));
              setZoom(nz);
            }}
          >
            <ZoomIn className="h-3 w-3" />
          </button>
        </div>

        {/* Dark/Light mode toggle */}
        <button
          className={`rounded-lg p-1.5 transition-colors ${btnInactive}`}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <button
          className={`hidden md:inline-flex rounded-lg p-1.5 transition-colors ${btnInactive}`}
          title="Media Library"
          onClick={() => window.open("/media", "_blank")}
        >
          <Library className="h-3.5 w-3.5" />
        </button>

        <button
          className={`hidden md:inline-flex rounded-lg p-1.5 transition-colors ${btnInactive}`}
          title="Generation Logs"
          onClick={() => window.open("/logs", "_blank")}
        >
          <ScrollText className="h-3.5 w-3.5" />
        </button>

        <button
          className={`hidden md:inline-flex rounded-lg p-1.5 transition-colors ${btnInactive}`}
          title="Community"
          onClick={() => window.open("/community", "_blank")}
        >
          <Users className="h-3.5 w-3.5" />
        </button>

        <button
          className={`hidden md:inline-flex rounded-lg p-1.5 transition-colors ${btnInactive}`}
          title="WhatsApp AI"
          onClick={() => window.open("/whatsapp", "_blank")}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>

        <button
          className={`hidden md:inline-flex rounded-lg p-1.5 transition-colors ${btnInactive}`}
          title="Tutorials & Help"
          onClick={() => window.open("/tutorials", "_blank")}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Hide the native scrollbar on the left capsule so horizontal overflow
          scroll still works on mobile without an ugly bar. */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
    </>
  );
}
