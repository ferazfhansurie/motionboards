"use client";

import { useState } from "react";
import { X, Search, Star, Sparkles, Film, Wand2, ArrowUpRight, Palette, User, Mic, Music, Zap, Check } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  models,
  modelCategories,
  getModelsByCategory,
  getTypeLabel,
  type ModelCategory,
} from "@/lib/models";

const categoryIcons: Record<ModelCategory, React.ReactNode> = {
  "Cinematic Video Gen": <Film className="h-4 w-4" />,
  "Video Editing": <Wand2 className="h-4 w-4" />,
  "Upscale & Restoration": <ArrowUpRight className="h-4 w-4" />,
  "Concept Art & Style": <Palette className="h-4 w-4" />,
  "Character & Fashion": <User className="h-4 w-4" />,
  "Lip Sync": <Mic className="h-4 w-4" />,
  "Audio & Music": <Music className="h-4 w-4" />,
};

const recommendedModels = ["nano-banana-2", "veo-3.1-fast"];

// Map model types to color classes
function getTypeBadgeColors(type: string, isDark: boolean): string {
  if (type === "t2v" || type === "i2v" || type === "s2e" || type === "v2v") return isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700";
  if (type === "t2i" || type === "i2i") return isDark ? "bg-green-500/20 text-green-300" : "bg-green-100 text-green-700";
  if (type === "audio") return isDark ? "bg-purple-500/20 text-purple-300" : "bg-purple-100 text-purple-700";
  if (type === "upscale") return isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700";
  if (type === "lipsync") return isDark ? "bg-pink-500/20 text-pink-300" : "bg-pink-100 text-pink-700";
  return isDark ? "bg-gray-600 text-gray-300" : "bg-gray-100 text-gray-500";
}

