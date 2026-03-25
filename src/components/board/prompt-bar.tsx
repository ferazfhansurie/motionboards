"use client";

import { useState } from "react";
import {
  WandSparkles,
  Loader2,
  ChevronDown,
  LayoutGrid,
  FileImage,
  Sparkles,
  User,
  X,
  BookOpen,
  Plus,
  Trash2,
  History,
} from "lucide-react";
import { useAppStore, type BoardItem } from "@/lib/store";
import { getModelById } from "@/lib/models";
import { useEffect } from "react";

export function PromptBar() {
  const [prompt, setPrompt] = useState("");
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const {
    selectedModelId,
    setModelPanelOpen,
    isModelPanelOpen,
    isGenerating,
    setIsGenerating,
    addItem,
    items,
    startFrameId,
    endFrameId,
    inputRefs,
    panX,
    panY,
    zoom,
    boardName,
    setBoardName,
    setStartFrame,
    setEndFrame,
    selectedItemId,
    isTemplatesOpen,
    setTemplatesOpen,
    pendingPrompt,
    setPendingPrompt,
    isProfileOpen,
    setProfileOpen,
    isHistoryOpen,
    setHistoryOpen,
    isAIPromptOpen,
    setAIPromptOpen,
    boards,
    activeBoardId,
    addBoard,
    switchBoard,
    deleteBoard,
  } = useAppStore();

  // Consume pending prompt from templates panel
  useEffect(() => {
    if (pendingPrompt) {
      setPrompt(pendingPrompt);
      setPendingPrompt(null);
    }
  }, [pendingPrompt, setPendingPrompt]);

  const selectedModel = selectedModelId ? getModelById(selectedModelId) : null;

  const getNextPosition = () => {
    if (items.length === 0) {
      return {
        x: (-panX + window.innerWidth / 2 - 150) / zoom,
        y: (-panY + window.innerHeight / 2 - 100) / zoom,
      };
    }
    const rightmost = items.reduce((max, item) =>
      item.x + item.width > max.x + max.width ? item : max
    );
    return { x: rightmost.x + rightmost.width + 30, y: rightmost.y };
  };

  const handleGenerate = async () => {
    if (!selectedModel) return;
    if (!prompt.trim() && selectedModel.inputs.some((i) => i.type === "text" && i.required)) return;

    // Check required inputs
    const needsImage = selectedModel.inputs.some((i) => (i.type === "image") && i.required);
    const needsVideo = selectedModel.inputs.some((i) => i.type === "video" && i.required);
    const needsAudio = selectedModel.inputs.some((i) => i.type === "audio" && i.required);
    const hasImageInput = inputRefs.length > 0 || startFrameId;
    const hasVideoInput = inputRefs.some((id) => items.find((i) => i.id === id)?.type === "video");

    if (needsImage && !hasImageInput) {
      alert(`${selectedModel.name} requires an image input. Select an image on the canvas and set it as INPUT.`);
      return;
    }
    if (needsVideo && !hasVideoInput && !inputRefs.length) {
      alert(`${selectedModel.name} requires a video input. Select a video on the canvas and set it as INPUT.`);
      return;
    }
    if (needsAudio) {
      // Audio inputs not yet supported via canvas — warn
      alert(`${selectedModel.name} requires an audio input. Audio input support coming soon.`);
      return;
    }

    setIsGenerating(true);
    const pos = getNextPosition();

    const outputType =
      selectedModel.type === "audio"
        ? "audio"
        : ["t2i", "i2i", "upscale"].includes(selectedModel.type)
        ? "image"
        : "video";

    const genItem: BoardItem = {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "generation",
      x: pos.x,
      y: pos.y,
      width: 300,
      height: outputType === "audio" ? 80 : 200,
      src: "",
      prompt,
      model: selectedModel.id,
      modelName: selectedModel.name,
      status: "processing",
      outputType,
      createdAt: new Date().toISOString(),
    };

    addItem(genItem);

    try {
      const startItem = startFrameId ? items.find((i) => i.id === startFrameId) : null;
      const endItem = endFrameId ? items.find((i) => i.id === endFrameId) : null;
      const refItems = inputRefs.map((id) => items.find((i) => i.id === id)).filter(Boolean);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: selectedModel.id,
          mode: selectedModel.type,
          inputImage: refItems[0]?.src || startItem?.src || null,
          startFrame: startItem?.src || null,
          endFrame: endItem?.src || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Remove the placeholder item and show error
        useAppStore.getState().removeItem(genItem.id);
        alert(data.error || "Generation failed");
        return;
      }
      useAppStore.getState().updateItem(genItem.id, {
        status: data.status === "completed" ? "completed" : "failed",
        outputUrl: data.outputUrl || null,
        error: data.error || null,
        cost: data.cost || selectedModel.cost,
      });
    } catch (err) {
      useAppStore.getState().updateItem(genItem.id, {
        status: "failed",
        error: err instanceof Error ? err.message : "Generation failed",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Context for selected item — model-aware reference buttons
  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) : null;
  const isSelectedImage = selectedItem && (selectedItem.type === "image" || selectedItem.type === "psd-layer" || (selectedItem.type === "generation" && selectedItem.outputType === "image"));
  const isSelectedVideo = selectedItem && (selectedItem.type === "video" || (selectedItem.type === "generation" && selectedItem.outputType === "video"));

  // Determine which reference types apply to current model
  const modelType = selectedModel?.type;
  const showStartFrame = modelType === "s2e" && isSelectedImage;
  const showEndFrame = modelType === "s2e" && isSelectedImage;

  // Check what input types the model needs
  const modelNeedsImage = selectedModel?.inputs.some((inp) => inp.type === "image");
  const modelNeedsVideo = selectedModel?.inputs.some((inp) => inp.type === "video");

  // Only show INPUT button if selected item matches what the model accepts
  const showInput = modelType && (
    (modelNeedsImage && isSelectedImage) ||
    (modelNeedsVideo && isSelectedVideo)
  );
  const canSetAsRef = selectedItem && (isSelectedImage || isSelectedVideo);
  const showAnyRef = showStartFrame || showEndFrame || showInput;

  // Cascading input: figure out the next available input slot
  const currentInputIndex = selectedItem ? inputRefs.indexOf(selectedItem.id) : -1;
  const nextSlot = inputRefs.length; // 0-based index of next available slot

  // Resolve input ref items for preview
  const refItems = inputRefs
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as BoardItem[];

  // Resolve start/end frame items for preview
  const startItem = startFrameId ? items.find((i) => i.id === startFrameId) : null;
  const endItem = endFrameId ? items.find((i) => i.id === endFrameId) : null;

  const hasAnyInputs = refItems.length > 0 || startItem || endItem;

  return (
    <div className="absolute bottom-0 left-0 right-0 flex flex-col pointer-events-none">
      {/* Reference controls — only shown when item selected AND model needs references */}
      {canSetAsRef && showAnyRef && (
        <div className="pointer-events-auto mx-auto mb-2 flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-1.5 backdrop-blur-sm shadow-lg">
          <span className="text-[10px] text-gray-400 mr-1">Set as:</span>
          {showStartFrame && (
            <button
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                startFrameId === selectedItem!.id
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              onClick={() =>
                setStartFrame(startFrameId === selectedItem!.id ? null : selectedItem!.id)
              }
            >
              Start Frame
            </button>
          )}
          {showEndFrame && (
            <button
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                endFrameId === selectedItem!.id
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              onClick={() =>
                useAppStore.getState().setEndFrame(endFrameId === selectedItem!.id ? null : selectedItem!.id)
              }
            >
              End Frame
            </button>
          )}
          {showInput && (() => {
            const isAlreadyRef = currentInputIndex !== -1;
            // Can add as next input if: already assigned OR is the next slot
            const canAssign = isAlreadyRef || !inputRefs.includes(selectedItem!.id);
            // Show numbered buttons: existing slots + the next available one
            const maxSlots = Math.min(inputRefs.length + 1, 5);

            return Array.from({ length: maxSlots }, (_, i) => {
              const isThisItem = inputRefs[i] === selectedItem!.id;
              const slotFilled = i < inputRefs.length;
              // Only allow clicking the next unfilled slot or toggling an existing one
              const isNextAvailable = i === inputRefs.length && !inputRefs.includes(selectedItem!.id);
              const canClick = isThisItem || isNextAvailable;

              return (
                <button
                  key={i}
                  disabled={!canClick}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    isThisItem
                      ? "bg-emerald-600 text-white"
                      : slotFilled
                      ? "bg-emerald-50 text-emerald-400 cursor-default"
                      : canClick
                      ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      : "bg-gray-50 text-gray-300 cursor-not-allowed"
                  }`}
                  onClick={() => {
                    if (!canClick) return;
                    if (isThisItem) {
                      // Remove this and all after it (cascade down)
                      const newRefs = inputRefs.slice(0, i);
                      useAppStore.setState({ inputRefs: newRefs });
                    } else {
                      useAppStore.getState().toggleInputRef(selectedItem!.id);
                    }
                  }}
                >
                  INPUT {i + 1}
                </button>
              );
            });
          })()}
        </div>
      )}

      {/* Prompt input (floating right) */}
      <div className="flex items-end justify-between gap-2 px-2 pb-1">
        <div className="pointer-events-auto" />
        <div className="flex-grow" />
        <div className="pointer-events-auto relative w-80">
          {/* Input previews above textarea */}
          {hasAnyInputs && (
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              {startItem && (
                <div className="relative group/thumb">
                  <img
                    src={startItem.outputUrl || startItem.src}
                    alt="Start Frame"
                    className="h-10 w-10 rounded-md object-cover border border-green-500/60"
                  />
                  <span className="absolute -top-1.5 -left-1 bg-green-600 text-white text-[7px] font-bold px-1 rounded leading-tight">
                    S
                  </span>
                  <button
                    className="absolute -top-1 -right-1 bg-neutral-800 rounded-full p-0.5 text-neutral-400 hover:text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    onClick={() => setStartFrame(null)}
                  >
                    <X className="h-2 w-2" />
                  </button>
                </div>
              )}
              {endItem && (
                <div className="relative group/thumb">
                  <img
                    src={endItem.outputUrl || endItem.src}
                    alt="End Frame"
                    className="h-10 w-10 rounded-md object-cover border border-red-500/60"
                  />
                  <span className="absolute -top-1.5 -left-1 bg-red-600 text-white text-[7px] font-bold px-1 rounded leading-tight">
                    E
                  </span>
                  <button
                    className="absolute -top-1 -right-1 bg-neutral-800 rounded-full p-0.5 text-neutral-400 hover:text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    onClick={() => useAppStore.getState().setEndFrame(null)}
                  >
                    <X className="h-2 w-2" />
                  </button>
                </div>
              )}
              {refItems.map((item, i) => (
                <div key={item.id} className="relative group/thumb">
                  <img
                    src={item.outputUrl || item.src}
                    alt={`Input ${i + 1}`}
                    className="h-10 w-10 rounded-md object-cover border border-emerald-500/60"
                  />
                  <span className="absolute -top-1.5 -left-1 bg-emerald-600 text-white text-[7px] font-bold px-1 rounded leading-tight">
                    {i + 1}
                  </span>
                  <button
                    className="absolute -top-1 -right-1 bg-neutral-800 rounded-full p-0.5 text-neutral-400 hover:text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    onClick={() => {
                      // Remove this input and cascade
                      const newRefs = inputRefs.slice(0, i);
                      useAppStore.setState({ inputRefs: newRefs });
                    }}
                  >
                    <X className="h-2 w-2" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative">
            <textarea
              placeholder={selectedModel ? `Describe what ${selectedModel.name} should create...` : "No prompt required"}
              disabled={!selectedModel}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              className="w-full bg-white backdrop-blur-md text-xs text-[#0d1117] placeholder-gray-400 border border-gray-200 rounded-2xl transition-all duration-200 focus:outline-none focus:border-[#f26522] shadow-lg px-3 pt-1.5 pb-8 resize-none scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent leading-4 overflow-hidden"
              style={{ height: 70 }}
            />
            {/* Generate button */}
            <div className="absolute bottom-3 right-1.5">
              <button
                type="button"
                disabled={isGenerating || !selectedModel}
                onClick={handleGenerate}
                className={`flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
                  isGenerating || !selectedModel
                    ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                    : "bg-[#f26522] text-white hover:bg-[#d9541a] cursor-pointer"
                }`}
                title="Generate (Ctrl+Enter)"
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <WandSparkles className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {/* Cost indicator */}
            <div className="absolute bottom-3 left-2 flex items-center gap-1.5">
              {selectedModel && (
                <span className="text-[9px] text-gray-400">{selectedModel.cost}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="pointer-events-auto relative flex h-full w-full items-center bg-white/95 backdrop-blur-md px-2.5 py-1 border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        {/* Left: Board selector */}
        <div className="relative">
          <button
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#0d1117] hover:bg-gray-100 rounded-lg transition-colors min-w-0"
            onClick={() => setBoardMenuOpen(!boardMenuOpen)}
          >
            <span className="flex items-center gap-1 min-w-0">
              <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="truncate max-w-[120px] text-[#0d1117]">{boardName}</span>
            </span>
            <ChevronDown className="w-2.5 h-2.5 flex-shrink-0 text-gray-400" />
          </button>

          {/* Board dropdown */}
          {boardMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-52 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden z-50">
              <div className="p-1.5 space-y-0.5 max-h-48 overflow-y-auto">
                {boards.map((board) => (
                  <div
                    key={board.id}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer transition-all ${
                      board.id === activeBoardId
                        ? "bg-[#f26522]/10 text-[#f26522]"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                    onClick={() => { switchBoard(board.id); setBoardMenuOpen(false); }}
                  >
                    <LayoutGrid className="w-3 h-3 shrink-0" />
                    <span className="flex-1 text-[11px] font-medium truncate">{board.name}</span>
                    <span className="text-[9px] text-gray-400">{board.items.length}</span>
                    {boards.length > 1 && (
                      <button
                        className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                        onClick={(e) => { e.stopPropagation(); deleteBoard(board.id); }}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 p-1.5">
                <button
                  className="flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#f26522] hover:bg-[#f26522]/5 transition-colors"
                  onClick={() => { addBoard(); setBoardMenuOpen(false); }}
                >
                  <Plus className="w-3 h-3" />
                  New Board
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center: Powered by */}
        <div className="flex-1 flex justify-center">
          <span className="text-[9px] text-gray-300">
            Powered by <span className="font-semibold text-gray-400">Adletic</span> Digital Marketing Agency &copy; 2026
          </span>
        </div>

        {/* Right: Toggle buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1.5 border border-gray-100">
            {/* Models */}
            <button
              className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                isModelPanelOpen
                  ? "bg-[#f26522] text-white border border-[#f26522]"
                  : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() => setModelPanelOpen(!isModelPanelOpen)}
              title="Models"
            >
              <FileImage className="w-3.5 h-3.5 shrink-0" />
              <span className="flex items-center gap-1 truncate max-w-[12rem]">
                <span className="truncate">{selectedModel?.name || "None"}</span>
              </span>
            </button>

            {/* Prompt Templates */}
            <button
              className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                isTemplatesOpen
                  ? "bg-[#f26522] text-white border border-[#f26522]"
                  : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() => setTemplatesOpen(!isTemplatesOpen)}
              title="Prompt Templates"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Templates</span>
            </button>

            {/* AI Prompt Generator */}
            <button
              className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                isAIPromptOpen
                  ? "bg-[#f26522] text-white border border-[#f26522]"
                  : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
              }`}
              title="AI Prompt Generator"
              onClick={() => setAIPromptOpen(!isAIPromptOpen)}
            >
              <img src="/aios-icon.png" alt="AI" className="w-3.5 h-3.5 rounded-sm" />
              <span>AI</span>
            </button>

            {/* Recent Generations */}
            <button
              className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                isHistoryOpen
                  ? "bg-[#f26522] text-white border border-[#f26522]"
                  : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
              }`}
              title="Recent Generations"
              onClick={() => setHistoryOpen(!isHistoryOpen)}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
            </button>

            {/* Profile & Credits */}
            <button
              className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                isProfileOpen
                  ? "bg-[#f26522] text-white border border-[#f26522]"
                  : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
              }`}
              title="Profile & Credits"
              onClick={() => setProfileOpen(!isProfileOpen)}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
