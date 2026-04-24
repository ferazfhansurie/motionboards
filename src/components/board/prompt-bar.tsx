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
  Download,
  Upload,
} from "lucide-react";
import { useAppStore, type BoardItem } from "@/lib/store";
import { importBoardFromFile, ImportCancelled } from "@/lib/board-io";
import { getModelById, type ModelOptions, type AIModel } from "@/lib/models";
import { requireAuth } from "@/lib/auth-gate";
import { askConfirm, askPrompt, showToast } from "@/lib/ui-store";
import { Pencil } from "lucide-react";

function getEstimatedCost(model: AIModel | null, opts: Record<string, unknown>): string {
  if (!model) return "";
  if (!model.perSecond) return model.cost;
  // Calculate based on selected duration, resolution, audio
  const durStr = (opts.duration as string) || model.options?.duration?.default || "8s";
  const seconds = parseInt(durStr) || 8;
  const res = (opts.resolution as string) || model.options?.resolution?.default || "720p";
  const audio = opts.generate_audio !== undefined ? !!opts.generate_audio : (model.options?.generate_audio?.default ?? true);
  const is4k = res === "4k";
  const rate = is4k
    ? (audio ? model.perSecond.withAudio4k : model.perSecond.noAudio4k)
    : (audio ? model.perSecond.withAudio720p : model.perSecond.noAudio720p);
  const total = (rate * seconds).toFixed(2);
  return `~RM${total} (${seconds}s × RM${rate.toFixed(2)}/s)`;
}

// Module-scoped registry of items we're actively polling, so a remount (or
// a second PromptBar instance) never doubles up the poll for the same id.
const activePollers = new Set<string>();

