"use client";

import { X, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { AIModel } from "@/lib/models";
import { useAppStore } from "@/lib/store";

interface ModelGuideDialogProps {
  model: AIModel;
  onClose: () => void;
}

// Renders the model.guide markdown in a focused modal. Opens from the (i)
// button next to each entry in the model picker. Falls back to a "no guide
// yet" placeholder for models that haven't been documented in models.ts.
export function ModelGuideDialog({ model, onClose }: ModelGuideDialogProps) {
  const isDark = useAppStore((s) => s.theme) === "dark";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-200"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-start justify-between gap-4 px-5 py-4 ${isDark ? "border-b border-gray-800" : "border-b border-gray-100"}`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg p-2 bg-[#f26522]/15 shrink-0">
              <BookOpen className="h-4 w-4 text-[#f26522]" />
            </div>
            <div className="min-w-0">
              <h3 className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-[#0d1117]"}`}>{model.name}</h3>
              <p className={`text-[11px] mt-0.5 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                {model.category} · {model.cost} · ~{model.speed}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1">
          <p className={`text-xs italic mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {model.description}
          </p>

          {model.guide ? (
            <div className={`markdown-body text-[12.5px] leading-relaxed ${isDark ? "md-dark text-gray-200" : "md-light text-[#0d1117]"}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{model.guide}</ReactMarkdown>
            </div>
          ) : (
            <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              No detailed guide for this model yet — refer to the description above and the model's input pills (max file sizes, accepted types).
            </p>
          )}

          {/* Input slots — always shown so users see what they need to tag */}
          <div className={`mt-5 pt-4 ${isDark ? "border-t border-gray-800" : "border-t border-gray-100"}`}>
            <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Inputs
            </h4>
            <ul className="space-y-1.5">
              {model.inputs.map((inp) => (
                <li key={inp.name} className={`text-[11px] flex items-start gap-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono uppercase ${
                    inp.required
                      ? "bg-[#f26522]/15 text-[#f26522]"
                      : isDark ? "bg-white/5 text-gray-500" : "bg-gray-100 text-gray-500"
                  }`}>
                    {inp.type}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold">{inp.name}</span>
                    {inp.required ? "" : " (optional)"}
                    {inp.maxMB ? <span className={`ml-1.5 text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>· max {inp.maxMB} MB</span> : null}
                    <p className={`mt-0.5 ${isDark ? "text-gray-500" : "text-gray-500"}`}>{inp.description}</p>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
