"use client";

import { useRef } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Undo, Redo, HelpCircle, FileUp, Download, ScrollText } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { parsePsdBuffer, buildPsdFromItems, downloadPsd } from "@/lib/psd";

export function Toolbar() {
  const { zoom, setZoom, setPan, items, addItem, boardName } = useAppStore();
  const psdInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
      {/* Top-left: Logo + actions */}
      <div className="absolute left-3 top-3 z-30 flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center px-1 py-0.5 rounded-lg">
          <img src="/logo.jpg" alt="MotionBoards" className="h-10 rounded" />
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 ml-2">
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors">
            <Undo className="h-3.5 w-3.5" />
          </button>
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors">
            <Redo className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-gray-200 mx-1" />

        {/* PSD Import/Export */}
        <div className="flex items-center gap-0.5">
          <button
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
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
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
            onClick={handleExportPsd}
            title="Export as PSD"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Top-right: Zoom controls */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5 pointer-events-auto">
        <div className="flex items-center gap-0.5 rounded-lg bg-white border border-gray-200 p-0.5 shadow-sm">
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
            onClick={() => setZoom(zoom - 0.1)}
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <button
            className="min-w-[2.5rem] px-1 text-center text-[10px] font-medium text-[#374151] hover:bg-gray-100 hover:text-[#0d1117] rounded py-0.5 transition-colors"
            onClick={() => { setZoom(1); setPan(0, 0); }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
            onClick={() => setZoom(zoom + 0.1)}
          >
            <ZoomIn className="h-3 w-3" />
          </button>
        </div>

        <button
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
          title="Generation Logs"
          onClick={() => window.open("/logs", "_blank")}
        >
          <ScrollText className="h-3.5 w-3.5" />
        </button>

        <button
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
          title="Help"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}
