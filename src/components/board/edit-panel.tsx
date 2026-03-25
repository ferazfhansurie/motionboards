"use client";

import { useCallback } from "react";
import {
  Sun,
  Contrast,
  Droplets,
  Palette,
  Crop,
  RotateCcw,
  Check,
  X,
} from "lucide-react";
import { useAppStore, defaultEditState } from "@/lib/store";
import { Slider } from "@/components/ui/slider";

interface FilterRow {
  key: "brightness" | "contrast" | "saturate" | "hueRotate";
  label: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  defaultVal: number;
  unit: string;
}

const filters: FilterRow[] = [
  { key: "brightness", label: "Brightness", icon: <Sun className="h-3 w-3" />, min: 0, max: 200, defaultVal: 100, unit: "%" },
  { key: "contrast", label: "Contrast", icon: <Contrast className="h-3 w-3" />, min: 0, max: 200, defaultVal: 100, unit: "%" },
  { key: "saturate", label: "Saturation", icon: <Droplets className="h-3 w-3" />, min: 0, max: 200, defaultVal: 100, unit: "%" },
  { key: "hueRotate", label: "Hue", icon: <Palette className="h-3 w-3" />, min: 0, max: 360, defaultVal: 0, unit: "°" },
];

export function EditPanel() {
  const {
    isEditMode,
    setEditMode,
    isCropMode,
    setCropMode,
    selectedItemId,
    items,
    updateEditState,
    resetEditState,
    applyEditState,
  } = useAppStore();

  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) : null;
  const isImageType = selectedItem && (selectedItem.type === "image" || selectedItem.type === "psd-layer" || (selectedItem.type === "generation" && selectedItem.outputType === "image"));

  if (!isEditMode || !selectedItem || !isImageType) return null;

  const editState = selectedItem.editState || defaultEditState;

  const handleApply = async () => {
    if (!selectedItem.editState) {
      setEditMode(false);
      return;
    }

    // Rasterize filters through canvas
    const imgSrc = selectedItem.outputUrl || selectedItem.src;
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const { cropX, cropY, cropW, cropH, brightness, contrast, saturate, hueRotate } = selectedItem.editState!;

      const srcX = cropX * img.naturalWidth;
      const srcY = cropY * img.naturalHeight;
      const srcW = cropW * img.naturalWidth;
      const srcH = cropH * img.naturalHeight;

      canvas.width = Math.round(srcW);
      canvas.height = Math.round(srcH);

      const ctx = canvas.getContext("2d")!;
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hueRotate}deg)`;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

      const newSrc = canvas.toDataURL("image/png");
      applyEditState(selectedItem.id, newSrc);
      setEditMode(false);
    };

    img.src = imgSrc;
  };

  const handleReset = () => {
    resetEditState(selectedItem.id);
  };

  const handleCancel = () => {
    resetEditState(selectedItem.id);
    setEditMode(false);
    setCropMode(false);
  };

  return (
    <div className="absolute left-3 bottom-16 z-40 pointer-events-auto w-56">
      <div className="rounded-xl bg-[#0d1f30]/95 border border-white/10 backdrop-blur-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
          <span className="text-[11px] font-semibold text-neutral-200">Edit Image</span>
          <button
            onClick={handleCancel}
            className="rounded p-0.5 text-neutral-500 hover:text-neutral-300 hover:bg-[#0f2538] transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Filter sliders */}
        <div className="px-3 py-2.5 space-y-3">
          {filters.map((f) => (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-neutral-400">
                  {f.icon}
                  <span className="text-[10px]">{f.label}</span>
                </div>
                <span className="text-[10px] text-neutral-500 tabular-nums w-8 text-right">
                  {Math.round(editState[f.key])}{f.unit}
                </span>
              </div>
              <Slider
                min={f.min}
                max={f.max}
                value={[editState[f.key]]}
                onValueChange={(val) => {
                  const v = typeof val === "number" ? val : val[0];
                  updateEditState(selectedItem.id, { [f.key]: v });
                }}
              />
            </div>
          ))}
        </div>

        {/* Crop toggle */}
        <div className="px-3 py-2 border-t border-white/5">
          <button
            onClick={() => setCropMode(!isCropMode)}
            className={`flex items-center gap-1.5 w-full rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
              isCropMode
                ? "bg-[#f26522] text-white"
                : "bg-[#0f2538] text-neutral-400 hover:bg-[#0d1f30] hover:text-neutral-300"
            }`}
          >
            <Crop className="h-3 w-3" />
            {isCropMode ? "Cropping..." : "Crop"}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/5">
          <button
            onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 bg-[#0f2538] text-neutral-400 hover:bg-[#0d1f30] hover:text-neutral-300 text-[10px] font-medium transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
          <button
            onClick={handleApply}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 bg-green-600 text-white hover:bg-green-500 text-[10px] font-medium transition-colors"
          >
            <Check className="h-3 w-3" />
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
