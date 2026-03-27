"use client";

import { useState } from "react";
import { X, Search, Sparkles, Film, Wand2, ArrowUpRight, Palette, User, Mic, Music, Zap, Check, PenTool, UserCheck, Layers } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { models, modelCategories, getModelsByCategory, getTypeLabel, type ModelCategory } from "@/lib/models";

const categoryIcons: Record<ModelCategory, React.ReactNode> = {
  "Cinematic Video Gen": <Film className="h-3.5 w-3.5" />,
  "Video Editing": <Wand2 className="h-3.5 w-3.5" />,
  "Upscale & Restoration": <ArrowUpRight className="h-3.5 w-3.5" />,
  "Concept Art & Style": <Palette className="h-3.5 w-3.5" />,
  "Character & Fashion": <User className="h-3.5 w-3.5" />,
  "Image Editing": <PenTool className="h-3.5 w-3.5" />,
  "Face & Body": <UserCheck className="h-3.5 w-3.5" />,
  "Lip Sync": <Mic className="h-3.5 w-3.5" />,
  "Audio & Music": <Music className="h-3.5 w-3.5" />,
};

const typeBadge = (type: string) => {
  if (["t2v", "i2v", "s2e", "v2v"].includes(type)) return { bg: "bg-blue-500/15 text-blue-400", label: "Video" };
  if (["t2i", "i2i"].includes(type)) return { bg: "bg-emerald-500/15 text-emerald-400", label: "Image" };
  if (type === "upscale") return { bg: "bg-amber-500/15 text-amber-400", label: "Upscale" };
  if (type === "lipsync") return { bg: "bg-pink-500/15 text-pink-400", label: "Lip Sync" };
  if (type === "audio" || type === "a2a") return { bg: "bg-purple-500/15 text-purple-400", label: "Audio" };
  return { bg: "bg-gray-500/15 text-gray-400", label: type };
};

const recommendedIds = ["fal-ai/nano-banana-2", "fal-ai/veo3.1/fast", "fal-ai/sora-2/text-to-video"];

export function ModelPanel() {
  const { isModelPanelOpen, setModelPanelOpen, selectedModelId, setSelectedModel, theme } = useAppStore();
  const isDark = theme === "dark";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ModelCategory | "all">("all");

  if (!isModelPanelOpen) return null;

  const filteredModels = activeCategory === "all"
    ? models.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase()))
    : getModelsByCategory(activeCategory).filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="absolute right-2 bottom-12 z-[45] w-[560px]">
      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-200"}`}
        style={{ boxShadow: isDark ? "0 25px 60px rgba(0,0,0,0.6)" : "0 25px 60px rgba(0,0,0,0.15)" }}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 ${isDark ? "bg-[#161b22] border-b border-gray-800" : "bg-gray-50/80 border-b border-gray-100"}`}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#f26522] to-[#d9541a] flex items-center justify-center text-white shadow-lg shadow-[#f26522]/20">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-[#0d1117]"}`}>AI Models</h3>
              <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>{models.length} models available</p>
            </div>
          </div>
          <button className={`rounded-xl p-2 transition-colors ${isDark ? "text-gray-500 hover:bg-white/5 hover:text-white" : "text-gray-400 hover:bg-gray-100"}`} onClick={() => setModelPanelOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? "text-gray-600" : "text-gray-300"}`} />
            <input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-xl py-2.5 pl-9 pr-4 text-xs outline-none transition-all ${isDark ? "bg-[#161b22] border border-gray-800 text-white placeholder:text-gray-600 focus:border-[#f26522]/50" : "bg-gray-50 border border-gray-200 text-[#0d1117] placeholder:text-gray-400 focus:border-[#f26522]"}`}
            />
          </div>
        </div>

        <div className="flex" style={{ maxHeight: 400 }}>
          {/* Categories */}
          <div className={`w-[140px] shrink-0 border-r overflow-y-auto py-2 px-2 ${isDark ? "border-gray-800" : "border-gray-100"}`}>
            <button
              className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[10px] font-semibold transition-all ${
                activeCategory === "all" ? "bg-gradient-to-r from-[#f26522] to-[#d9541a] text-white shadow-md shadow-[#f26522]/20" : isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-500 hover:bg-gray-50"
              }`}
              onClick={() => setActiveCategory("all")}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">All</span>
              <span className={`text-[9px] ${activeCategory === "all" ? "text-white/70" : isDark ? "text-gray-600" : "text-gray-400"}`}>{models.length}</span>
            </button>

            <div className={`my-2 mx-2 pt-2 ${isDark ? "border-t border-gray-800" : "border-t border-gray-100"}`}>
              <p className={`text-[7px] font-bold uppercase tracking-[0.15em] ${isDark ? "text-gray-600" : "text-gray-300"}`}>Categories</p>
            </div>

            {modelCategories.map((cat) => (
              <button
                key={cat}
                className={`mb-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-[10px] font-medium transition-all ${
                  activeCategory === cat ? "bg-gradient-to-r from-[#f26522] to-[#d9541a] text-white shadow-md shadow-[#f26522]/20" : isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {categoryIcons[cat]}
                <span className="flex-1 truncate">{cat}</span>
                <span className={`text-[8px] ${activeCategory === cat ? "text-white/70" : isDark ? "text-gray-600" : "text-gray-400"}`}>
                  {getModelsByCategory(cat).length}
                </span>
              </button>
            ))}
          </div>

          {/* Model list - single column, clean rows */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredModels.map((model) => {
              const isSelected = selectedModelId === model.id;
              const badge = typeBadge(model.type);
              const isRecommended = recommendedIds.includes(model.id);

              return (
                <button
                  key={model.id}
                  className={`w-full text-left rounded-xl px-3.5 py-2.5 transition-all duration-150 flex items-center gap-3 ${
                    isSelected
                      ? isDark ? "bg-[#f26522]/10 ring-1 ring-[#f26522]/40" : "bg-[#f26522]/5 ring-1 ring-[#f26522]/30"
                      : isDark ? "hover:bg-white/[0.03]" : "hover:bg-gray-50"
                  }`}
                  onClick={() => { setSelectedModel(model.id); setModelPanelOpen(false); }}
                >
                  {/* Type badge circle */}
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-[8px] font-bold uppercase tracking-wider ${badge.bg}`}>
                    {getTypeLabel(model.type).slice(0, 3)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className={`text-[11px] font-bold truncate ${isSelected ? "text-[#f26522]" : isDark ? "text-white" : "text-[#0d1117]"}`}>
                        {model.name}
                      </h4>
                      {isRecommended && (
                        <span className="text-[7px] font-bold bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-full shrink-0">TOP</span>
                      )}
                    </div>
                    <p className={`text-[9px] mt-0.5 truncate ${isDark ? "text-gray-500" : "text-gray-400"}`}>{model.description}</p>
                  </div>

                  {/* Right: speed + price */}
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-bold text-[#f26522]">{model.cost}</span>
                    <p className={`text-[8px] mt-0.5 ${isDark ? "text-gray-600" : "text-gray-400"}`}>{model.speed}</p>
                  </div>

                  {/* Check */}
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-[#f26522] flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