// Start a poll loop for a generation that's currently running on a provider's
// async pipeline. Called from the submit flow (fresh generation) AND from the
// refresh-resume effect (in-flight generation whose client poll was killed
// by a page reload).
function startPolling(params: {
  itemId: string;
  requestId: string;
  modelId: string;
  generationId: string;
  pollProvider: NonNullable<BoardItem["pollProvider"]>;
  outputType?: BoardItem["outputType"];
}) {
  if (activePollers.has(params.itemId)) return;
  activePollers.add(params.itemId);

  const flagQuery =
    params.pollProvider === "gemini" ? "&geminiVideo=true" :
    params.pollProvider === "openai" ? "&openaiVideo=true" :
    params.pollProvider === "replicate" ? "&replicateVideo=true" :
    params.pollProvider === "byteplus" ? "&byteplusVideo=true" :
    "&comfyVideo=true";

  const finalize = (patch: Partial<BoardItem>) => {
    useAppStore.getState().updateItem(params.itemId, {
      ...patch,
      progressText: undefined,
      requestId: undefined,
      pollProvider: undefined,
    });
    activePollers.delete(params.itemId);
  };

  const poll = async () => {
    try {
      const url =
        `/api/generate/status?requestId=${encodeURIComponent(params.requestId)}` +
        `&modelId=${encodeURIComponent(params.modelId)}` +
        `&generationId=${encodeURIComponent(params.generationId)}` +
        flagQuery;
      const res = await fetch(url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      try { data = await res.json(); }
      catch {
        const text = await res.text().catch(() => "");
        data = { status: "failed", error: text ? text.slice(0, 200) : `HTTP ${res.status}` };
      }

      if (data.status === "completed") {
        finalize({ status: "completed", outputUrl: data.outputUrl });
        if (data.outputUrl) {
          if (params.outputType === "image") {
            const img = new window.Image();
            img.onload = () => {
              const maxW = 250;
              const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
              useAppStore.getState().updateItem(params.itemId, {
                width: Math.round(img.naturalWidth * scale),
                height: Math.round(img.naturalHeight * scale),
              });
            };
            img.src = data.outputUrl;
          } else if (params.outputType === "video") {
            const vid = document.createElement("video");
            vid.preload = "metadata";
            vid.onloadedmetadata = () => {
              const maxW = 250;
              const scale = vid.videoWidth > maxW ? maxW / vid.videoWidth : 1;
              useAppStore.getState().updateItem(params.itemId, {
                width: Math.round(vid.videoWidth * scale),
                height: Math.round(vid.videoHeight * scale),
              });
            };
            vid.src = data.outputUrl;
          }
        }
        return;
      }
      if (data.status === "failed") {
        finalize({ status: "failed", error: data.error || "Generation failed" });
        return;
      }

      // Still running — refresh progress text and poll again.
      const msg = data.log || (data.position != null ? `Queued #${data.position}` : data.status === "queued" ? "Queued..." : "Processing...");
      useAppStore.getState().updateItem(params.itemId, { progressText: msg });
      setTimeout(poll, 8000); // 8s between polls — 60% fewer status calls than the old 3s
    } catch {
      setTimeout(poll, 15000); // back off further on network errors
    }
  };

  poll();
}

export function PromptBar() {
  const [prompt, setPrompt] = useState("");
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [modelStats, setModelStats] = useState<Record<string, { avgSeconds: number; count: number }>>({});
  const [boardIoBusy, setBoardIoBusy] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  // Active background export jobs — polled while the menu is open so the user
  // sees live progress without having to open the Profile panel.
  interface ExportJob {
    id: string;
    boardName: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress: number;
    total: number;
    fileId: string | null;
    fileName: string | null;
    error: string | null;
    createdAt: string;
  }
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [boxW, setBoxW] = useState(320);
  const [boxMinH, setBoxMinH] = useState(70);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const {
    selectedModelId,
    setModelPanelOpen,
    isModelPanelOpen,
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
    renameBoard,
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

  // If the persisted selectedModelId no longer exists in the catalog (the
  // model was removed or renamed between deploys) or is now marked disabled,
  // reset to a safe default — otherwise the first generate click returns a
  // server-side "Invalid model" error with no obvious way to recover.
  useEffect(() => {
    if (!selectedModelId) return;
    const m = getModelById(selectedModelId);
    if (!m || m.disabled) {
      useAppStore.getState().setSelectedModel("gemini-3.1-flash-image-preview");
    }
  }, [selectedModelId]);

  // Fetch empirical per-model processing times once on mount.
  useEffect(() => {
    fetch("/api/model-stats")
      .then((r) => r.ok ? r.json() : { stats: [] })
      .then((data) => {
        const map: Record<string, { avgSeconds: number; count: number }> = {};
        for (const s of (data.stats || []) as Array<{ model: string; avgSeconds: number; count: number }>) {
          map[s.model] = { avgSeconds: s.avgSeconds, count: s.count };
        }
        setModelStats(map);
      })
      .catch(() => {});
  }, []);

  // Resume polling for any generation that was mid-flight when the page was
  // last closed/refreshed. Runs on mount only — startPolling is idempotent
  // via a module-level Set keyed by item id, and the submit handler kicks off
  // its own poller for fresh generations.
  useEffect(() => {
    const items = useAppStore.getState().items;
    for (const it of items) {
      if (it.status !== "processing") continue;
      if (!it.requestId || !it.generationId || !it.pollProvider || !it.model) continue;
      startPolling({
        itemId: it.id,
        requestId: it.requestId,
        modelId: it.model,
        generationId: it.generationId,
        pollProvider: it.pollProvider,
        outputType: it.outputType,
      });
    }
  }, []);

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

  // Live per-model averages from /api/model-stats. Replaces the static
  // `speed: "~4m"` estimate when we have enough history (>= 3 completed runs
  // on that model) to trust the number. Refreshed on mount; falls back to
  // the string hint otherwise.
  const estimateDurationForModel = (modelId: string, fallbackSpeed?: string): number => {
    const stat = modelStats[modelId];
    if (stat && stat.count >= 3 && stat.avgSeconds > 0) return stat.avgSeconds;
    return parseModelSpeed(fallbackSpeed);
  };

  // Load export jobs + auto-poll while the board menu is open
  const loadExportJobs = async () => {
    try {
      const res = await fetch("/api/board-exports");
      const data = await res.json();
      if (Array.isArray(data.jobs)) setExportJobs(data.jobs);
    } catch {
      // noop
    }
  };

  useEffect(() => {
    if (!boardMenuOpen) return;
    loadExportJobs();
    const interval = setInterval(() => {
      setExportJobs((prev) => {
        // Only poll if something is still running, OR we haven't loaded yet
        if (prev.length === 0 || prev.some((j) => j.status === "pending" || j.status === "processing")) {
          loadExportJobs();
        }
        return prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [boardMenuOpen]);

  const handleDeleteExportJob = async (id: string) => {
    try {
      await fetch(`/api/board-exports/${id}`, { method: "DELETE" });
      setExportJobs((prev) => prev.filter((j) => j.id !== id));
    } catch {
      // noop
    }
  };

  const handleExportBoard = async () => {
    const store = useAppStore.getState();
    const active = store.boards.find((b) => b.id === store.activeBoardId);
    if (!active) return;
    const liveBoard = {
      name: active.name,
      items: store.items,
      connections: store.connections,
      panX: store.panX,
      panY: store.panY,
      zoom: store.zoom,
    };
    setBoardIoBusy("Queueing export...");
    try {
      const json = JSON.stringify({ board: liveBoard });
      // gzip large payloads so we fit under Vercel's 4.5MB request limit
      let bodyInit: BodyInit = json;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (typeof CompressionStream !== "undefined") {
        const encoded = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
        bodyInit = await new Response(encoded).arrayBuffer();
        headers["Content-Encoding"] = "gzip";
      }
      const res = await fetch("/api/board-exports", { method: "POST", headers, body: bodyInit });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setBoardIoBusy(null);
      // Optimistically add the job to the list so the user sees it immediately
      if (data.job) setExportJobs((prev) => [data.job, ...prev]);
      // Keep the menu open so the user can watch progress
    } catch (err) {
      setBoardIoBusy(null);
      showToast(err instanceof Error ? err.message : "Export failed", { kind: "error" });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be re-picked later
    if (!file) return;
    const controller = new AbortController();
    importAbortRef.current = controller;
    setBoardIoBusy("Reading file...");
    try {
      const { board, skipped } = await importBoardFromFile(
        file,
        (done, total) => setBoardIoBusy(`Importing ${done}/${total}...`),
        controller.signal
      );
      useAppStore.getState().insertImportedBoard(board);
      setBoardIoBusy(null);
      setBoardMenuOpen(false);
      if (skipped > 0) showToast(`Imported with ${skipped} media items that stayed as data URIs.`, { kind: "info" });
    } catch (err) {
      setBoardIoBusy(null);
      if (err instanceof ImportCancelled) return; // silent cancel
      showToast(err instanceof Error ? err.message : "Import failed", { kind: "error" });
    } finally {
      importAbortRef.current = null;
    }
  };

  const cancelImport = () => {
    importAbortRef.current?.abort();
    importAbortRef.current = null;
    setBoardIoBusy(null);
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
      if (!startFrameId) { showToast(`${selectedModel.name} needs a Start Frame`, { kind: "info" }); return; }
      if (!endFrameId) { showToast(`${selectedModel.name} needs an End Frame`, { kind: "info" }); return; }
    }
    if (needsImage && !hasImageInput) { showToast(`${selectedModel.name} needs an image input`, { kind: "info" }); return; }
    if (needsVideo && !hasVideoInput && !inputRefs.length) { showToast(`${selectedModel.name} needs a video input`, { kind: "info" }); return; }
    if (needsAudio && !audioItem) { showToast(`${selectedModel.name} needs an audio input`, { kind: "info" }); return; }

    // Create item IMMEDIATELY at center of screen — zero latency

    const outputType =
      selectedModel.type === "audio" || selectedModel.type === "a2a" || selectedModel.type === "sfx"
        ? "audio"
        : ["t2i", "i2i", "upscale"].includes(selectedModel.type)
        ? "image"
        : "video";

    const ar = (generationOptions.aspect_ratio as string) || selectedModel.options?.aspect_ratio?.default || "16:9";
    let genW = 180;
    let genH = outputType === "audio" ? 60 : 120;
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
      expectedDuration: estimateDurationForModel(selectedModel.id, selectedModel.speed),
      createdAt: new Date().toISOString(),
    };

    addItem(genItem);

    // Auto-link the generation back to its source frames/inputs/audio so the
    // user can see what fed into each generation. Toggleable from Profile.
    const store = useAppStore.getState();
    if (store.autoConnectGenerations) {
      const sourceIds = new Set<string>();
      if (startFrameId) sourceIds.add(startFrameId);
      if (endFrameId) sourceIds.add(endFrameId);
      for (const refId of inputRefs) sourceIds.add(refId);
      if (audioInputId) sourceIds.add(audioInputId);
      for (const sid of sourceIds) {
        if (sid !== genItem.id) store.addConnection(sid, genItem.id);
      }
    }

    try {
      const startItem = startFrameId ? items.find((i) => i.id === startFrameId) : null;
      const endItem = endFrameId ? items.find((i) => i.id === endFrameId) : null;
      const refItems = inputRefs.map((id) => items.find((i) => i.id === id)).filter(Boolean);

      // Resolve image URLs — wait for blob: / data: URLs to finish uploading.
      // Sending raw data: URIs to /api/generate would balloon the body past
      // Vercel's 4.5MB limit (the user sees an HTML "Request Entity Too
      // Large" page that fails to JSON-parse).
      const isUnfinalized = (u: string | null | undefined) =>
        !!u && (u.startsWith("blob:") || u.startsWith("data:"));
      const hasUnfinalized = [...refItems, startItem, endItem, audioItem].some((it) => {
        const u = it?.outputUrl || it?.src;
        return isUnfinalized(u);
      });
      if (hasUnfinalized) {
        useAppStore.getState().updateItem(genItem.id, { progressText: "Waiting for file upload..." });
      }
      const resolveUrl = async (item: BoardItem | null | undefined): Promise<string | null> => {
        if (!item) return null;
        const url = item.outputUrl || item.src || null;
        if (!url) return null;
        if (!isUnfinalized(url)) return url;

        // First wait up to 5s for any background upload to swap in a real URL
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const fresh = useAppStore.getState().items.find((it) => it.id === item.id);
          const freshUrl = fresh?.outputUrl || fresh?.src || null;
          if (freshUrl && !isUnfinalized(freshUrl)) return freshUrl;
        }

        // Background upload didn't finish (or failed) — try uploading right now.
        // Works for both data: URIs (turn the base64 into a Blob) and blob: URLs
        // (fetch returns the Blob directly).
        try {
          const blobRes = await fetch(url);
          if (!blobRes.ok) throw new Error(`Couldn't read source (${blobRes.status})`);
          const blob = await blobRes.blob();
          if (blob.size === 0) throw new Error("Source is empty — paste/upload may have failed");
          const ext = (blob.type.split("/")[1] || "bin").split(";")[0];
          const file = new File([blob], `${item.id}.${ext}`, { type: blob.type || "application/octet-stream" });
          const form = new FormData();
          form.append("file", file);
          const upRes = await fetch("/api/upload", { method: "POST", body: form });
          if (!upRes.ok) {
            // Try to read the error message from the response
            let detail = `HTTP ${upRes.status}`;
            try {
              const errData = await upRes.json();
              if (errData?.error) detail = errData.error;
            } catch {
              const text = await upRes.text().catch(() => "");
              if (text) detail = text.slice(0, 120);
            }
            console.error("[resolveUrl] /api/upload failed:", detail, { url: url.slice(0, 80), size: blob.size, type: blob.type });
            // Special-case the common ones
            if (upRes.status === 401) throw new Error("Session expired — please refresh and try again.");
            if (upRes.status === 413) {
              const mb = (blob.size / 1024 / 1024).toFixed(1);
              const kind = blob.type.startsWith("video/") ? "Video"
                : blob.type.startsWith("audio/") ? "Audio"
                : blob.type.startsWith("image/") ? "Image"
                : "File";
              throw new Error(`${kind} too large (${mb} MB). Upload cap is 4 MB — compress and try again.`);
            }
            throw new Error(`Upload failed: ${detail}`);
          }
          const upData = await upRes.json();
          if (upData.url && !isUnfinalized(upData.url)) {
            useAppStore.getState().updateItem(item.id, { src: upData.url });
            return upData.url as string;
          }
          throw new Error("Upload returned no URL");
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "unknown";
          console.error("[resolveUrl] active upload failed for item", item.id, msg);
          throw new Error(msg);
        }
      };

      // For v2v models like Wan Animate we need BOTH a character image and a
      // reference video. Pick the first image-ish ref for `inputImage` and the
      // first video ref for `inputVideo`.
      const firstImageRef = refItems.find((r) => r && (r.type === "image" || r.type === "psd-layer" || (r.type === "generation" && r.outputType === "image"))) || refItems[0];
      const firstVideoRef = refItems.find((r) => r && (r.type === "video" || (r.type === "generation" && r.outputType === "video")));
      const inputImage = (await resolveUrl(firstImageRef)) || (await resolveUrl(startItem));
      const inputVideo = await resolveUrl(firstVideoRef);
      const inputImagesList = (await Promise.all(refItems.map((r) => resolveUrl(r)))).filter(Boolean) as string[];
      const startFrameUrl = await resolveUrl(startItem);
      const endFrameUrl = await resolveUrl(endItem);
      const inputAudioUrl = await resolveUrl(audioItem);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: selectedModel.id,
          mode: selectedModel.type,
          inputImage,
          inputImages: inputImagesList,
          inputVideo,
          startFrame: startFrameUrl,
          endFrame: endFrameUrl,
          inputAudio: inputAudioUrl,
          generationOptions: Object.keys(generationOptions).length > 0 ? generationOptions : undefined,
        }),
      });

      // Some failures (Vercel's 413, gateway errors) return HTML, not JSON.
      // Parse defensively so the user sees a clear message instead of
      // "Unexpected token 'R', 'Request En'..."
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => "");
        if (res.status === 413) data = { error: "Request too large. Try smaller images or wait for uploads to finish." };
        else if (text) data = { error: text.slice(0, 200) };
        else data = { error: `HTTP ${res.status}` };
      }

      if (!res.ok) {
        useAppStore.getState().removeItem(genItem.id);
        if (res.status === 401) { window.location.href = "/signup"; return; }
        const msg = data.error || "Generation failed";
        // 429s and safety blocks get a longer toast so the actionable hint
        // stays on screen long enough to read.
        const durationMs = res.status === 429 ? 8000 : 6000;
        showToast(msg, { kind: "error", durationMs });
        return;
      }

      // Segmind models return completed immediately (synchronous)
      if (data.status === "completed" && data.outputUrl) {
        useAppStore.getState().updateItem(genItem.id, {
          status: "completed",
          outputUrl: data.outputUrl,
          cost: getEstimatedCost(selectedModel, generationOptions),
          progressText: undefined,
        });
        if (data.outputUrl && outputType === "image") {
          const img = new window.Image();
          img.onload = () => {
            const maxW = 250;
            const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
            useAppStore.getState().updateItem(genItem.id, { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) });
          };
          img.src = data.outputUrl;
        }
        return;
      }

      // Poll for status — no timeout limit, works with any Vercel plan
      let currentRequestId = data.requestId;
      let currentModelId = data.modelId;
      const generationId = data.generationId;
      const ttsStep = data.ttsStep || null; // Voice Clone TTS 2-step info
      const isGeminiVideo = data.geminiVideo || false;
      const isOpenaiVideo = data.openaiVideo || false;
      const isReplicateVideo = data.replicateVideo || false;
      const isByteplusVideo = data.byteplusVideo || false;
      const isComfyVideo = data.comfyVideo || false;
      // Persist the polling handles onto the canvas item so a page refresh
      // mid-generation can resume where it left off. Skip for the voice-clone
      // TTS 2-step flow — that one mutates requestId during polling and would
      // need extra plumbing to survive a reload.
      const pollProvider: BoardItem["pollProvider"] =
        isGeminiVideo ? "gemini" :
        isOpenaiVideo ? "openai" :
        isReplicateVideo ? "replicate" :
        isByteplusVideo ? "byteplus" :
        isComfyVideo ? "comfy" : undefined;
      useAppStore.getState().updateItem(genItem.id, {
        progressText: ttsStep ? "Cloning voice..." : "Queued...",
        ...(pollProvider && !ttsStep ? {
          requestId: data.requestId,
          generationId: data.generationId,
          pollProvider,
        } : {}),
      });

      const poll = async () => {
        try {
          let url = `/api/generate/status?requestId=${encodeURIComponent(currentRequestId)}&modelId=${encodeURIComponent(currentModelId)}&generationId=${generationId}`;
          if (isGeminiVideo) url += `&geminiVideo=true`;
          if (isOpenaiVideo) url += `&openaiVideo=true`;
          if (isReplicateVideo) url += `&replicateVideo=true`;
          if (isByteplusVideo) url += `&byteplusVideo=true`;
          if (isComfyVideo) url += `&comfyVideo=true`;
          if (ttsStep && currentModelId.includes("clone-voice")) {
            url += `&ttsInput=${encodeURIComponent(JSON.stringify(ttsStep.input))}&ttsModelId=${encodeURIComponent(ttsStep.modelId)}`;
          }
          const statusRes = await fetch(url);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let statusData: any;
          try {
            statusData = await statusRes.json();
          } catch {
            const text = await statusRes.text().catch(() => "");
            statusData = { status: "failed", error: text ? text.slice(0, 200) : `HTTP ${statusRes.status}` };
          }

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
              cost: statusData.actualCost || getEstimatedCost(selectedModel, generationOptions),
              progressText: undefined,
            });

            // Auto-resize card
            if (statusData.outputUrl) {
              if (outputType === "image") {
                const img = new window.Image();
                let retries = 0;
                img.onload = () => {
                  const maxW = 250;
                  const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
                  useAppStore.getState().updateItem(genItem.id, { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) });
                };
                img.onerror = () => {
                  // Retry up to 3 times with increasing delay — fal.ai URLs can take a moment
                  if (retries < 3) {
                    retries++;
                    setTimeout(() => { img.src = statusData.outputUrl + "?retry=" + retries; }, retries * 2000);
                  }
                };
                img.src = statusData.outputUrl;
              } else if (outputType === "video") {
                const vid = document.createElement("video");
                vid.preload = "metadata";
                vid.onloadedmetadata = () => {
                  const maxW = 250;
                  const scale = vid.videoWidth > maxW ? maxW / vid.videoWidth : 1;
                  useAppStore.getState().updateItem(genItem.id, { width: Math.round(vid.videoWidth * scale), height: Math.round(vid.videoHeight * scale) });
                };
                vid.src = statusData.outputUrl;
              }
            }
            return;
          }

          if (statusData.status === "failed") {
            useAppStore.getState().updateItem(genItem.id, {
              status: "failed",
              error: statusData.error || "Generation failed",
              progressText: undefined,
            });
            return;
          }

          // Still processing — update progress text and poll again
          const progressMsg = statusData.log || (statusData.position != null ? `Queued #${statusData.position}` : statusData.status === "queued" ? "Queued..." : "Processing...");
          useAppStore.getState().updateItem(genItem.id, { progressText: progressMsg });
          setTimeout(poll, 8000); // Poll every 8 seconds — easier on Vercel origin transfer
        } catch {
          // Network error — retry
          setTimeout(poll, 5000);
        }
      };

      poll();
      return;
    } catch (err) {
      useAppStore.getState().updateItem(genItem.id, {
        status: "failed",
        error: err instanceof Error ? err.message : "Generation failed",
        progressText: undefined,
      });
    } finally {
      // No lock — multiple generations can run in parallel
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
                      {selectedModel.name} &middot; {getEstimatedCost(selectedModel, generationOptions)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!selectedModel}
                  onClick={handleGenerate}
                  className={`flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold transition-all ${
                    !selectedModel
                      ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                      : "bg-[#f26522] text-white hover:bg-[#d9541a] cursor-pointer hover:scale-105"
                  }`}
                  title="Generate (Ctrl+Enter)"
                >
                  <WandSparkles className="h-3.5 w-3.5" />
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
      {/* (The old "Set as: INPUT 1" row used to live here. It's been merged
          into the always-visible RequirementsRow below the chatbox — each
          pill doubles as both status and the click-to-assign action when a
          compatible item is selected.) */}

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

          {/* Always-visible requirements row. Doubles as the click-to-assign
              target when an item is selected on the canvas — pill pulses to
              indicate "ready to receive" and a click binds the selected item
              to that slot (or clears the slot if it already points there). */}
          {selectedModel && (
            <RequirementsRow
              model={selectedModel}
              isDark={isDark}
              selectedItem={selectedItem || null}
              selectedIsImage={!!isSelectedImage}
              selectedIsVideo={!!isSelectedVideo}
              selectedIsAudio={!!isSelectedAudio}
              startFrameId={startFrameId}
              endFrameId={endFrameId}
              audioInputId={audioInputId}
              inputRefs={inputRefs}
              refItems={refItems}
              hasStartFrame={!!startFrameId}
              hasEndFrame={!!endFrameId}
              hasImageRef={refItems.some((r) => r.type === "image" || r.type === "psd-layer" || (r.type === "generation" && r.outputType === "image")) || !!startFrameId}
              hasVideoRef={refItems.some((r) => r.type === "video" || (r.type === "generation" && r.outputType === "video"))}
              hasAudio={!!audioItem}
              onSetStartFrame={setStartFrame}
              onSetEndFrame={setEndFrame}
              onSetAudioInput={setAudioInput}
              onToggleInputRef={(id) => useAppStore.getState().toggleInputRef(id)}
              onClearInputRefsOfKind={(kind) => {
                useAppStore.setState({
                  inputRefs: inputRefs.filter((id) => {
                    const it = items.find((x) => x.id === id);
                    if (!it) return false;
                    if (kind === "image") return !(it.type === "image" || it.type === "psd-layer" || (it.type === "generation" && it.outputType === "image"));
                    if (kind === "video") return !(it.type === "video" || (it.type === "generation" && it.outputType === "video"));
                    return true;
                  }),
                });
              }}
            />
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
              {selectedModel && <span className="text-[9px] text-gray-400">{getEstimatedCost(selectedModel, generationOptions)}</span>}
              {!selectedModel && <span />}
              <button
                type="button"
                disabled={!selectedModel}
                onClick={handleGenerate}
                className={`flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
                  !selectedModel
                    ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                    : "bg-[#f26522] text-white hover:bg-[#d9541a] cursor-pointer"
                }`}
                title="Generate (Ctrl+Enter)"
              >
                <WandSparkles className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className={`pointer-events-auto relative flex h-full w-full items-center backdrop-blur-md px-1.5 md:px-2.5 py-1 border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)] gap-1 md:gap-2 ${isDark ? "bg-[#161b22]/95 border-gray-700" : "bg-white/95 border-gray-200"}`}>
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
                    <button
                      className="p-0.5 text-gray-300 hover:text-[#f26522] transition-colors"
                      title="Rename board"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const name = await askPrompt({
                          title: "Rename board",
                          placeholder: "Board name",
                          defaultValue: board.name,
                          confirmLabel: "Save",
                        });
                        if (name !== null) {
                          const trimmed = name.trim();
                          if (trimmed) renameBoard(board.id, trimmed);
                        }
                      }}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    {boards.length > 1 && (
                      <button
                        className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete board"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await askConfirm({
                            title: `Delete "${board.name}"?`,
                            message: "Every item on this board will be removed. This cannot be undone.",
                            confirmLabel: "Delete board",
                            danger: true,
                          });
                          if (ok) deleteBoard(board.id);
                        }}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 p-1.5 space-y-0.5">
                <button
                  className="flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#f26522] hover:bg-[#f26522]/5 transition-colors"
                  onClick={() => { addBoard(); setBoardMenuOpen(false); }}
                  disabled={!!boardIoBusy}
                >
                  <Plus className="w-3 h-3" />
                  New Board
                </button>
                <button
                  className={`flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${isDark ? "text-gray-300 hover:bg-white/5" : "text-gray-600 hover:bg-gray-50"}`}
                  onClick={handleExportBoard}
                  disabled={!!boardIoBusy}
                  title="Queue a background export — keeps running if you close the tab"
                >
                  <Download className="w-3 h-3" />
                  {boardIoBusy?.toLowerCase().includes("queue") ? boardIoBusy : "Export current board"}
                </button>

                {/* Inline progress for active export jobs — lets the user watch
                    without having to open the Profile panel */}
                {exportJobs.length > 0 && (
                  <div className={`mt-1 rounded-lg border ${isDark ? "border-gray-700 bg-white/5" : "border-gray-100 bg-gray-50/50"}`}>
                    {exportJobs.slice(0, 4).map((job) => (
                      <div key={job.id} className="flex items-center gap-1.5 px-2 py-1.5 group/exp">
                        <div className="flex-1 min-w-0">
                          <p className={`text-[10px] font-medium truncate ${isDark ? "text-gray-200" : "text-[#0d1117]"}`}>
                            {job.boardName}
                          </p>
                          {job.status === "pending" && (
                            <p className="text-[9px] text-[#f26522]">Queued…</p>
                          )}
                          {job.status === "processing" && (
                            <div className="mt-0.5">
                              <div className="flex items-center justify-between">
                                <p className="text-[9px] text-[#f26522]">Processing {job.progress}/{job.total}</p>
                                <p className="text-[9px] text-[#f26522]">
                                  {job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0}%
                                </p>
                              </div>
                              <div className={`mt-0.5 h-0.5 rounded-full overflow-hidden ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
                                <div
                                  className="h-full bg-[#f26522] transition-all duration-300"
                                  style={{ width: `${job.total > 0 ? (job.progress / job.total) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {job.status === "completed" && (
                            <p className="text-[9px] text-emerald-500">
                              Ready · {new Date(job.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </p>
                          )}
                          {job.status === "failed" && (
                            <p className="text-[9px] text-red-500 truncate" title={job.error || undefined}>
                              Failed: {job.error || "unknown"}
                            </p>
                          )}
                        </div>
                        {job.status === "processing" && (
                          <Loader2 className="h-3 w-3 animate-spin text-[#f26522] shrink-0" />
                        )}
                        {job.status === "completed" && job.fileId && (
                          <a
                            href={`/api/files/${job.fileId}`}
                            download={job.fileName || `${job.boardName}.mbboard.json`}
                            className="rounded p-1 text-[#f26522] hover:bg-[#f26522]/10 transition-colors shrink-0"
                            title="Download"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteExportJob(job.id); }}
                          className="opacity-0 group-hover/exp:opacity-100 rounded p-1 text-gray-400 hover:text-red-500 transition-all shrink-0"
                          title="Remove"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                    {exportJobs.length > 4 && (
                      <p className={`text-[9px] text-center py-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        +{exportJobs.length - 4} more in Profile → Recent exports
                      </p>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <button
                    className={`flex-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${isDark ? "text-gray-300 hover:bg-white/5" : "text-gray-600 hover:bg-gray-50"}`}
                    onClick={() => importInputRef.current?.click()}
                    disabled={!!boardIoBusy}
                    title="Import a .mbboard.json file — media is uploaded to your account"
                  >
                    <Upload className="w-3 h-3" />
                    {boardIoBusy && !boardIoBusy.startsWith("Exporting") ? boardIoBusy : "Import board from file"}
                  </button>
                  {boardIoBusy && !boardIoBusy.startsWith("Exporting") && (
                    <button
                      type="button"
                      onClick={cancelImport}
                      className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
                      title="Cancel import"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>
            </div>
          )}
        </div>

        {/* Center: Developed by Adletic — desktop only, bottom bar is too
            tight on mobile to show credits. */}
        <div className="flex-1 flex justify-center">
          <span className="hidden md:flex text-[9px] text-gray-300 items-center gap-1">
            Developed by <img src="/adletic-logo.jpg" alt="Adletic" className="h-4 w-4 rounded-sm inline-block" /> <span className="font-semibold text-gray-400">Adletic</span> &copy; 2026
          </span>
        </div>

        {/* Right: Toggle buttons. Below md we collapse labels to icons so the
            Models / Templates / AI / History / Profile pills fit on a narrow
            phone viewport without wrapping. */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 rounded-lg p-1 md:p-1.5 border ${isDark ? "bg-[#0d1117] border-gray-700" : "bg-gray-50 border-gray-100"}`}>
            {/* Models */}
            <button
              className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-1.5 md:px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                isModelPanelOpen
                  ? "bg-[#f26522] text-white border border-[#f26522]"
                  : isDark ? "bg-[#161b22] text-gray-300 hover:bg-white/10 border border-gray-700" : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() => setModelPanelOpen(!isModelPanelOpen)}
              title="Models"
            >
              <FileImage className="w-3.5 h-3.5 shrink-0" />
              <span className="flex items-center gap-1 truncate max-w-[6rem] md:max-w-[12rem]">
                <span className="truncate">{selectedModel?.name || "None"}</span>
              </span>
            </button>

            {/* Prompt Templates */}
            <button
              className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-1.5 md:px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                isTemplatesOpen
                  ? "bg-[#f26522] text-white border border-[#f26522]"
                  : isDark ? "bg-[#161b22] text-gray-300 hover:bg-white/10 border border-gray-700" : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
              }`}
              onClick={() => setTemplatesOpen(!isTemplatesOpen)}
              title="Prompt Templates"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Templates</span>
            </button>

            {/* AI Prompt Generator */}
            <button
              className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 select-none h-6 px-1.5 md:px-2 text-xs leading-3 whitespace-nowrap gap-1 ${
                isAIPromptOpen
                  ? "bg-[#f26522] text-white border border-[#f26522]"
                  : isDark ? "bg-[#161b22] text-gray-300 hover:bg-white/10 border border-gray-700" : "bg-white text-[#374151] hover:bg-gray-100 border border-gray-200"
              }`}
              title="AI Prompt Generator"
              onClick={() => setAIPromptOpen(!isAIPromptOpen)}
            >
              <img src="/aios-icon.png" alt="AI" className="w-3.5 h-3.5 rounded-sm" />
              <span className="hidden md:inline">AI</span>
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

// Always-visible model requirements row. Pulls the label from each input's
// description so users see what the input actually is ("Character image",
// "Reference video", "Voice reference audio to clone") instead of a generic
// "Image"/"Video"/"Audio". Each pill is green when that input is satisfied
// by something on the canvas, orange when required-but-missing, neutral when
// optional-and-unset. Hover shows the full description + how-to hint.
function RequirementsRow({
  model,
  isDark,
  selectedItem,
  selectedIsImage,
  selectedIsVideo,
  selectedIsAudio,
  startFrameId,
  endFrameId,
  audioInputId,
  inputRefs,
  refItems,
  hasStartFrame,
  hasEndFrame,
  hasImageRef,
  hasVideoRef,
  hasAudio,
  onSetStartFrame,
  onSetEndFrame,
  onSetAudioInput,
  onToggleInputRef,
  onClearInputRefsOfKind,
}: {
  model: AIModel;
  isDark: boolean;
  selectedItem: BoardItem | null;
  selectedIsImage: boolean;
  selectedIsVideo: boolean;
  selectedIsAudio: boolean;
  startFrameId: string | null;
  endFrameId: string | null;
  audioInputId: string | null;
  inputRefs: string[];
  refItems: BoardItem[];
  hasStartFrame: boolean;
  hasEndFrame: boolean;
  hasImageRef: boolean;
  hasVideoRef: boolean;
  hasAudio: boolean;
  onSetStartFrame: (id: string | null) => void;
  onSetEndFrame: (id: string | null) => void;
  onSetAudioInput: (id: string | null) => void;
  onToggleInputRef: (id: string) => void;
  onClearInputRefsOfKind: (kind: "image" | "video") => void;
}) {
  type Kind = "image" | "video" | "audio" | "start" | "end";
  type Req = {
    kind: Kind;
    label: string;
    fullDesc: string;
    hint: string;
    ok: boolean;
    required: boolean;
    // Interactive state: when a canvas item is selected, the pill becomes
    // clickable if its type matches this slot. `onClick` runs the binding.
    canClick: boolean;
    clickMode: "set" | "clear" | null;
    onClick: () => void;
  };
  const reqs: Req[] = [];

  // Pull a short label out of the input description, e.g.
  //   "Character image (the person to inject)" → "Character image"
  //   "Reference video (camera, scene, and motion are preserved)" → "Reference video"
  //   "Voice reference audio to clone" → "Voice reference audio to clone"
  //   "Optional video to synchronize audio with" → "Video to synchronize audio with"
  // Strips a leading "Optional " so we don't say "optional" twice (once in
  // the label, once in the badge).
  function shortLabel(desc: string | undefined, fallback: string): string {
    if (!desc) return fallback;
    let s = desc.trim();
    const paren = s.indexOf("(");
    if (paren > 0) s = s.slice(0, paren).trim();
    s = s.replace(/^optional\s+/i, "");
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return s || fallback;
  }

  if (model.type === "s2e") {
    reqs.push({
      kind: "start",
      label: "Start frame",
      fullDesc: "First frame the video should begin on",
      hint: "Select an image, then click here",
      ok: hasStartFrame,
      required: true,
      canClick: selectedIsImage,
      clickMode: selectedIsImage && startFrameId === selectedItem?.id ? "clear" : selectedIsImage ? "set" : null,
      onClick: () => {
        if (!selectedItem || !selectedIsImage) return;
        onSetStartFrame(startFrameId === selectedItem.id ? null : selectedItem.id);
      },
    });
    reqs.push({
      kind: "end",
      label: "End frame",
      fullDesc: "Last frame the video should end on",
      hint: "Select an image, then click here",
      ok: hasEndFrame,
      required: true,
      canClick: selectedIsImage,
      clickMode: selectedIsImage && endFrameId === selectedItem?.id ? "clear" : selectedIsImage ? "set" : null,
      onClick: () => {
        if (!selectedItem || !selectedIsImage) return;
        onSetEndFrame(endFrameId === selectedItem.id ? null : selectedItem.id);
      },
    });
  } else {
    for (const inp of model.inputs) {
      if (inp.type === "image") {
        const selAlreadyInRefs = !!(selectedItem && inputRefs.includes(selectedItem.id) && selectedIsImage);
        reqs.push({
          kind: "image",
          label: shortLabel(inp.description, "Image"),
          fullDesc: inp.description || "Image reference",
          hint: "Select an image on the canvas, then click here",
          ok: hasImageRef,
          required: !!inp.required,
          canClick: selectedIsImage,
          clickMode: selAlreadyInRefs ? "clear" : selectedIsImage ? "set" : null,
          onClick: () => {
            if (!selectedItem || !selectedIsImage) return;
            if (selAlreadyInRefs) onToggleInputRef(selectedItem.id);
            else onToggleInputRef(selectedItem.id);
          },
        });
      } else if (inp.type === "video") {
        const selAlreadyInRefs = !!(selectedItem && inputRefs.includes(selectedItem.id) && selectedIsVideo);
        reqs.push({
          kind: "video",
          label: shortLabel(inp.description, "Video"),
          fullDesc: inp.description || "Video reference",
          hint: "Select a video on the canvas, then click here",
          ok: hasVideoRef,
          required: !!inp.required,
          canClick: selectedIsVideo,
          clickMode: selAlreadyInRefs ? "clear" : selectedIsVideo ? "set" : null,
          onClick: () => {
            if (!selectedItem || !selectedIsVideo) return;
            onToggleInputRef(selectedItem.id);
          },
        });
      } else if (inp.type === "audio") {
        reqs.push({
          kind: "audio",
          label: shortLabel(inp.description, "Audio"),
          fullDesc: inp.description || "Audio reference",
          hint: "Select an audio clip, then click here",
          ok: hasAudio,
          required: !!inp.required,
          canClick: selectedIsAudio,
          clickMode: selectedIsAudio && audioInputId === selectedItem?.id ? "clear" : selectedIsAudio ? "set" : null,
          onClick: () => {
            if (!selectedItem || !selectedIsAudio) return;
            onSetAudioInput(audioInputId === selectedItem.id ? null : selectedItem.id);
          },
        });
      }
    }
  }
  // Unused-hook suppression for tree-shaking tools.
  void refItems;
  void onClearInputRefsOfKind;

  if (reqs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-1.5 self-start max-w-full">
      <span className={`text-[9.5px] font-black uppercase tracking-[0.15em] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        Needs
      </span>
      {reqs.map((r, i) => {
        const armed = r.canClick && r.clickMode !== null;
        const tone = r.ok
          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/40"
          : r.required
            ? "bg-[#f26522]/15 text-[#f26522] border-[#f26522]/40"
            : (isDark ? "bg-white/[0.04] text-gray-400 border-gray-700" : "bg-gray-100 text-gray-500 border-gray-200");
        // When a matching canvas item is selected, the pill gets a bold
        // orange outline + tiny caret hint so it's obvious you can click it
        // to bind the selection.
        const armedClass = armed
          ? (r.clickMode === "clear"
              ? "ring-2 ring-emerald-500/60 shadow-md cursor-pointer"
              : "ring-2 ring-[#f26522]/80 shadow-md cursor-pointer animate-pulse")
          : "cursor-default";
        const status = r.ok ? "set" : r.required ? "required" : "optional";
        const statusTone = r.ok
          ? "bg-emerald-600/20 text-emerald-600"
          : r.required
            ? "bg-[#f26522]/25 text-[#f26522]"
            : (isDark ? "bg-white/10 text-gray-400" : "bg-black/10 text-gray-500");
        const tooltip = armed
          ? (r.clickMode === "clear"
              ? `Click to clear ${r.label}`
              : `Click to set selected as ${r.label}`)
          : (r.ok ? `${r.label} — set` : `${r.fullDesc}\n\n${r.hint}`);
        return (
          <button
            key={i}
            type="button"
            disabled={!armed}
            onClick={r.onClick}
            title={tooltip}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] font-bold transition-all ${tone} ${armedClass}`}
          >
            <span aria-hidden className="text-[11px] leading-none">
              {r.ok ? "✓" : r.required ? "!" : "○"}
            </span>
            <span>{r.label}</span>
            <span className={`rounded-full px-1.5 py-[1px] text-[8.5px] font-black uppercase tracking-wider ${statusTone}`}>
              {armed && r.clickMode === "set" ? "click" : armed && r.clickMode === "clear" ? "unset" : status}
            </span>
          </button>
        );
      })}
    </div>
  );
}
