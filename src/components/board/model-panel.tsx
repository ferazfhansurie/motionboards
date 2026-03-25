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

export function ModelPanel() {
  const { isModelPanelOpen, setModelPanelOpen, selectedModelId, setSelectedModel } =
    useAppStore();
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
      <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#f26522] text-white">
                <Zap className="h-3 w-3" />
              </div>
              <h3 className="text-xs font-bold text-[#0d1117]">AI Models</h3>
            </div>
            <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
              {models.length} available
            </span>
          </div>
          <button
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
            onClick={() => setModelPanelOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-100 px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-300" />
            <input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg bg-gray-50 border border-gray-200 py-1.5 pl-8 pr-3 text-xs text-[#0d1117] outline-none placeholder:text-gray-400 focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all"
            />
          </div>
        </div>

        <div className="flex" style={{ maxHeight: "320px" }}>
          {/* Categories sidebar */}
          <div className="w-40 shrink-0 border-r border-gray-100 overflow-y-auto py-2 px-1.5">
            <button
              className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-all ${
                activeCategory === "all"
                  ? "bg-[#f26522] text-white shadow-sm shadow-[#f26522]/20"
                  : "text-gray-500 hover:bg-gray-50 hover:text-[#0d1117]"
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
              <p className="text-[8px] font-bold uppercase tracking-widest text-gray-300">
                Categories
              </p>
            </div>

            {modelCategories.map((cat) => (
              <button
                key={cat}
                className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-[#f26522] text-white shadow-sm shadow-[#f26522]/20"
                    : "text-gray-500 hover:bg-gray-50 hover:text-[#0d1117]"
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
                return (
                  <button
                    key={model.id}
                    className={`group rounded-lg border p-2.5 text-left transition-all duration-200 ${
                      isSelected
                        ? "border-[#f26522] bg-[#f26522]/5 shadow-md shadow-[#f26522]/10 ring-1 ring-[#f26522]/20"
                        : "border-gray-200 bg-white hover:border-[#f26522]/40 hover:shadow-md hover:-translate-y-0.5"
                    }`}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setModelPanelOpen(false);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className={`text-xs font-bold ${isSelected ? "text-[#f26522]" : "text-[#0d1117]"}`}>
                        {model.name}
                      </h4>
                      {isSelected ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f26522] text-white">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      ) : (
                        <Star className="h-3 w-3 text-gray-200 group-hover:text-[#f26522]/40 transition-colors" />
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        isSelected ? "bg-[#f26522]/10 text-[#f26522]" : "bg-gray-100 text-gray-500"
                      }`}>
                        {getTypeLabel(model.type)}
                      </span>
                      <span className="text-[9px] text-gray-400">{model.speed}</span>
                      <span className="text-[9px] font-bold text-[#f26522]">
                        {model.cost}
                      </span>
                    </div>

                    <p className="mt-1 text-[9px] leading-relaxed text-gray-400 line-clamp-2">
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
