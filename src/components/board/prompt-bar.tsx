"use client";

import { useState, useRef, useEffect } from "react";
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
  Music,
} from "lucide-react";
import { useAppStore, type BoardItem } from "@/lib/store";
import { getModelById, type ModelOptions } from "@/lib/models";
import { requireAuth } from "@/lib/auth-gate";

export function PromptBar() {
  const [prompt, setPrompt] = useState("");
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [boxW, setBoxW] = useState(320);
  const [boxMinH, setBoxMinH] = useState(70);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
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
    generationOptions,
    setGenerationOption,
    boards,
    activeBoardId,
    addBoard,
    switchBoard,
    deleteBoard,
    theme,
    audioInputId,
    setAudioInput,
  } = useAppStore();
  const isDark = theme === "dark";

  // Auto-resize textarea as content grows (respects manual minH)
  const autoResize = () => {
    const el = promptRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = Math.max(el.scrollHeight, boxMinH) + "px";
  };

  useEffect(() => { autoResize(); }, [prompt, boxMinH]);

  // Drag resize — attaches to document so it works even over canvas
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      setBoxW(Math.max(250, Math.min(900, d.startW - (e.clientX - d.startX))));
      setBoxMinH(Math.max(40, Math.min(500, d.startH - (e.clientY - d.startY))));
    };
    const onUp = () => { setIsDragging(false); dragRef.current = null; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [isDragging]);

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startW: boxW, startH: boxMinH };
    setIsDragging(true);
  };

  // Render model-specific option pills
  const renderOptionPills = () => {
    if (!selectedModel?.options) return null;
    const opts = selectedModel.options;
    const keys = Object.keys(opts) as (keyof ModelOptions)[];
    if (keys.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {keys.map((key) => {
          const opt = opts[key];
          if (!opt) return null;

          // Boolean option (generate_audio)
          if ("default" in opt && typeof opt.default === "boolean") {
            const boolOpt = opt as { default: boolean; label: string };
            const currentVal = generationOptions[key] !== undefined ? !!generationOptions[key] : boolOpt.default;
            return (
              <button
                key={key}
                className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  currentVal
                    ? "bg-[#f26522] text-white shadow-md shadow-[#f26522]/20"
                    : isDark
                    ? "bg-[#161b22] text-gray-300 border border-gray-700 hover:border-[#f26522] hover:text-[#f26522]"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-[#f26522] hover:text-[#f26522] shadow-sm"
                }`}
                onClick={() => setGenerationOption(key, !currentVal)}
                title={boolOpt.label}
              >
                {boolOpt.label}
              </button>
            );
          }

          // Select option (aspect_ratio, duration, resolution)
          const selectOpt = opt as { values: string[]; default: string; label: string };
          const currentVal = (generationOptions[key] as string) || selectOpt.default;

          return (
            <div key={key} className="relative group/opt">
              <button
                className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isDark
                    ? "bg-[#161b22] text-gray-200 border border-gray-700 hover:border-[#f26522] shadow-sm"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-[#f26522] shadow-sm"
                }`}
                title={selectOpt.label}
              >
                <span className={`${isDark ? "text-gray-500" : "text-gray-400"}`}>{selectOpt.label.replace("Aspect Ratio", "AR").replace("Duration", "Dur").replace("Resolution", "Res")}</span>
                <span className="text-[#f26522]">{currentVal}</span>
                <ChevronDown className="w-2.5 h-2.5 text-gray-400" />
              </button>
              <div className={`absolute bottom-full left-0 pb-1 z-50 opacity-0 pointer-events-none group-hover/opt:opacity-100 group-hover/opt:pointer-events-auto transition-all`}>
                <div className={`rounded-xl border shadow-2xl overflow-hidden ${isDark ? "bg-[#0d1117] border-gray-700" : "bg-white border-gray-200"}`}>
                <div className="p-1.5 flex flex-col gap-0.5 min-w-[90px]">
                  {selectOpt.values.map((v) => (
                    <button
                      key={v}
                      className={`text-[10px] px-3 py-1.5 rounded-lg text-left transition-all whitespace-nowrap font-medium ${
                        currentVal === v
                          ? "bg-[#f26522] text-white"
                          : isDark
                          ? "text-gray-300 hover:bg-white/10"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => setGenerationOption(key, v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Consume pending prompt from templates panel
  useEffect(() => {
    if (pendingPrompt) {
      setPrompt(pendingPrompt);
      setPendingPrompt(null);
    }
  }, [pendingPrompt, setPendingPrompt]);

  const selectedModel = selectedModelId ? getModelById(selectedModelId) : null;

  const getCenterPosition = (w: number, h: number) => ({
    x: (-panX + window.innerWidth / 2 - w / 2) / zoom,
    y: (-panY + window.innerHeight / 2 - h / 2) / zoom,
  });

  const parseModelSpeed = (speed?: string): number => {
    if (!speed) return 60;
    const m = speed.match(/(\d+)\s*m/);
    const s = speed.match(/(\d+)\s*s/);
    return (m ? parseInt(m[1]) * 60 : 0) + (s ? parseInt(s[1]) : 0) || 60;
  };

  const handleGenerate = async () => {
    if (!selectedModel) return;
    if (!prompt.trim() && selectedModel.inputs.some((i) => i.type === "text" && i.required)) return;

    // Check required inputs (instant, no network calls)
    const needsImage = selectedModel.inputs.some((i) => i.type === "image" && i.required);
    const needsVideo = selectedModel.inputs.some((i) => i.type === "video" && i.required);
    const needsAudio = selectedModel.inputs.some((i) => i.type === "audio" && i.required);
    const hasImageInput = inputRefs.length > 0 || startFrameId;
    const hasVideoInput = inputRefs.some((id) => items.find((i) => i.id === id)?.type === "video");
    const { audioInputId: currentAudioId } = useAppStore.getState();
    const audioItem = currentAudioId ? items.find((i) => i.id === currentAudioId) : null;

    if (selectedModel.type === "s2e") {
      if (!startFrameId) { alert(`${selectedModel.name} requires a Start Frame.`); return; }
      if (!endFrameId) { alert(`${selectedModel.name} requires an End Frame.`); return; }
    }
    if (needsImage && !hasImageInput) { alert(`${selectedModel.name} requires an image input.`); return; }
    if (needsVideo && !hasVideoInput && !inputRefs.length) { alert(`${selectedModel.name} requires a video input.`); return; }
    if (needsAudio && !audioItem) { alert(`${selectedModel.name} requires an audio input.`); return; }

    // Create item IMMEDIATELY at center of screen — zero latency
    setIsGenerating(true);

    const outputType =
      selectedModel.type === "audio" || selectedModel.type === "a2a"
        ? "audio"
        : ["t2i", "i2i", "upscale"].includes(selectedModel.type)
        ? "image"
        : "video";

    const ar = (generationOptions.aspect_ratio as string) || selectedModel.options?.aspect_ratio?.default || "16:9";
    let genW = 300;
    let genH = outputType === "audio" ? 80 : 200;
    if (outputType !== "audio") {
      const arParts = ar.split(":").map(Number);
      if (arParts.length === 2 && arParts[0] > 0 && arParts[1] > 0) {
        genH = Math.round(genW * (arParts[1] / arParts[0]));
      }
    }

    const pos = getCenterPosition(genW, genH);

    const genItem: BoardItem = {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "generation",
      x: pos.x,
      y: pos.y,
      width: genW,
      height: genH,
      src: "",
      prompt,
      model: selectedModel.id,
      modelName: selectedModel.name,
      status: "processing",
      outputType,
      progressText: "Starting...",
      expectedDuration: parseModelSpeed(selectedModel.speed),
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
          inputImage: refItems[0]?.outputUrl || refItems[0]?.src || startItem?.outputUrl || startItem?.src || null,
          inputImages: refItems.map((r) => r?.outputUrl || r?.src).filter(Boolean),
          startFrame: startItem?.outputUrl || startItem?.src || null,
          endFrame: endItem?.outputUrl || endItem?.src || null,
          inputAudio: audioItem?.outputUrl || audioItem?.src || null,
          generationOptions: Object.keys(generationOptions).length > 0 ? generationOptions : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        useAppStore.getState().removeItem(genItem.id);
        if (res.status === 401) { window.location.href = "/signup"; return; }
        alert(data.error || "Generation failed");
        return;
      }

      // Poll for status — no timeout limit, works with any Vercel plan
      let currentRequestId = data.requestId;
      let currentModelId = data.modelId;
      const generationId = data.generationId;
      const ttsStep = data.ttsStep || null; // Voice Clone TTS 2-step info
      useAppStore.getState().updateItem(genItem.id, { progressText: ttsStep ? "Cloning voice..." : "Queued..." });

      const poll = async () => {
        try {
          let url = `/api/generate/status?requestId=${currentRequestId}&modelId=${encodeURIComponent(currentModelId)}&generationId=${generationId}`;
          if (ttsStep && currentModelId.includes("clone-voice")) {
            url += `&ttsInput=${encodeURIComponent(JSON.stringify(ttsStep.input))}&ttsModelId=${encodeURIComponent(ttsStep.modelId)}`;
          }
          const statusRes = await fetch(url);
          const statusData = await statusRes.json();

          // Voice Clone: clone step done, now poll the TTS step
          if (statusData.nextRequestId) {
            currentRequestId = statusData.nextRequestId;
            currentModelId = statusData.nextModelId;
            useAppStore.getState().updateItem(genItem.id, { progressText: "Generating speech..." });
            setTimeout(poll, 2000);
            return;
          }

          if (statusData.status === "completed") {
            useAppStore.getState().updateItem(genItem.id, {
              status: "completed",
              outputUrl: statusData.outputUrl,
              cost: selectedModel.cost,
              progressText: undefined,
            });

            // Auto-resize card
            if (statusData.outputUrl) {
              if (outputType === "image") {
                const img = new window.Image();
                img.onload = () => {
                  const maxW = 400;
                  const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
                  useAppStore.getState().updateItem(genItem.id, { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) });
                };
                img.src = statusData.outputUrl;
              } else if (outputType === "video") {
                const vid = document.createElement("video");
                vid.preload = "metadata";
                vid.onloadedmetadata = () => {
                  const maxW = 400;
                  const scale = vid.videoWidth > maxW ? maxW / vid.videoWidth : 1;
                  useAppStore.getState().updateItem(genItem.id, { width: Math.round(vid.videoWidth * scale), height: Math.round(vid.videoHeight * scale) });
                };
                vid.src = statusData.outputUrl;
              }
            }
            setIsGenerating(false);
            return;
          }

          if (statusData.status === "failed") {
            useAppStore.getState().updateItem(genItem.id, {
              status: "failed",
              error: statusData.error || "Generation failed",
              progressText: undefined,
            });
            setIsGenerating(false);
            return;
          }

          // Still processing — update progress text and poll again
          const progressMsg = statusData.log || (statusData.position != null ? `Queued #${statusData.position}` : statusData.status === "queued" ? "Queued..." : "Processing...");
          useAppStore.getState().updateItem(genItem.id, { progressText: progressMsg });
          setTimeout(poll, 3000); // Poll every 3 seconds
        } catch {
          // Network error — retry
          setTimeout(poll, 5000);
        }
      };

      poll();
      return; // Don't hit the finally block yet — polling handles setIsGenerating
    } catch (err) {
      useAppStore.getState().updateItem(genItem.id, {
        status: "failed",
        error: err instanceof Error ? err.message : "Generation failed",
        progressText: undefined,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Context for selected item — model-aware reference buttons
  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) : null;
  const isSelectedImage = selectedItem && (selectedItem.type === "image" || selectedItem.type === "psd-layer" || (selectedItem.type === "generation" && selectedItem.outputType === "image"));
  const isSelectedVideo = selectedItem && (selectedItem.type === "video" || (selectedItem.type === "generation" && selectedItem.outputType === "video"));
  const isSelectedAudio = selectedItem && (selectedItem.type === "audio" || (selectedItem.type === "generation" && selectedItem.outputType === "audio"));

  // Determine which reference types apply to current model
  const modelType = selectedModel?.type;
  const showStartFrame = modelType === "s2e" && isSelectedImage;
  const showEndFrame = modelType === "s2e" && isSelectedImage;

  // Check what input types the model needs
  const modelNeedsImage = selectedModel?.inputs.some((inp) => inp.type === "image");
  const modelNeedsVideo = selectedModel?.inputs.some((inp) => inp.type === "video");
  const modelNeedsAudio = selectedModel?.inputs.some((inp) => inp.type === "audio");

  // Only show INPUT button if selected item matches what the model accepts
  const showInput = modelType && (
    (modelNeedsImage && isSelectedImage) ||
    (modelNeedsVideo && isSelectedVideo)
  );
  const showAudioInput = modelNeedsAudio && isSelectedAudio;
  const canSetAsRef = selectedItem && (isSelectedImage || isSelectedVideo || isSelectedAudio);
  const showAnyRef = showStartFrame || showEndFrame || showInput || showAudioInput;

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

  const audioItem = audioInputId ? items.find((i) => i.id === audioInputId) : null;
  const hasAnyInputs = refItems.length > 0 || startItem || endItem || audioItem;
  const isCanvasEmpty = items.length === 0;

  // Auto-focus prompt on empty canvas
  useEffect(() => {
    if (isCanvasEmpty && promptRef.current) {
      setTimeout(() => promptRef.current?.focus(), 300);
    }
  }, [isCanvasEmpty]);

  // Floating hero images for empty canvas
  const heroImages = [
    { src: "/hero/h1.jpg", x: "8%", y: "12%", w: 120, delay: 0, rotate: -6 },
    { src: "/hero/h2.jpg", x: "78%", y: "8%", w: 140, delay: 0.2, rotate: 5 },
    { src: "/hero/h3.jpg", x: "4%", y: "55%", w: 110, delay: 0.4, rotate: -4 },
    { src: "/hero/h4.jpg", x: "82%", y: "50%", w: 130, delay: 0.6, rotate: 7 },
    { src: "/hero/h5.jpg", x: "18%", y: "75%", w: 100, delay: 0.8, rotate: -3 },
    { src: "/hero/h6.jpg", x: "72%", y: "78%", w: 115, delay: 1.0, rotate: 4 },
    { src: "/hero/h7.jpg", x: "35%", y: "5%", w: 90, delay: 0.3, rotate: -2 },
    { src: "/hero/h8.jpg", x: "55%", y: "4%", w: 95, delay: 0.5, rotate: 3 },
  ];

  // Centered hero prompt for empty canvas
  if (isCanvasEmpty) {
    return (
      <>
        {/* Floating hero images */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {heroImages.map((img, i) => (
            <div
              key={i}
              className="absolute rounded-xl overflow-hidden shadow-lg opacity-0 border-2 border-white/20"
              style={{
                left: img.x,
                top: img.y,
                width: img.w,
                height: img.w * 0.7,
                transform: `rotate(${img.rotate}deg)`,
                animation: `heroFloat${i % 3} 6s ease-in-out infinite, heroFadeIn 0.8s ease-out ${img.delay}s forwards`,
              }}
            >
              <img
                src={img.src}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          ))}
          <style>{`
            @keyframes heroFloat0 { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-12px) rotate(-4deg); } }
            @keyframes heroFloat1 { 0%, 100% { transform: translateY(0) rotate(5deg); } 50% { transform: translateY(-15px) rotate(7deg); } }
            @keyframes heroFloat2 { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-10px) rotate(-1deg); } }
            @keyframes heroFadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 0.35; } }
          `}</style>
        </div>

        {/* Centered prompt */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="pointer-events-auto w-full max-w-xl px-4">
            <div className="text-center mb-6">
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-[#0d1117]"}`}>
                Describe anything. We'll generate it.
              </h2>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Type your prompt and {selectedModel?.name || "AI"} will create it for you
              </p>
            </div>
            <div className="relative">
              <textarea
                ref={promptRef}
                placeholder={selectedModel ? `Describe what ${selectedModel.name} should create...` : "Select a model first"}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                className={`w-full backdrop-blur-md text-sm placeholder-gray-400 border-2 rounded-2xl transition-all duration-200 focus:outline-none focus:border-[#f26522] focus:ring-4 focus:ring-[#f26522]/10 shadow-xl px-5 pt-4 pb-14 resize-none leading-5 ${isDark ? "bg-[#161b22] text-white border-gray-700" : "bg-white text-[#0d1117] border-gray-200"}`}
                style={{ height: 120 }}
              />
              {/* Bottom row inside textarea */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedModel && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                      {selectedModel.name} &middot; {selectedModel.cost}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isGenerating || !selectedModel}
                  onClick={handleGenerate}
                  className={`flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold transition-all ${
                    isGenerating || !selectedModel
                      ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                      : "bg-[#f26522] text-white hover:bg-[#d9541a] cursor-pointer hover:scale-105"
                  }`}
                  title="Generate (Ctrl+Enter)"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <WandSparkles className="h-3.5 w-3.5" />
                  )}
                  Generate
                </button>
              </div>
            </div>
            {/* Model generation options */}
            <div className="flex justify-center">
              {renderOptionPills()}
            </div>
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {[
                "Cinematic drone shot of a city at golden hour",
                "Slow motion coffee pour, macro lens",
                "Anime fight scene with speed lines",
              ].map((s) => (
                <button
                  key={s}
                  className={`text-[10px] px-3 py-1.5 rounded-full border transition-colors ${isDark ? "text-gray-400 border-gray-700 hover:border-[#f26522] hover:text-[#f26522]" : "text-gray-500 border-gray-200 hover:border-[#f26522] hover:text-[#f26522]"}`}
                  onClick={() => setPrompt(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom toolbar — always visible */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col pointer-events-none">
          <div className={`pointer-events-auto relative flex h-full w-full items-center backdrop-blur-md px-2.5 py-1 border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)] ${isDark ? "bg-[#161b22]/95 border-gray-700" : "bg-white/95 border-gray-200"}`}>
            {/* Left: Board selector */}
            <div className="relative">
              <button
                className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors min-w-0 ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-100"}`}
                onClick={() => setBoardMenuOpen(!boardMenuOpen)}
              >
                <span className="flex items-center gap-1 min-w-0">
                  <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                  <span className={`truncate max-w-[120px] ${isDark ? "text-white" : "text-[#0d1117]"}`}>{boardName}</span>
                </span>
                <ChevronDown className="w-2.5 h-2.5 flex-shrink-0 text-gray-400" />
              </button>
            </div>

            {/* Center */}
            <div className="flex-1 flex justify-center">
              <span className="text-[9px] text-gray-300 flex items-center gap-1">
                Developed by <img src="/adletic-logo.jpg" alt="Adletic" className="h-4 w-4 rounded-sm inline-block" /> <span className="font-semibold text-gray-400">Adletic</span> &copy; 2026
              </span>
            </div>

            {/* Right: Toggle buttons */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 rounded-lg p-1.5 border ${isDark ? "bg-[#0d1117] border-gray-700" : "bg-gray-50 border-gray-100"}`}>
                <button
                  className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                    isModelPanelOpen
                      ? "bg-[#f26522] text-white border border-[#f26522]"
                      : isDark ? "bg-[#161b22] text-gray-300 hover:bg-white/10 border border-gray-700" : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
                  }`}
                  onClick={() => setModelPanelOpen(!isModelPanelOpen)}
                  title="Models"
                >
                  <FileImage className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex items-center gap-1 truncate max-w-[12rem]">
                    <span className="truncate">{selectedModel?.name || "None"}</span>
                  </span>
                </button>
                <button
                  className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                    isProfileOpen
                      ? "bg-[#f26522] text-white border border-[#f26522]"
                      : isDark ? "bg-[#161b22] text-gray-300 hover:bg-white/10 border border-gray-700" : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
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
      </>
    );
  }

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
          {showAudioInput && (
            <button
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                audioInputId === selectedItem!.id
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              onClick={() => setAudioInput(audioInputId === selectedItem!.id ? null : selectedItem!.id)}
            >
              Audio
            </button>
          )}
        </div>
      )}

      {/* Prompt chatbox (floating bottom-right) */}
      <div className="flex items-end justify-end px-2 pb-1">
        <div className="pointer-events-auto flex flex-col items-end" style={{ width: boxW }}>
          {/* Drag overlay — covers entire screen while resizing so mouse is never lost */}
          {isDragging && (
            <div className="fixed inset-0 z-[9999] cursor-nw-resize" style={{ pointerEvents: "all" }} />
          )}

          {/* Input previews row */}
          {hasAnyInputs && (
            <div className="flex items-center gap-1.5 mb-1.5 px-1 self-start">
              {startItem && (
                <div className="relative group/thumb">
                  <img src={startItem.outputUrl || startItem.src} alt="Start" className="h-10 w-10 rounded-md object-cover border border-green-500/60" />
                  <span className="absolute -top-1.5 -left-1 bg-green-600 text-white text-[7px] font-bold px-1 rounded leading-tight">S</span>
                  <button className="absolute -top-1 -right-1 bg-neutral-800 rounded-full p-0.5 text-neutral-400 hover:text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" onClick={() => setStartFrame(null)}><X className="h-2 w-2" /></button>
                </div>
              )}
              {endItem && (
                <div className="relative group/thumb">
                  <img src={endItem.outputUrl || endItem.src} alt="End" className="h-10 w-10 rounded-md object-cover border border-red-500/60" />
                  <span className="absolute -top-1.5 -left-1 bg-red-600 text-white text-[7px] font-bold px-1 rounded leading-tight">E</span>
                  <button className="absolute -top-1 -right-1 bg-neutral-800 rounded-full p-0.5 text-neutral-400 hover:text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" onClick={() => useAppStore.getState().setEndFrame(null)}><X className="h-2 w-2" /></button>
                </div>
              )}
              {refItems.map((item, i) => (
                <div key={item.id} className="relative group/thumb">
                  <img src={item.outputUrl || item.src} alt={`Input ${i + 1}`} className="h-10 w-10 rounded-md object-cover border border-emerald-500/60" />
                  <span className="absolute -top-1.5 -left-1 bg-emerald-600 text-white text-[7px] font-bold px-1 rounded leading-tight">{i + 1}</span>
                  <button className="absolute -top-1 -right-1 bg-neutral-800 rounded-full p-0.5 text-neutral-400 hover:text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" onClick={() => useAppStore.setState({ inputRefs: inputRefs.slice(0, i) })}><X className="h-2 w-2" /></button>
                </div>
              ))}
              {audioItem && (
                <div className="relative group/thumb">
                  <div className="h-10 w-10 rounded-md border border-purple-500/60 bg-purple-500/10 flex items-center justify-center"><Music className="h-4 w-4 text-purple-400" /></div>
                  <span className="absolute -top-1.5 -left-1 bg-purple-600 text-white text-[7px] font-bold px-1 rounded leading-tight">A</span>
                  <button className="absolute -top-1 -right-1 bg-neutral-800 rounded-full p-0.5 text-neutral-400 hover:text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" onClick={() => setAudioInput(null)}><X className="h-2 w-2" /></button>
                </div>
              )}
            </div>
          )}

          {/* Option pills — outside the chatbox */}
          <div className="flex justify-end mb-1">
            {renderOptionPills()}
          </div>

          {/* The chatbox */}
          <div className={`w-full rounded-2xl border shadow-lg flex flex-col ${isDark ? "bg-[#161b22] border-gray-700" : "bg-white border-gray-200"}`}>
            {/* Top resize bar — drag left/up to resize */}
            <div
              className={`flex items-center justify-center h-5 cursor-nw-resize select-none shrink-0 rounded-t-2xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
              onMouseDown={onDragStart}
            >
              <div className={`flex gap-[3px] ${isDark ? "text-gray-600" : "text-gray-300"}`}>
                <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor">
                  <circle cx="2" cy="2" r="1.2" />
                  <circle cx="6" cy="2" r="1.2" />
                  <circle cx="10" cy="2" r="1.2" />
                  <circle cx="14" cy="2" r="1.2" />
                </svg>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              ref={promptRef}
              placeholder={selectedModel ? `Describe what ${selectedModel.name} should create...` : "No prompt required"}
              disabled={!selectedModel}
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); autoResize(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleGenerate(); }
              }}
              className={`w-full text-xs placeholder-gray-400 px-3 pt-1 pb-1 resize-none leading-5 bg-transparent focus:outline-none flex-1 ${isDark ? "text-white" : "text-[#0d1117]"}`}
              style={{ minHeight: boxMinH, maxHeight: 500 }}
            />

            {/* Bottom bar — cost + generate */}
            <div className="flex items-center justify-between px-2.5 pb-2 pt-1 shrink-0">
              {selectedModel && <span className="text-[9px] text-gray-400">{selectedModel.cost}</span>}
              {!selectedModel && <span />}
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
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className={`pointer-events-auto relative flex h-full w-full items-center backdrop-blur-md px-2.5 py-1 border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)] ${isDark ? "bg-[#161b22]/95 border-gray-700" : "bg-white/95 border-gray-200"}`}>
        {/* Left: Board selector */}
        <div className="relative">
          <button
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors min-w-0 ${isDark ? "text-white hover:bg-white/10" : "text-[#0d1117] hover:bg-gray-100"}`}
            onClick={() => setBoardMenuOpen(!boardMenuOpen)}
          >
            <span className="flex items-center gap-1 min-w-0">
              <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className={`truncate max-w-[120px] ${isDark ? "text-white" : "text-[#0d1117]"}`}>{boardName}</span>
            </span>
            <ChevronDown className="w-2.5 h-2.5 flex-shrink-0 text-gray-400" />
          </button>

          {/* Board dropdown */}
          {boardMenuOpen && (
            <div className={`absolute bottom-full left-0 mb-1 w-52 rounded-xl border shadow-xl overflow-hidden z-50 ${isDark ? "border-gray-700 bg-[#161b22]" : "border-gray-200 bg-white"}`}>
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

        {/* Center: Developed by Adletic */}
        <div className="flex-1 flex justify-center">
          <span className="text-[9px] text-gray-300 flex items-center gap-1">
            Developed by <img src="/adletic-logo.jpg" alt="Adletic" className="h-4 w-4 rounded-sm inline-block" /> <span className="font-semibold text-gray-400">Adletic</span> &copy; 2026
          </span>
        </div>

        {/* Right: Toggle buttons */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 rounded-lg p-1.5 border ${isDark ? "bg-[#0d1117] border-gray-700" : "bg-gray-50 border-gray-100"}`}>
            {/* Models */}
            <button
              className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                isModelPanelOpen
                  ? "bg-[#f26522] text-white border border-[#f26522]"
                  : isDark ? "bg-[#161b22] text-gray-300 hover:bg-white/10 border border-gray-700" : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
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
                  : isDark ? "bg-[#161b22] text-gray-300 hover:bg-white/10 border border-gray-700" : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
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
                  : isDark ? "bg-[#161b22] text-gray-300 hover:bg-white/10 border border-gray-700" : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
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
                  : isDark ? "bg-[#161b22] text-gray-300 hover:bg-white/10 border border-gray-700" : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
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
                  : isDark ? "bg-[#161b22] text-gray-300 hover:bg-white/10 border border-gray-700" : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
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
