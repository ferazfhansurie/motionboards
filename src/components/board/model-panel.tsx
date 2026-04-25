"use client";

import { useState, useMemo } from "react";
import { X, Check, ImageIcon, Film, Volume2, Mic, Info } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { models, modelCategories, type ModelCategory, type AIModel } from "@/lib/models";
import { ModelGuideDialog } from "./model-guide-dialog";

// Category tabs — icon + label. Compact, no text search because there are
// only a handful of models now (top 2 per category by price).
const CATEGORY_ICON: Record<ModelCategory, typeof ImageIcon> = {
  Image: ImageIcon,
  Video: Film,
  "Sound Effects": Volume2,
  Voice: Mic,
};

export function ModelPanel() {
  const { isModelPanelOpen, setModelPanelOpen, selectedModelId, setSelectedModel, theme } = useAppStore();
  const isDark = theme === "dark";
  const [activeCategory, setActiveCategory] = useState<ModelCategory>("Image");
  const [guideModel, setGuideModel] = useState<AIModel | null>(null);

  // Group models by category, dedupe by base name so I2V/S2E variants appear
  // as "modes" under a single model card instead of separate rows.
  const grouped = useMemo(() => {
    const map = new Map<ModelCategory, typeof models>();
    for (const cat of modelCategories) map.set(cat, []);
    for (const m of models) map.get(m.category)?.push(m);
    return map;
  }, []);

  if (!isModelPanelOpen) return null;

  const visibleModels = grouped.get(activeCategory) || [];

  return (
    <div className="absolute right-2 bottom-12 z-[45] w-[380px]">
      <div
        className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-200"}`}
        style={{ boxShadow: isDark ? "0 20px 40px rgba(0,0,0,0.5)" : "0 20px 40px rgba(0,0,0,0.08)" }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 ${isDark ? "border-b border-gray-800" : "border-b border-gray-100"}`}>
          <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-[#0d1117]"}`}>Models</h3>
          <button
            className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-500 hover:bg-white/5 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={() => setModelPanelOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category tabs — one line, icon + label */}
        <div className={`flex items-center gap-1 px-2 py-2 ${isDark ? "border-b border-gray-800" : "border-b border-gray-100"}`}>
          {modelCategories.map((cat) => {
            const Icon = CATEGORY_ICON[cat];
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-1 flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors ${
                  isActive
                    ? isDark ? "bg-[#f26522]/15 text-[#f26522]" : "bg-[#f26522]/10 text-[#f26522]"
                    : isDark ? "text-gray-500 hover:text-gray-300 hover:bg-white/5" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[9px] font-semibold tracking-wide">{cat}</span>
              </button>
            );
          })}
        </div>

        {/* Model list for the active category */}
        <div className="overflow-y-auto p-2" style={{ maxHeight: 360 }}>
          {visibleModels.length === 0 ? (
            <p className={`text-center py-6 text-[11px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              No models in this category yet.
            </p>
          ) : (
            <div className="space-y-1">
              {visibleModels.map((model) => {
                const isSelected = selectedModelId === model.id;
                const isDisabled = !!model.disabled;
                return (
                  <div key={model.id} className="relative group">
                    <button
                      type="button"
                      disabled={isDisabled}
                      title={isDisabled ? (model.disabledReason || "Unavailable") : undefined}
                      onClick={() => {
                        if (isDisabled) return;
                        setSelectedModel(model.id);
                        setModelPanelOpen(false);
                      }}
                      className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all ${
                        isDisabled
                          ? (isDark ? "border-transparent bg-white/[0.02] opacity-50 cursor-not-allowed" : "border-transparent bg-gray-50 opacity-50 cursor-not-allowed")
                          : isSelected
                            ? "bg-[#f26522]/10 border-[#f26522]/40"
                            : isDark ? "border-transparent hover:border-gray-700 hover:bg-white/[0.03]" : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[12px] font-semibold truncate ${isDisabled ? (isDark ? "text-gray-500" : "text-gray-400") : isSelected ? "text-[#f26522]" : isDark ? "text-white" : "text-[#0d1117]"}`}>
                              {model.name}
                            </span>
                            {isSelected && !isDisabled && (
                              <div className="h-3.5 w-3.5 rounded-full bg-[#f26522] flex items-center justify-center shrink-0">
                                <Check className="h-2 w-2 text-white" />
                              </div>
                            )}
                            {isDisabled && (
                              <span className={`rounded-full px-1.5 py-[1px] text-[8.5px] font-black uppercase tracking-wider ${isDark ? "bg-white/10 text-gray-400" : "bg-black/10 text-gray-500"}`}>
                                Unavailable
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] mt-0.5 line-clamp-2 pr-6 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                            {model.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0 pr-6">
                          <p className={`text-[11px] font-bold whitespace-nowrap ${isDisabled ? (isDark ? "text-gray-500" : "text-gray-400") : "text-[#f26522]"}`}>{model.cost}</p>
                          <p className={`text-[9px] mt-0.5 whitespace-nowrap ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                            {model.speed}
                          </p>
                        </div>
                      </div>
                    </button>
                    {/* Info button — opens detailed guide. Always visible to
                        signal it exists; doesn't fight the row's selection
                        button because of stopPropagation. */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setGuideModel(model); }}
                      title={`How to use ${model.name}`}
                      className={`absolute top-2 right-2 rounded-md p-1 transition-colors ${
                        isDark ? "text-gray-500 hover:bg-white/10 hover:text-[#f26522]" : "text-gray-400 hover:bg-gray-100 hover:text-[#f26522]"
                      }`}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className={`px-3 py-2 text-[9px] text-center ${isDark ? "border-t border-gray-800 text-gray-600" : "border-t border-gray-100 text-gray-400"}`}>
          {activeCategory === "Image" && "Top 2 cheapest image models"}
          {activeCategory === "Video" && "Top 2 cheapest video models (with i2v / s2e variants)"}
          {activeCategory === "Sound Effects" && "Ambient sound, SFX, music — text-to-audio"}
          {activeCategory === "Voice" && "Text-to-speech and voice cloning"}
        </div>
      </div>
      {guideModel && (
        <ModelGuideDialog model={guideModel} onClose={() => setGuideModel(null)} />
      )}
    </div>
  );
}
