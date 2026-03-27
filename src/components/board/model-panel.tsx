"use client";

import { useState } from "react";
import { X, Search, Check, Info } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { models, getTypeLabel } from "@/lib/models";

const typeBadge = (type: string) => {
  if (["t2v", "i2v", "s2e", "v2v"].includes(type)) return "text-blue-400";
  if (["t2i", "i2i"].includes(type)) return "text-emerald-400";
  if (type === "lipsync") return "text-pink-400";
  if (type === "audio" || type === "a2a") return "text-purple-400";
  return "text-gray-400";
};

export function ModelPanel() {
  const { isModelPanelOpen, setModelPanelOpen, selectedModelId, setSelectedModel, theme } = useAppStore();
  const isDark = theme === "dark";
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isModelPanelOpen) return null;

  const filtered = models.filter((m) =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="absolute right-2 bottom-12 z-[45] w-[380px]">
      <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-200"}`}
        style={{ boxShadow: isDark ? "0 20px 40px rgba(0,0,0,0.5)" : "0 20px 40px rgba(0,0,0,0.1)" }}>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2.5 ${isDark ? "border-b border-gray-800" : "border-b border-gray-100"}`}>
          <div className="flex items-center gap-2">
            <h3 className={`text-xs font-bold ${isDark ? "text-white" : "text-[#0d1117]"}`}>Models</h3>
            <span className={`text-[9px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>{models.length}</span>
          </div>
          <button className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-[#0d1117]"}`} onClick={() => setModelPanelOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className={`absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 ${isDark ? "text-gray-600" : "text-gray-300"}`} />
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-lg py-1.5 pl-8 pr-3 text-[11px] outline-none transition-all ${isDark ? "bg-[#161b22] border border-gray-800 text-white placeholder:text-gray-600 focus:border-[#f26522]/50" : "bg-gray-50 border border-gray-200 text-[#0d1117] placeholder:text-gray-400 focus:border-[#f26522]"}`}
            />
          </div>
        </div>

        {/* Model list */}
        <div className="overflow-y-auto px-2 pb-2" style={{ maxHeight: 360 }}>
          {filtered.map((model) => {
            const isSelected = selectedModelId === model.id;
            const isExpanded = expandedId === model.id;
            return (
              <div key={model.id} className="mb-0.5">
                <div
                  className={`w-full text-left rounded-lg px-3 py-2 transition-all flex items-center gap-2.5 cursor-pointer ${
                    isSelected
                      ? isDark ? "bg-[#f26522]/10" : "bg-[#f26522]/5"
                      : isDark ? "hover:bg-white/[0.03]" : "hover:bg-gray-50"
                  }`}
                  onClick={() => { setSelectedModel(model.id); setModelPanelOpen(false); }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-semibold truncate ${isSelected ? "text-[#f26522]" : isDark ? "text-white" : "text-[#0d1117]"}`}>
                        {model.name}
                      </span>
                      <span className={`text-[8px] font-semibold ${typeBadge(model.type)}`}>
                        {getTypeLabel(model.type)}
                      </span>
                    </div>
                    <p className={`text-[9px] truncate ${isDark ? "text-gray-500" : "text-gray-400"}`}>{model.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-[#f26522]">{model.cost}</span>
                      <p className={`text-[8px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>{model.speed}</p>
                    </div>
                    {/* Info toggle */}
                    <button
                      className={`h-5 w-5 rounded flex items-center justify-center transition-colors ${isDark ? "text-gray-600 hover:text-gray-300 hover:bg-white/10" : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"}`}
                      onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : model.id); }}
                      title="Details"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                    {isSelected && (
                      <div className="h-4 w-4 rounded-full bg-[#f26522] flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                {/* Expanded details */}
                {isExpanded && (
                  <div className={`mx-3 mb-1 px-3 py-2 rounded-lg text-[9px] space-y-1 ${isDark ? "bg-[#161b22] text-gray-400" : "bg-gray-50 text-gray-500"}`}>
                    <p>{model.description}</p>
                    <div className={`pt-1.5 mt-1.5 space-y-0.5 ${isDark ? "border-t border-gray-800" : "border-t border-gray-200"}`}>
                      <p><span className="opacity-60">Type:</span> {getTypeLabel(model.type)}</p>
                      <p><span className="opacity-60">Cost:</span> <span className="text-[#f26522] font-semibold">{model.cost}</span></p>
                      <p><span className="opacity-60">Speed:</span> {model.speed}</p>
                      <p><span className="opacity-60">Provider:</span> {model.provider}</p>
                      <p className="font-semibold mt-1">Inputs:</p>
                      {model.inputs.map((inp) => (
                        <p key={inp.name} className="pl-2">
                          {inp.required ? "* " : "  "}{inp.description}{!inp.required && " (optional)"}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