export function ModelPanel() {
  const { isModelPanelOpen, setModelPanelOpen, selectedModelId, setSelectedModel, theme } =
    useAppStore();
  const isDark = theme === "dark";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ModelCategory | "all">("all");

  if (!isModelPanelOpen) return null;

  const filteredModels =
    activeCategory === "all"
      ? models.filter(
          (m) =>
            !search ||
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.description.toLowerCase().includes(search.toLowerCase())
        )
      : getModelsByCategory(activeCategory).filter(
          (m) =>
            !search ||
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.description.toLowerCase().includes(search.toLowerCase())
        );

  const categoryCounts = modelCategories.reduce(
    (acc, cat) => {
      acc[cat] = getModelsByCategory(cat).length;
      return acc;
    },
    {} as Record<ModelCategory, number>
  );

  return (
    <div className="absolute right-2 bottom-10 z-40 w-[520px]">
      <div className={`rounded-2xl border shadow-2xl overflow-hidden ${isDark ? "border-gray-700 bg-[#161b22]" : "border-gray-200 bg-white"}`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-4 py-2.5 ${isDark ? "border-gray-700" : "border-gray-100"}`}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#f26522] text-white">
                <Zap className="h-3 w-3" />
              </div>
              <h3 className={`text-xs font-bold ${isDark ? "text-white" : "text-[#0d1117]"}`}>AI Models</h3>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isDark ? "text-gray-400 bg-gray-800" : "text-gray-400 bg-gray-100"}`}>
              {models.length} available
            </span>
          </div>
          <button
            className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={() => setModelPanelOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className={`border-b px-4 py-2 ${isDark ? "border-gray-700" : "border-gray-100"}`}>
          <div className="relative">
            <Search className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-300"}`} />
            <input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs outline-none placeholder:text-gray-400 focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all ${isDark ? "bg-[#0d1117] border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-[#0d1117]"}`}
            />
          </div>
        </div>

        <div className="flex" style={{ maxHeight: "320px" }}>
          {/* Categories sidebar */}
          <div className={`w-40 shrink-0 border-r overflow-y-auto py-2 px-1.5 ${isDark ? "border-gray-700" : "border-gray-100"}`}>
            <button
              className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-all ${
                activeCategory === "all"
                  ? "bg-[#f26522] text-white shadow-sm shadow-[#f26522]/20"
                  : isDark ? "text-gray-400 hover:bg-white/5 hover:text-white" : "text-gray-500 hover:bg-gray-50 hover:text-[#0d1117]"
              }`}
              onClick={() => setActiveCategory("all")}
            >
              <Sparkles className="h-4 w-4" />
              <span className="flex-1">All Models</span>
              <span className={`text-[10px] ${activeCategory === "all" ? "text-white/70" : "text-gray-400"}`}>
                {models.length}
              </span>
            </button>

            <div className="my-2 px-2.5">
              <p className={`text-[8px] font-bold uppercase tracking-widest ${isDark ? "text-gray-600" : "text-gray-300"}`}>
                Categories
              </p>
            </div>

            {modelCategories.map((cat) => (
              <button
                key={cat}
                className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-[#f26522] text-white shadow-sm shadow-[#f26522]/20"
                    : isDark ? "text-gray-400 hover:bg-white/5 hover:text-white" : "text-gray-500 hover:bg-gray-50 hover:text-[#0d1117]"
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {categoryIcons[cat]}
                <span className="flex-1 truncate">{cat}</span>
                <span className={`text-[10px] ${activeCategory === cat ? "text-white/70" : "text-gray-400"}`}>
                  {categoryCounts[cat]}
                </span>
              </button>
            ))}
          </div>

          {/* Model grid */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-1.5">
              {filteredModels.map((model) => {
                const isSelected = selectedModelId === model.id;
                const isRecommended = recommendedModels.some((rm) => model.id.toLowerCase().includes(rm) || model.name.toLowerCase().includes(rm.replace(/-/g, " ")));
                return (
                  <button
                    key={model.id}
                    className={`group rounded-lg border p-2.5 text-left transition-all duration-200 ${
                      isSelected
                        ? isDark
                          ? "border-[#f26522] bg-[#f26522]/10 shadow-[0_0_20px_rgba(242,101,34,0.25)] ring-1 ring-[#f26522]/30"
                          : "border-[#f26522] bg-[#f26522]/5 shadow-[0_0_20px_rgba(242,101,34,0.15)] ring-1 ring-[#f26522]/20"
                        : isDark
                          ? "border-gray-700 bg-[#0d1117] hover:border-[#f26522]/40 hover:bg-gradient-to-br hover:from-[#f26522]/5 hover:to-transparent hover:shadow-md hover:-translate-y-0.5"
                          : "border-gray-200 bg-white hover:border-[#f26522]/40 hover:bg-gradient-to-br hover:from-[#f26522]/5 hover:to-transparent hover:shadow-md hover:-translate-y-0.5"
                    }`}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setModelPanelOpen(false);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4 className={`text-xs font-bold truncate ${isSelected ? "text-[#f26522]" : isDark ? "text-white" : "text-[#0d1117]"}`}>
                          {model.name}
                        </h4>
                        {isRecommended && (
                          <span className="shrink-0 text-[7px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">
                            Top
                          </span>
                        )}
                      </div>
                      {isSelected ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f26522] text-white shrink-0">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      ) : (
                        <Star className={`h-3 w-3 shrink-0 group-hover:text-[#f26522]/40 transition-colors ${isDark ? "text-gray-600" : "text-gray-200"}`} />
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        isSelected ? "bg-[#f26522]/10 text-[#f26522]" : getTypeBadgeColors(model.type, isDark)
                      }`}>
                        {getTypeLabel(model.type)}
                      </span>
                      <span className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>{model.speed}</span>
                      <span className="text-[9px] font-bold text-[#f26522]">
                        {model.cost}
                      </span>
                    </div>

                    <p className={`mt-1 text-[9px] leading-relaxed line-clamp-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      {model.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
