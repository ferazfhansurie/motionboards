"use client";

import { X, Download, Music } from "lucide-react";
import type { BoardItem } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface ZoomPreviewProps {
  item: BoardItem;
  onClose: () => void;
}

export function ZoomPreview({ item, onClose }: ZoomPreviewProps) {
  const mediaSrc = item.outputUrl || item.src;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          className="absolute -right-3 -top-3 z-10 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Media */}
        {(item.type === "image" ||
          (item.type === "generation" && item.outputType === "image")) && (
          <img
            src={mediaSrc}
            alt={item.fileName || "Preview"}
            className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain"
          />
        )}

        {(item.type === "video" ||
          (item.type === "generation" && item.outputType === "video")) && (
          <video
            src={mediaSrc}
            controls
            autoPlay
            loop
            className="max-h-[85vh] max-w-[85vw] rounded-xl"
          />
        )}

        {(item.type === "audio" ||
          (item.type === "generation" && item.outputType === "audio")) && (
          <div className="flex flex-col items-center gap-4 rounded-xl bg-[#0d1f30] p-8">
            <Music className="h-12 w-12 text-[#f26522]" />
            <p className="text-sm text-white">{item.fileName || "Audio"}</p>
            <audio src={mediaSrc} controls autoPlay className="w-80" />
          </div>
        )}

        {/* Info bar */}
        <div className="mt-3 flex items-center justify-between">
          <div>
            {item.modelName && (
              <p className="text-xs font-medium text-neutral-300">
                {item.modelName}
              </p>
            )}
            {item.prompt && (
              <p className="mt-0.5 max-w-lg text-xs text-white/50">
                {item.prompt}
              </p>
            )}
          </div>
          {mediaSrc && (
            <a href={mediaSrc} download target="_blank" rel="noopener noreferrer">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white"
              >
                <Download className="mr-1 h-3 w-3" />
                Download
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
