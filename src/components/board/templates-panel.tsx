"use client";

import { useState, useMemo } from "react";
import {
  X, Search, Copy, Check, BookOpen,
  Video, Frame, Sun, Sparkles, Film,
  Palette, Clapperboard, Users, Timer, Aperture,
} from "lucide-react";
import templateData from "@/lib/prompt-templates.json";

const categoryIcons: Record<string, React.ReactNode> = {
  "camera-movement": <Video className="h-3.5 w-3.5" />,
  "shot-types": <Frame className="h-3.5 w-3.5" />,
  "lighting": <Sun className="h-3.5 w-3.5" />,
  "transitions-effects": <Sparkles className="h-3.5 w-3.5" />,
  "film-styles": <Film className="h-3.5 w-3.5" />,
  "color-mood": <Palette className="h-3.5 w-3.5" />,
  "scene-types": <Clapperboard className="h-3.5 w-3.5" />,
  "character-performance": <Users className="h-3.5 w-3.5" />,
  "time-speed": <Timer className="h-3.5 w-3.5" />,
  "texture-detail": <Aperture className="h-3.5 w-3.5" />,
};

import { useAppStore } from "@/lib/store";

export function TemplatesPanel() {
  const { isTemplatesOpen: isOpen, setTemplatesOpen, setPendingPrompt } = useAppStore();
  const onClose = () => setTemplatesOpen(false);
  const onUsePrompt = (prompt: string) => setPendingPrompt(prompt);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, Record<string, string>>>({});
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const categories = templateData.categories;

  const filteredTemplates = useMemo(() => {
    const allTemplates = activeCategory === "all"
      ? categories.flatMap((c) => c.templates.map((t) => ({ ...t, categoryName: c.name, categoryId: c.id })))
      : categories
          .filter((c) => c.id === activeCategory)
          .flatMap((c) => c.templates.map((t) => ({ ...t, categoryName: c.name, categoryId: c.id })));

    if (!search) return allTemplates;
    const q = search.toLowerCase();
    return allTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.prompt.toLowerCase().includes(q)
    );
  }, [activeCategory, search, categories]);

  if (!isOpen) return null;

  const getFilledPrompt = (templateName: string, prompt: string, variables: string[]) => {
    const vals = variableValues[templateName] || {};
    let filled = prompt;
    for (const v of variables) {
      const value = vals[v] || `{${v}}`;
      filled = filled.replace(new RegExp(`\\{${v}\\}`, "g"), value);
    }
    return filled;
  };

  const handleCopy = (templateName: string, prompt: string, variables: string[]) => {
    const filled = getFilledPrompt(templateName, prompt, variables);
    navigator.clipboard.writeText(filled);
    setCopiedId(templateName);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUse = (templateName: string, prompt: string, variables: string[]) => {
    const filled = getFilledPrompt(templateName, prompt, variables);
    onUsePrompt(filled);
    onClose();
  };

  const updateVariable = (templateName: string, variable: string, value: string) => {
    setVariableValues((prev) => ({
      ...prev,
      [templateName]: { ...(prev[templateName] || {}), [variable]: value },
    }));
  };

  return (
    <div className="absolute left-2 bottom-10 z-40 w-[480px] pointer-events-auto">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#f26522] text-white">
              <BookOpen className="h-3 w-3" />
            </div>
            <h3 className="text-xs font-bold text-[#0d1117]">Prompt Templates</h3>
            <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
              76 prompts
            </span>
          </div>
          <button
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-100 px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-300" />
            <input
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg bg-gray-50 border border-gray-200 py-1.5 pl-8 pr-3 text-xs text-[#0d1117] outline-none placeholder:text-gray-400 focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all"
            />
          </div>
        </div>

        <div className="flex" style={{ maxHeight: "380px" }}>
          {/* Categories sidebar */}
          <div className="w-36 shrink-0 border-r border-gray-100 overflow-y-auto py-2 px-1.5">
            <button
              className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-all ${
                activeCategory === "all"
                  ? "bg-[#f26522] text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-[#0d1117]"
              }`}
              onClick={() => setActiveCategory("all")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="flex-1">All</span>
              <span className={`text-[9px] ${activeCategory === "all" ? "text-white/70" : "text-gray-400"}`}>76</span>
            </button>

            <div className="my-2 px-2.5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-gray-300">Categories</p>
            </div>

            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[10px] font-medium transition-all ${
                  activeCategory === cat.id
                    ? "bg-[#f26522] text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50 hover:text-[#0d1117]"
                }`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {categoryIcons[cat.id]}
                <span className="flex-1 truncate">{cat.name}</span>
                <span className={`text-[9px] ${activeCategory === cat.id ? "text-white/70" : "text-gray-400"}`}>
                  {cat.templates.length}
                </span>
              </button>
            ))}
          </div>

          {/* Templates list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredTemplates.map((template) => {
              const isExpanded = expandedTemplate === template.name;
              const vals = variableValues[template.name] || {};
              const isCopied = copiedId === template.name;

              return (
                <div
                  key={template.name}
                  className={`rounded-lg border transition-all duration-200 ${
                    isExpanded
                      ? "border-[#f26522]/30 bg-[#f26522]/[0.02] shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  {/* Template header */}
                  <button
                    className="w-full text-left px-3 py-2"
                    onClick={() => setExpandedTemplate(isExpanded ? null : template.name)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-[11px] font-bold text-[#0d1117] truncate">{template.name}</h4>
                          <span className="text-[8px] font-medium text-[#f26522] bg-[#f26522]/8 px-1.5 py-0.5 rounded shrink-0">
                            {template.categoryName}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[9px] text-gray-400 line-clamp-1">{template.description}</p>
                      </div>
                    </div>
                  </button>

                  {/* Expanded: variables + prompt */}
                  {isExpanded && (
                    <div className="px-3 pb-2.5 space-y-2 border-t border-gray-100 pt-2">
                      {/* Variable inputs */}
                      {template.variables.length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5">
                          {template.variables.map((v) => (
                            <div key={v}>
                              <label className="text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-0.5 block">
                                {v.replace(/_/g, " ")}
                              </label>
                              <input
                                type="text"
                                value={vals[v] || ""}
                                onChange={(e) => updateVariable(template.name, v, e.target.value)}
                                placeholder={v.replace(/_/g, " ")}
                                className="w-full rounded-md bg-gray-50 border border-gray-200 px-2 py-1 text-[10px] text-[#0d1117] outline-none placeholder:text-gray-300 focus:border-[#f26522] focus:ring-1 focus:ring-[#f26522]/10"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Preview prompt */}
                      <div className="rounded-md bg-gray-50 border border-gray-200 p-2">
                        <p className="text-[9px] leading-relaxed text-gray-600 whitespace-pre-wrap">
                          {getFilledPrompt(template.name, template.prompt, template.variables)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUse(template.name, template.prompt, template.variables)}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-[#f26522] text-white py-1.5 text-[10px] font-bold hover:bg-[#d9541a] transition-colors"
                        >
                          Use Prompt
                        </button>
                        <button
                          onClick={() => handleCopy(template.name, template.prompt, template.variables)}
                          className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white text-gray-500 px-3 py-1.5 text-[10px] font-medium hover:bg-gray-50 transition-colors"
                        >
                          {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          {isCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
