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
  ImagePlus,
} from "lucide-react";
import { useAppStore, type BoardItem } from "@/lib/store";
import { importBoardFromFile, ImportCancelled } from "@/lib/board-io";
import { getModelById, findMultiRefSlot, type ModelOptions, type AIModel } from "@/lib/models";
import { requireAuth } from "@/lib/auth-gate";
import { askConfirm, askPrompt, showToast } from "@/lib/ui-store";
import { track } from "@/lib/track";
import { Pencil, MessageCircle, ScanFace, Check } from "lucide-react";
import { AIGreetingCard } from "./ai-greeting-card";

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
  durationSec?: number;
  resolution?: string;
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
      pollDurationSec: undefined,
      pollResolution: undefined,
    });
    activePollers.delete(params.itemId);
  };

  const poll = async () => {
    try {
      let url =
        `/api/generate/status?requestId=${encodeURIComponent(params.requestId)}` +
        `&modelId=${encodeURIComponent(params.modelId)}` +
        `&generationId=${encodeURIComponent(params.generationId)}` +
        flagQuery;
      if (params.durationSec) url += `&durationSec=${params.durationSec}`;
      if (params.resolution) url += `&resolution=${encodeURIComponent(params.resolution)}`;
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
  // Which model-option dropdown (AR / Duration / Resolution) is currently open.
  // Hover-only dropdowns never opened on iOS/Android — this drives a click-toggle.
  const [openOptKey, setOpenOptKey] = useState<string | null>(null);
  const optionPillsRef = useRef<HTMLDivElement>(null);
  // My Assets — ByteDance real-human characters the user registered once and
  // reuses for consistent identity. Only relevant on byteplus/Seedance models;
  // selecting one injects `asset://<id>` into the reference_images slot.
  const [myAssets, setMyAssets] = useState<Array<{ id: string; name: string; status: string; assetId: string | null; assetType: string; thumbFileId: string | null }>>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
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
    pendingAssetIds,
    setPendingAssetIds,
    isProfileOpen,
    setProfileOpen,
    isHistoryOpen,
    setHistoryOpen,
    isAIPromptOpen,
    setAIPromptOpen,
    aiAgentMode,
    setAiAgentMode,
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
        durationSec: it.pollDurationSec,
        resolution: it.pollResolution,
      });
    }
  }, []);

  // Drag resize — pointer events so it works on touch (iPhone / iPad) as
  // well as mouse / trackpad. Mouse-only events never fire on iOS Safari.
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      setBoxW(Math.max(250, Math.min(900, d.startW - (e.clientX - d.startX))));
      setBoxMinH(Math.max(40, Math.min(500, d.startH - (e.clientY - d.startY))));
    };
    const onUp = () => { setIsDragging(false); dragRef.current = null; };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [isDragging]);

  const onDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
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
      <div ref={optionPillsRef} className="flex flex-wrap items-center gap-2 mb-2">
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
          const isOpen = openOptKey === key;

          return (
            <div key={key} className="relative">
              <button
                type="button"
                className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isDark
                    ? "bg-[#161b22] text-gray-200 border border-gray-700 hover:border-[#f26522] shadow-sm"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-[#f26522] shadow-sm"
                }`}
                title={selectOpt.label}
                onClick={() => setOpenOptKey(isOpen ? null : (key as string))}
              >
                <span className={`${isDark ? "text-gray-500" : "text-gray-400"}`}>{selectOpt.label.replace("Aspect Ratio", "AR").replace("Duration", "Dur").replace("Resolution", "Res")}</span>
                <span className="text-[#f26522]">{currentVal}</span>
                <ChevronDown className="w-2.5 h-2.5 text-gray-400" />
              </button>
              {isOpen && (
                <div className="absolute bottom-full left-0 pb-1 z-50">
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
                          onClick={() => { setGenerationOption(key, v); setOpenOptKey(null); }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* My Assets picker — real-human character lock. Only on byteplus/Seedance. */}
        {isByteplusModel && (() => {
          const isOpen = openOptKey === "__assets";
          const count = selectedAssetIds.length;
          return (
            <div className="relative">
              <button
                type="button"
                className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  count > 0
                    ? "bg-[#f26522] text-white shadow-md shadow-[#f26522]/20"
                    : isDark
                    ? "bg-[#161b22] text-gray-200 border border-gray-700 hover:border-[#f26522] shadow-sm"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-[#f26522] shadow-sm"
                }`}
                title="My Assets — lock a real-human character"
                onClick={() => setOpenOptKey(isOpen ? null : "__assets")}
              >
                <ScanFace className="w-3 h-3" />
                {count > 0 ? `${count} character${count === 1 ? "" : "s"}` : "Cast"}
                <ChevronDown className="w-2.5 h-2.5 opacity-70" />
              </button>
              {isOpen && (
                <div className="absolute bottom-full left-0 pb-1 z-50">
                  <div className={`rounded-xl border shadow-2xl overflow-hidden min-w-[190px] max-w-[240px] ${isDark ? "bg-[#0d1117] border-gray-700" : "bg-white border-gray-200"}`}>
                    <div className="p-1.5 flex flex-col gap-0.5 max-h-[220px] overflow-y-auto">
                      {myAssets.length === 0 ? (
                        <p className={`px-2 py-2 text-[10px] leading-relaxed ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                          No ready characters yet. Request one below.
                        </p>
                      ) : (
                        myAssets.map((a) => {
                          const sel = selectedAssetIds.includes(a.id);
                          return (
                            <button
                              key={a.id}
                              className={`flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg text-left transition-all ${
                                sel ? "bg-[#f26522]/15 text-[#f26522]" : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-50"
                              }`}
                              onClick={() => toggleAsset(a.id)}
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-[#f26522]/10 text-[#f26522]">
                                {a.thumbFileId ? <img src={`/api/files/${a.thumbFileId}`} alt="" className="h-full w-full object-cover" /> : <ScanFace className="h-3 w-3" />}
                              </span>
                              <span className="flex-1 truncate font-medium">{a.name}</span>
                              {sel && <Check className="h-3 w-3 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                      <button
                        className={`mt-0.5 flex items-center gap-1.5 border-t px-2 py-1.5 text-[10px] font-semibold ${isDark ? "border-gray-800 text-gray-400 hover:text-[#f26522]" : "border-gray-100 text-gray-500 hover:text-[#f26522]"}`}
                        onClick={() => { setOpenOptKey(null); useAppStore.getState().setFoldersOpen(false); useAppStore.getState().setAssetsOpen(true); }}
                      >
                        <Plus className="h-3 w-3" /> Request a character
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // Close any open option dropdown on outside tap. Pointerdown so it fires
  // before the synthesized click on iOS, matching the board menu pattern.
  useEffect(() => {
    if (!openOptKey) return;
    const onDown = (e: PointerEvent) => {
      const root = optionPillsRef.current;
      if (root && !root.contains(e.target as Node)) setOpenOptKey(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openOptKey]);

  useEffect(() => { setOpenOptKey(null); }, [selectedModelId]);

  // Consume pending prompt from templates panel / generation reuse
  useEffect(() => {
    if (pendingPrompt) {
      setPrompt(pendingPrompt);
      setPendingPrompt(null);
    }
  }, [pendingPrompt, setPendingPrompt]);

  // Consume the Cast selection restored by reuseGeneration.
  useEffect(() => {
    if (pendingAssetIds) {
      setSelectedAssetIds(pendingAssetIds);
      setPendingAssetIds(null);
    }
  }, [pendingAssetIds, setPendingAssetIds]);

  const selectedModel = selectedModelId ? getModelById(selectedModelId) : null;
  const isByteplusModel = selectedModel?.provider === "byteplus";

  // Load the user's registered characters the first time a byteplus/Seedance
  // model is selected (they're only usable there).
  useEffect(() => {
    if (!isByteplusModel || myAssets.length > 0) return;
    fetch("/api/assets")
      .then((r) => r.json())
      // Only READY characters (verified, asset_id filled) are usable in a run.
      .then((d) => setMyAssets((d?.assets || []).filter((a: { status?: string; assetId?: string | null }) => a.status === "completed" && a.assetId)))
      .catch(() => {});
  }, [isByteplusModel, myAssets.length]);

  // Toggle a character in/out of the current generation. Selecting appends an
  // `@Image{n}` tag to the prompt so Seedance knows which ref locks identity;
  // n is the character's 1-based position in the reference_images array (assets
  // are prepended in selection order at generate time).
  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) => {
      if (prev.includes(assetId)) return prev.filter((x) => x !== assetId);
      const next = [...prev, assetId];
      const tag = `@Image${next.length}`;
      setPrompt((p) => (p.includes(tag) ? p : (p.trim() ? `${p.trim()} ${tag}` : tag)));
      return next;
    });
  };

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
    // AI Agent mode — only takes effect from the empty hero, where the
    // Manual ↔ AI Agent toggle is the headline UX. Once items exist on the
    // canvas the user is in "manual mode" by default: the inline prompt bar
    // at the bottom of the canvas runs the selected model directly. The AI
    // Agent panel on the right is still available, but you only end up
    // there by clicking the AI button or via onboarding — never by typing
    // into the canvas prompt bar.
    if (aiAgentMode && items.length === 0) {
      const text = prompt.trim();
      if (!text) {
        showToast("Tell ADletic what you want to create", { kind: "info" });
        return;
      }
      // Seed the chat panel with the user's message and open it. The panel
      // reads pendingChatSeed on mount, creates a fresh chat, fires it as
      // the first user message, then clears.
      useAppStore.getState().setPendingChatSeed({ text, forceNewChat: true });
      setAIPromptOpen(true);
      setPrompt("");
      return;
    }

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
      // Snapshot the setup so a later "Reuse" restores prompt + model + refs.
      sourceInputRefs: [...inputRefs],
      sourceStartFrameId: startFrameId,
      sourceEndFrameId: endFrameId,
      sourceAudioInputId: audioInputId,
      sourceGenerationOptions: { ...generationOptions },
      sourceAssetIds: isByteplusModel ? [...selectedAssetIds] : [],
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
          const fileName = `${item.id}.${ext}`;
          const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });

          const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
          useAppStore.getState().updateItem(genItem.id, {
            progressText: `Uploading ${sizeMB} MB...`,
          });

          // Try Cloudflare R2 presigned upload first — browser PUTs directly
          // to R2 so Vercel's 4.5 MB function-body cap is irrelevant.
          // Two separate try-blocks so we can tell which leg failed:
          //   leg 1: server-side presign request (would mean env vars missing)
          //   leg 2: browser → R2 PUT (almost always a CORS issue on bucket)
          let uploadUrl: string | null = null;
          let publicUrl: string | null = null;
          try {
            const presign = await fetch("/api/upload-presign", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                filename: file.name,
                contentType: file.type || "application/octet-stream",
              }),
            });
            if (presign.ok) {
              const data = await presign.json();
              uploadUrl = data.uploadUrl;
              publicUrl = data.publicUrl;
            } else {
              const pErr = await presign.text().catch(() => "");
              console.warn(`[resolveUrl] R2 presign failed (${presign.status})`, pErr.slice(0, 300));
            }
          } catch (presignErr) {
            console.warn("[resolveUrl] R2 presign request threw", presignErr);
          }

          if (uploadUrl && publicUrl) {
            try {
              const putCtrl = new AbortController();
              const putTimeout = setTimeout(() => putCtrl.abort(), 300_000);
              const putRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "content-type": file.type || "application/octet-stream" },
                body: file,
                signal: putCtrl.signal,
              });
              clearTimeout(putTimeout);
              if (putRes.ok) {
                useAppStore.getState().updateItem(item.id, { src: publicUrl });
                return publicUrl;
              }
              const r2Err = await putRes.text().catch(() => "");
              console.warn(`[resolveUrl] R2 PUT failed ${putRes.status}`, r2Err.slice(0, 500));
            } catch (putErr) {
              // "TypeError: Failed to fetch" here = browser blocked the
              // request, almost always because the R2 bucket's CORS doesn't
              // allow PUT from this origin. Fix in Cloudflare → R2 → bucket
              // → Settings → CORS Policy. AllowedOrigins must match exactly
              // (https://motionboards.vercel.app — no trailing slash),
              // AllowedMethods must include PUT, AllowedHeaders ["*"].
              console.warn(
                "[resolveUrl] R2 PUT threw — likely CORS. Verify bucket CORS allows PUT from",
                window.location.origin,
                "Underlying error:",
                putErr
              );
            }
          }

          // Fallback: legacy Neon upload (capped ~4.5 MB). Only useful for
          // small files or as a safety net if R2 is temporarily broken.
          const ctrl = new AbortController();
          const timeoutId = setTimeout(() => ctrl.abort(), 120_000);
          let upRes: Response;
          try {
            const form = new FormData();
            form.append("file", file);
            upRes = await fetch("/api/upload", {
              method: "POST",
              body: form,
              signal: ctrl.signal,
            });
          } catch (fetchErr) {
            clearTimeout(timeoutId);
            if ((fetchErr as Error)?.name === "AbortError") {
              throw new Error(`Upload timed out after 2 minutes (${sizeMB} MB). Check your connection or compress the file.`);
            }
            throw fetchErr;
          }
          clearTimeout(timeoutId);

          if (upRes.ok) {
            const upData = await upRes.json();
            if (upData.url && !isUnfinalized(upData.url)) {
              useAppStore.getState().updateItem(item.id, { src: upData.url });
              return upData.url as string;
            }
          }
          if (upRes.status === 413) {
            throw new Error(
              `Upload of ${sizeMB} MB failed. R2 storage isn't configured on this deployment — add R2_* env vars in Vercel settings, or compress the file under 4 MB.`
            );
          }
          const errText = await upRes.text().catch(() => "");
          throw new Error(`Upload failed (${upRes.status}) ${errText.slice(0, 200)}`);
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "unknown";
          console.error("[resolveUrl] active upload failed for item", item.id, msg);
          throw new Error(msg);
        }
      };

      // Pre-flight size check: each model declares a maxMB per file input.
      // Walk the inputs the user has actually tagged, match each to the
      // model's slot by type (image → image input, video → video input,
      // audio → audio input), and reject before firing the generate call
      // if any tagged item is over that slot's cap. The user keeps the file
      // on their canvas — it just can't be used with THIS model.
      const imageInputs = selectedModel.inputs.filter((i) => i.type === "image");
      const videoInputs = selectedModel.inputs.filter((i) => i.type === "video");
      const audioInputs = selectedModel.inputs.filter((i) => i.type === "audio");
      const imageItemsTagged: Array<{ item: BoardItem; slot: typeof imageInputs[0] }> = [];
      if (startItem && imageInputs[0]) imageItemsTagged.push({ item: startItem, slot: imageInputs.find((i) => /first|start/i.test(i.name)) || imageInputs[0] });
      if (endItem) {
        const endSlot = imageInputs.find((i) => /last|end/i.test(i.name));
        if (endSlot) imageItemsTagged.push({ item: endItem, slot: endSlot });
      }
      for (const r of refItems) {
        if (!r) continue;
        const isImg = r.type === "image" || r.type === "psd-layer" || (r.type === "generation" && r.outputType === "image");
        const isVid = r.type === "video" || (r.type === "generation" && r.outputType === "video");
        if (isImg && imageInputs[0] && !imageItemsTagged.some((x) => x.item.id === r.id)) {
          imageItemsTagged.push({ item: r as BoardItem, slot: imageInputs[0] });
        }
        if (isVid && videoInputs[0]) {
          imageItemsTagged.push({ item: r as BoardItem, slot: videoInputs[0] });
        }
      }
      if (audioItem && audioInputs[0]) {
        imageItemsTagged.push({ item: audioItem, slot: audioInputs[0] });
      }
      for (const { item: it, slot } of imageItemsTagged) {
        if (!slot.maxMB || !it.sizeBytes) continue;
        const capBytes = slot.maxMB * 1024 * 1024;
        if (it.sizeBytes > capBytes) {
          const actualMB = (it.sizeBytes / 1024 / 1024).toFixed(1);
          const msg = `${selectedModel.name} caps "${slot.description || slot.name}" at ${slot.maxMB} MB — your file is ${actualMB} MB. Try a different file on this model, or use one that accepts larger inputs (Veo I2V, Wan Animate, etc).`;
          showToast(msg, { kind: "error", durationMs: 8000 });
          useAppStore.getState().removeItem(genItem.id);
          return;
        }
      }

      // For v2v models like Wan Animate we need BOTH a character image and a
      // reference video. Pick the first image-ish ref for `inputImage` and the
      // first video ref for `inputVideo`.
      // Only ever treat an actual image as the image input. The old
      // `|| refItems[0]` fallback grabbed whatever was attached — so a
      // video-only reference got shoved into the image_url / reference_images
      // slot and Ark rejected it ("image format not supported" / "input image
      // exceeds 30 MiB"). Videos must flow through firstVideoRef → reference_videos.
      const firstImageRef = refItems.find((r) => r && (r.type === "image" || r.type === "psd-layer" || (r.type === "generation" && r.outputType === "image")));
      const firstVideoRef = refItems.find((r) => r && (r.type === "video" || (r.type === "generation" && r.outputType === "video")));
      const inputImage = (await resolveUrl(firstImageRef)) || (await resolveUrl(startItem));
      const inputVideo = await resolveUrl(firstVideoRef);
      // `inputImages` feeds the model's plural image slot (reference_images
      // / image_urls). It MUST be filtered to image-like refs only - the
      // previous behaviour of forwarding every refItem regardless of kind
      // meant a video ref attached alongside images got dumped into the
      // image array, and the upstream Omni run failed with
      // "image format is not supported". Same filter logic as
      // `firstImageRef` above.
      const imageRefItems = refItems.filter((r) => r && (
        r.type === "image" ||
        r.type === "psd-layer" ||
        (r.type === "generation" && r.outputType === "image")
      ));
      const canvasImageUrls = (await Promise.all(imageRefItems.map((r) => resolveUrl(r)))).filter(Boolean) as string[];
      // Prepend any selected My-Assets characters as `asset://<id>` refs so
      // they land at @Image1, @Image2... (matching the tags toggleAsset wrote
      // into the prompt). Only meaningful on byteplus/Seedance models.
      const assetRefUrls = isByteplusModel
        ? selectedAssetIds
            .map((id) => myAssets.find((a) => a.id === id)?.assetId)
            .filter((x): x is string => !!x)
            .map((assetId) => `asset://${assetId}`)
        : [];
      const inputImagesList = [...assetRefUrls, ...canvasImageUrls];
      // `inputVideos` mirrors the same pattern for the model's plural
      // video slot (reference_videos). Send the full list of video refs
      // so Seedance / Kling Omni can use up to 3 of them, not just the
      // single one captured in `inputVideo` above.
      const videoRefItems = refItems.filter((r) => r && (
        r.type === "video" ||
        (r.type === "generation" && r.outputType === "video")
      ));
      const inputVideosList = (await Promise.all(videoRefItems.map((r) => resolveUrl(r)))).filter(Boolean) as string[];
      // Same for audio refs on Omni models.
      const audioRefItems = refItems.filter((r) => r && (
        r.type === "audio" ||
        (r.type === "generation" && r.outputType === "audio")
      ));
      const inputAudiosList = (await Promise.all(audioRefItems.map((r) => resolveUrl(r)))).filter(Boolean) as string[];
      const startFrameUrl = await resolveUrl(startItem);
      const endFrameUrl = await resolveUrl(endItem);
      const inputAudioUrl = await resolveUrl(audioItem);

      // Capture the moment we started so a later recovery probe (see
      // `recoverFromHistory` below) can ignore stale generations and only
      // accept ones created after this click.
      const generateStartedAt = new Date().toISOString();

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
          inputVideos: inputVideosList,
          startFrame: startFrameUrl,
          endFrame: endFrameUrl,
          inputAudio: inputAudioUrl,
          inputAudios: inputAudiosList,
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
        // Auth gate: still a hard redirect, no item to recover.
        if (res.status === 401) {
          useAppStore.getState().removeItem(genItem.id);
          track("generate_gated", {
            model: selectedModel?.id,
            modelName: selectedModel?.name,
            category: selectedModel?.category,
          });
          window.location.href = "/signup";
          return;
        }

        const msg = data.error || "Generation failed";
        // 429s and safety blocks get a longer toast so the actionable hint
        // stays on screen long enough to read.
        const durationMs = res.status === 429 ? 8000 : 6000;
        showToast(msg, { kind: "error", durationMs });

        // Recovery: synchronous providers (Nano Banana 2 4K is the worst
        // offender — 60–120s GPU runs) routinely complete server-side but
        // lose the response on the way back through Vercel's edge proxy or
        // a flaky network. Before we declare failure, poll the user's recent
        // generations for a completed match created after this click. If
        // the work landed in the DB, attach its outputUrl to this canvas
        // item so the user actually sees what they paid for.
        useAppStore.getState().updateItem(genItem.id, {
          status: "processing",
          progressText: "Recovering...",
        });

        const recoverFromHistory = async (): Promise<boolean> => {
          // Up to ~60s of polling: the upstream may still be finishing.
          const deadline = Date.now() + 60_000;
          while (Date.now() < deadline) {
            try {
              const url = `/api/generations/recent?model=${encodeURIComponent(selectedModel.id)}&since=${encodeURIComponent(generateStartedAt)}&limit=5`;
              const histRes = await fetch(url, { cache: "no-store" });
              if (histRes.ok) {
                const histJson = await histRes.json().catch(() => ({}));
                const candidates = (histJson.generations as Array<{ status: string; outputUrl?: string | null; prompt?: string | null }> | undefined) || [];
                const match = candidates.find(
                  (g) => g.status === "completed" && g.outputUrl && (g.prompt || "") === (prompt || ""),
                );
                if (match && match.outputUrl) {
                  useAppStore.getState().updateItem(genItem.id, {
                    status: "completed",
                    outputUrl: match.outputUrl,
                    cost: getEstimatedCost(selectedModel, generationOptions),
                    progressText: undefined,
                    error: undefined,
                  });
                  if (outputType === "image") {
                    const img = new window.Image();
                    img.onload = () => {
                      const maxW = 250;
                      const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
                      useAppStore.getState().updateItem(genItem.id, {
                        width: Math.round(img.naturalWidth * scale),
                        height: Math.round(img.naturalHeight * scale),
                      });
                    };
                    img.src = match.outputUrl;
                  }
                  return true;
                }
              }
            } catch {
              // ignore and retry
            }
            await new Promise((r) => setTimeout(r, 3000));
          }
          return false;
        };

        const recovered = await recoverFromHistory();
        if (!recovered) {
          // Couldn't find a completed match — leave the item on canvas as
          // failed so the user can retry / inspect / right-click recover
          // instead of having it silently disappear.
          useAppStore.getState().updateItem(genItem.id, {
            status: "failed",
            error: msg,
            progressText: undefined,
          });
        }
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
        // Translate-audio models also return the full English transcription
        // alongside the audio. Drop it as a text item directly beneath the
        // audio so the user can read what the translation says without
        // playing the clip.
        if (data.transcription && typeof data.transcription === "string" && selectedModel.id.startsWith("translate-audio-")) {
          const audioItem = useAppStore.getState().items.find((i) => i.id === genItem.id);
          if (audioItem) {
            const textId = `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            useAppStore.getState().addItem({
              id: textId,
              type: "text",
              x: audioItem.x,
              y: audioItem.y + audioItem.height + 12,
              width: audioItem.width,
              height: 80,
              src: "",
              text: data.transcription as string,
              fontSize: 13,
              fontFamily: "Inter, sans-serif",
              createdAt: new Date().toISOString(),
            });
          }
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
      // Parse duration and resolution from generationOptions so the status
      // route can charge the exact per-second amount (not the 5s baseline).
      const pollDurStr = (generationOptions?.duration as string | undefined) ||
        selectedModel?.options?.duration?.default || "";
      const pollDurationSec = pollDurStr ? (parseInt(pollDurStr) || undefined) : undefined;
      const pollResolution = (generationOptions?.resolution as string | undefined) ||
        selectedModel?.options?.resolution?.default || undefined;

      useAppStore.getState().updateItem(genItem.id, {
        progressText: ttsStep ? "Cloning voice..." : "Queued...",
        ...(pollProvider && !ttsStep ? {
          requestId: data.requestId,
          generationId: data.generationId,
          pollProvider,
          pollDurationSec,
          pollResolution,
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
          if (pollDurationSec) url += `&durationSec=${pollDurationSec}`;
          if (pollResolution) url += `&resolution=${encodeURIComponent(pollResolution)}`;
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

  // Hero "Add image" button — drops the chosen file onto the canvas at the
  // current viewport center, then uploads to R2 in the background. Mobile-
  // friendly equivalent of dragging or pasting a file.
  const heroFileInputRef = useRef<HTMLInputElement>(null);
  const heroRefInputRef = useRef<HTMLInputElement>(null);
  // Reference image picker. Behaviour depends on mode:
  //   AI Agent  → upload, drop on canvas, AND open ADletic in a fresh chat
  //               with the image attached as a reference plus whatever the
  //               user typed in the prompt box (or nothing, just the image).
  //   Manual    → upload, drop on canvas, register as inputRef so the
  //               selected model picks it up on next Generate.
  const handleHeroRefPick = async (file: File) => {
    const beforeIds = useAppStore.getState().items.map((i) => i.id);
    await handleHeroFilePick(file);
    const afterItems = useAppStore.getState().items;
    const newItem = afterItems.find((i) => !beforeIds.includes(i.id));
    if (!newItem) return;

    if (aiAgentMode) {
      // Wait for the background upload to swap the data: URL for a hosted
      // one. Up to ~6s; if it never finishes we send the data: URL itself
      // (still works for vision input, just bigger payload).
      let publicUrl: string | undefined = newItem.src;
      const isUnfinalized = (u: string | undefined) =>
        !!u && (u.startsWith("blob:") || u.startsWith("data:"));
      if (isUnfinalized(publicUrl)) {
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const fresh = useAppStore.getState().items.find((it) => it.id === newItem.id);
          if (fresh?.src && !isUnfinalized(fresh.src)) {
            publicUrl = fresh.src;
            break;
          }
        }
      }
      const text = prompt.trim();
      useAppStore.getState().setPendingChatSeed({
        text,
        imageUrl: publicUrl,
        forceNewChat: true,
      });
      setAIPromptOpen(true);
      setPrompt("");
      return;
    }

    // Manual mode — register as input ref for the selected model.
    // Enforce maxCount: if the selected model caps this kind, refuse to
    // auto-attach beyond the cap (the file still drops on the canvas; the
    // user just has to unset something else to wire it in).
    const storeNow = useAppStore.getState();
    const modelNow = storeNow.selectedModelId ? getModelById(storeNow.selectedModelId) : null;
    if (modelNow) {
      const kindNow: "image" | "video" | "audio" =
        (newItem.type === "image" || newItem.type === "psd-layer" || (newItem.type === "generation" && newItem.outputType === "image")) ? "image"
        : (newItem.type === "video" || (newItem.type === "generation" && newItem.outputType === "video")) ? "video"
        : "audio";
      const slotNow = findMultiRefSlot(modelNow, kindNow);
      if (slotNow && slotNow.maxCount) {
        const sameKindRefs = storeNow.inputRefs
          .map((rid) => storeNow.items.find((x) => x.id === rid))
          .filter((it): it is BoardItem => !!it)
          .filter((it) => {
            if (kindNow === "image") return it.type === "image" || it.type === "psd-layer" || (it.type === "generation" && it.outputType === "image");
            if (kindNow === "video") return it.type === "video" || (it.type === "generation" && it.outputType === "video");
            return it.type === "audio" || (it.type === "generation" && it.outputType === "audio");
          });
        if (sameKindRefs.length >= slotNow.maxCount) {
          showToast(
            `${modelNow.name} accepts at most ${slotNow.maxCount} ${kindNow} references. Added to canvas only.`,
            { kind: "info", durationMs: 5000 }
          );
          return;
        }
      }
    }
    useAppStore.setState((s) => ({ inputRefs: [...s.inputRefs, newItem.id] }));
  };
  const handleHeroFilePick = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast(`Only images supported here — got ${file.type || "unknown"}`, { kind: "error" });
      return;
    }
    const dataUri = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
    const tempImg = new Image();
    tempImg.onload = async () => {
      const maxW = 400;
      const w = Math.min(tempImg.naturalWidth, maxW);
      const h = (tempImg.naturalHeight / tempImg.naturalWidth) * w;
      const placeholderId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const cx = (-panX + window.innerWidth / 2 - w / 2) / zoom;
      const cy = (-panY + window.innerHeight / 2 - h / 2) / zoom;
      addItem({
        id: placeholderId,
        type: "image",
        x: cx,
        y: cy,
        width: w,
        height: h,
        src: dataUri,
        fileName: file.name,
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
      });
      // Background upload — try R2 first, fall back to legacy /api/upload.
      try {
        const presign = await fetch("/api/upload-presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filename: file.name || "upload.bin", contentType: file.type }),
        });
        if (presign.ok) {
          const { uploadUrl, publicUrl } = await presign.json();
          const putRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "content-type": file.type },
            body: file,
          });
          if (putRes.ok && publicUrl) {
            useAppStore.getState().updateItem(placeholderId, { src: publicUrl });
            return;
          }
        }
      } catch {}
      // Fallback: /api/upload
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (res.ok && data.url) {
          useAppStore.getState().updateItem(placeholderId, { src: data.url });
        }
      } catch {}
    };
    tempImg.src = dataUri;
  };

  // Empty-canvas backdrop — four sample renders, one per corner, with
  // small stenciled labels above. Kept deliberately minimal: the prompt
  // UI is the focal point, the cards are atmosphere. (Earlier iterations
  // had two marquee rows of giant text + 8 image cards; pulled back to
  // 4 cards for less visual noise on small screens.)
  const heroImages = [
    { src: "/hero/h1.jpg", label: "Nano Banana 2", x: "4%",  y: "16%", w: 130, delay: 0.0 },
    { src: "/hero/h4.jpg", label: "Veo 3.1",       x: "84%", y: "14%", w: 140, delay: 0.1 },
    { src: "/hero/h3.jpg", label: "FLUX Schnell",  x: "5%",  y: "64%", w: 120, delay: 0.2 },
    { src: "/hero/h6.jpg", label: "Seedance 2.0",  x: "82%", y: "66%", w: 130, delay: 0.3 },
  ];

  // Centered hero prompt for empty canvas
  if (isCanvasEmpty) {
    return (
      <>
        {/* Editorial decoration — four sample-render cards in the
            corners with small stenciled labels above. Sits behind the
            prompt UI at low contrast. */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {heroImages.map((img, i) => (
            <div
              key={i}
              className="absolute opacity-0"
              style={{
                left: img.x,
                top: img.y,
                width: img.w,
                animation: `heroFadeIn 0.6s ease-out ${img.delay}s forwards`,
              }}
            >
              <p
                className="uppercase mb-1.5 font-black select-none whitespace-nowrap"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  color: "transparent",
                  WebkitTextStroke: `1px ${isDark ? "rgba(255,255,255,0.55)" : "rgba(13,17,23,0.55)"}`,
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                }}
              >
                {img.label}
              </p>
              <div
                className="rounded-md overflow-hidden"
                style={{ height: img.w * 0.7 }}
              >
                <img
                  src={img.src}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            </div>
          ))}
          <style>{`
            @keyframes heroFadeIn { from { opacity: 0; } to { opacity: 0.55; } }
          `}</style>
        </div>

        {/* Centered prompt — scroll if content exceeds viewport so nothing
            collides with the bottom toolbar / footer credits. */}
        <div className="absolute inset-0 flex items-start justify-center pointer-events-none z-20 overflow-y-auto pt-12 md:pt-16 pb-24 md:pb-20">
          <div className="pointer-events-auto w-full max-w-xl px-4 my-auto">
            {/* Manual ↔ AI Agent toggle — sleek, single accent, no gradient */}
            <div className="flex items-center justify-center mb-5">
              <div className={`inline-flex items-center rounded-full p-0.5 border text-[11px] ${isDark ? "bg-[#0d1117] border-gray-800" : "bg-gray-50 border-gray-200"}`}>
                <button
                  type="button"
                  onClick={() => setAiAgentMode(true)}
                  className={`px-3.5 py-1.5 rounded-full font-medium transition-colors ${
                    aiAgentMode
                      ? isDark ? "bg-white text-[#0d1117]" : "bg-[#0d1117] text-white"
                      : isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-[#0d1117]"
                  }`}
                >
                  AI Agent
                </button>
                <button
                  type="button"
                  onClick={() => setAiAgentMode(false)}
                  className={`px-3.5 py-1.5 rounded-full font-medium transition-colors ${
                    !aiAgentMode
                      ? isDark ? "bg-white text-[#0d1117]" : "bg-[#0d1117] text-white"
                      : isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-[#0d1117]"
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

            <div className="text-center mb-7">
              <h2
                className={`text-[40px] leading-tight font-light tracking-tight mb-3 ${isDark ? "text-white" : "text-[#0d1117]"}`}
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {aiAgentMode ? (
                  <>What should we <em className="italic">make</em>?</>
                ) : (
                  <>Describe it. <em className="italic">We&apos;ll build it.</em></>
                )}
              </h2>
              <p className={`text-[13px] ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                {aiAgentMode
                  ? "ADletic picks the right model and runs it — just talk to it"
                  : `Type your prompt and ${selectedModel?.name || "AI"} will create it for you`}
              </p>
            </div>
            <div className="relative">
              {/* ADletic typewriter greeting — sits inside the chatbox at
                  the top in AI Agent mode. Pointer-events-none so the user
                  can click through to focus the textarea without the
                  greeting eating the click. */}
              {aiAgentMode && (
                <div className="absolute top-0 left-0 right-0 px-3 pt-3 z-10 pointer-events-none">
                  <AIGreetingCard isDark={isDark} />
                </div>
              )}
              <textarea
                ref={promptRef}
                placeholder={
                  aiAgentMode
                    ? "Reply to ADletic — what do you want to create?"
                    : selectedModel
                      ? `Describe what ${selectedModel.name} should create...`
                      : "Select a model first"
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                className={`w-full backdrop-blur-md text-sm placeholder-gray-400 border rounded-2xl transition-all duration-200 focus:outline-none focus:border-[#f26522]/60 focus:ring-2 focus:ring-[#f26522]/10 shadow-md px-5 ${aiAgentMode ? "pt-36" : "pt-4"} pb-14 resize-none leading-5 ${isDark ? "bg-[#0d1117]/95 text-white border-gray-800" : "bg-white text-[#0d1117] border-gray-200"}`}
                style={{ height: aiAgentMode ? 260 : 120 }}
              />
              {/* Reference thumbnails — show what's currently attached to the prompt */}
              {refItems.length > 0 && (
                <div className="absolute top-3 left-4 right-4 flex flex-wrap gap-1.5 pointer-events-none">
                  {refItems.map((it, i) => (
                    <div key={it.id} className="relative group/heroRef pointer-events-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={it.outputUrl || it.src}
                        alt={`ref ${i + 1}`}
                        className={`h-9 w-9 rounded-md object-cover border ${isDark ? "border-gray-700" : "border-gray-300"}`}
                      />
                      <button
                        type="button"
                        onClick={() => useAppStore.setState({ inputRefs: inputRefs.filter((id) => id !== it.id) })}
                        className="absolute -top-1 -right-1 bg-neutral-800 rounded-full p-0.5 text-neutral-300 hover:text-white opacity-100 active:opacity-50 transition-opacity"
                        title="Remove reference"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Bottom row inside textarea */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {/* Reference image — uploads & adds the file as an input
                      reference for the model (i2i / i2v / referenced gen). */}
                  <input
                    ref={heroRefInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleHeroRefPick(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => heroRefInputRef.current?.click()}
                    title="Add reference image to prompt"
                    className={`flex items-center gap-1 h-8 px-2.5 rounded-full text-[11px] font-medium transition-colors active:opacity-70 ${
                      isDark
                        ? "text-gray-300 hover:text-[#f26522] hover:bg-white/5"
                        : "text-gray-500 hover:text-[#f26522] hover:bg-gray-100"
                    }`}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reference</span>
                  </button>
                  {selectedModel && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full truncate ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                      {selectedModel.name} &middot; {getEstimatedCost(selectedModel, generationOptions)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!aiAgentMode && !selectedModel}
                  onClick={handleGenerate}
                  className={`shrink-0 flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold transition-all ${
                    !aiAgentMode && !selectedModel
                      ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                      : aiAgentMode
                        ? "bg-gradient-to-r from-[#f26522] to-[#ec4899] text-white hover:shadow-lg cursor-pointer hover:scale-105"
                        : "bg-[#f26522] text-white hover:bg-[#d9541a] cursor-pointer hover:scale-105"
                  }`}
                  title={aiAgentMode ? "Send to ADletic AI (Ctrl+Enter)" : "Generate (Ctrl+Enter)"}
                >
                  {aiAgentMode ? <Sparkles className="h-3.5 w-3.5" /> : <WandSparkles className="h-3.5 w-3.5" />}
                  {aiAgentMode ? "Ask ADletic" : "Generate"}
                </button>
              </div>
            </div>
            {/* Model generation options — only in Manual mode. In AI Agent
                mode ADletic decides aspect ratio / resolution per request. */}
            {!aiAgentMode && (
              <div className="flex justify-center">
                {renderOptionPills()}
              </div>
            )}

            {/* Hidden file input still wired for canvas-paste / drop flows. */}
            <input
              ref={heroFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleHeroFilePick(f);
                e.target.value = "";
              }}
            />

            {/* Other boards — quick switcher when canvas is empty. Skips the
                current (empty) board, hides the row entirely if the user
                only has one board total. */}
            {boards.filter((b) => b.id !== activeBoardId).length > 0 && (
              <div className="mt-5 mb-1">
                <p className={`text-center text-[10px] uppercase tracking-wider mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  Or jump to another board
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {boards
                    .filter((b) => b.id !== activeBoardId)
                    .slice(0, 8)
                    .map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => switchBoard(b.id)}
                        className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition-all hover:-translate-y-0.5 ${
                          isDark
                            ? "text-gray-300 border-gray-700 bg-[#161b22] hover:border-[#f26522] hover:text-[#f26522]"
                            : "text-gray-600 border-gray-200 bg-white hover:border-[#f26522] hover:text-[#f26522]"
                        }`}
                        title={`Switch to ${b.name}`}
                      >
                        <LayoutGrid className="h-3 w-3" />
                        <span className="font-medium truncate max-w-[120px]">{b.name}</span>
                        <span className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                          {b.items.length}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Need help / WhatsApp us / Visit website */}
            <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
              <a
                href="https://wa.me/60112167672?text=Hi%2C%20I%20need%20help%20with%20MotionBoards%20%F0%9F%91%8B"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("whatsapp_clicked", { source: "empty_hero" })}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3.5 py-2 rounded-full border border-[#25D366]/40 text-[#25D366] bg-[#25D366]/5 hover:bg-[#25D366]/10 active:bg-[#25D366]/15 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" fill="currentColor" />
                WhatsApp us
              </a>
              <a
                href="https://adleticagency.com/motionboards-ai-video-software"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3.5 py-2 rounded-full border transition-colors ${
                  isDark
                    ? "border-gray-700 text-gray-300 bg-[#161b22] hover:border-[#f26522] hover:text-[#f26522] active:opacity-70"
                    : "border-gray-200 text-gray-600 bg-white hover:border-[#f26522] hover:text-[#f26522] active:opacity-70"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Visit website
              </a>
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
    <div className="absolute bottom-0 left-0 right-0 flex flex-col pointer-events-none" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
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
              onToggleInputRef={(id) => {
                const store = useAppStore.getState();
                const currentRefs = store.inputRefs;
                // Removing is always allowed; only adding hits the cap check.
                if (currentRefs.includes(id)) { store.toggleInputRef(id); return; }
                const item = items.find((x) => x.id === id);
                if (!item || !selectedModel) { store.toggleInputRef(id); return; }
                // What slot would this item fill? Match by type to the first
                // model input of the same kind, preferring multi-ref slots
                // (reference_images / image_urls / reference_videos) when the
                // item matches one of those.
                const itemKind: "image" | "video" | "audio" =
                  (item.type === "image" || item.type === "psd-layer" || (item.type === "generation" && item.outputType === "image")) ? "image"
                  : (item.type === "video" || (item.type === "generation" && item.outputType === "video")) ? "video"
                  : "audio";
                // Count refs of the same kind currently attached.
                const sameKindRefs = currentRefs
                  .map((rid) => items.find((x) => x.id === rid))
                  .filter((it): it is BoardItem => !!it)
                  .filter((it) => {
                    if (itemKind === "image") return it.type === "image" || it.type === "psd-layer" || (it.type === "generation" && it.outputType === "image");
                    if (itemKind === "video") return it.type === "video" || (it.type === "generation" && it.outputType === "video");
                    return it.type === "audio" || (it.type === "generation" && it.outputType === "audio");
                  });
                // Find the model's multi-ref slot for this kind via the
                // shared helper in models.ts (kept in one place so the same
                // rule applies in board-item.tsx, the API route, etc.).
                const multiRefSlot = findMultiRefSlot(selectedModel, itemKind);
                if (multiRefSlot && multiRefSlot.maxCount && sameKindRefs.length >= multiRefSlot.maxCount) {
                  showToast(
                    `${selectedModel.name} accepts at most ${multiRefSlot.maxCount} ${itemKind} references. Unset one before adding another.`,
                    { kind: "error", durationMs: 6000 }
                  );
                  return;
                }
                store.toggleInputRef(id);
              }}
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
            {/* Top resize bar — drag left/up to resize. Taller on touch
                so it's hittable with a finger; pointer events fire for both
                mouse + touch. */}
            <div
              className={`flex items-center justify-center h-7 sm:h-5 cursor-nw-resize select-none shrink-0 rounded-t-2xl transition-colors touch-none ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
              onPointerDown={onDragStart}
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
              maxLength={selectedModel?.maxPromptChars}
              onChange={(e) => { setPrompt(e.target.value); autoResize(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleGenerate(); }
              }}
              className={`w-full text-xs placeholder-gray-400 px-3 pt-1 pb-1 resize-none leading-5 bg-transparent focus:outline-none flex-1 ${isDark ? "text-white" : "text-[#0d1117]"}`}
              style={{ minHeight: boxMinH, maxHeight: 500 }}
            />

            {/* Bottom bar — cost + char counter + generate */}
            {(() => {
              // Per-model char limits live on the model in src/lib/models.ts
              // (e.g. Seedance 2.0 = 2000). When a model declares one we render
              // a live counter and visually warn from 80% on; the textarea's
              // maxLength already hard-blocks at the cap so the counter never
              // shows a "real" overflow — but we still display it as the user
              // approaches so they see the ceiling coming.
              const cap = selectedModel?.maxPromptChars;
              const len = prompt.length;
              const overWarnThreshold = cap ? len >= cap * 0.8 : false;
              const atCap = cap ? len >= cap : false;
              const counterColor = !cap
                ? "text-gray-400"
                : atCap
                  ? "text-red-500"
                  : overWarnThreshold
                    ? "text-amber-500"
                    : "text-gray-400";
              return (
                <div className="flex items-center justify-between px-2.5 pb-2 pt-1 shrink-0">
                  <div className="flex items-center gap-2">
                    {selectedModel && <span className="text-[9px] text-gray-400">{getEstimatedCost(selectedModel, generationOptions)}</span>}
                    {selectedModel && cap && (
                      <span
                        className={`text-[9px] tabular-nums ${counterColor}`}
                        title={atCap ? `${selectedModel.name} caps prompts at ${cap} characters — anything longer would be silently truncated by the provider.` : `Prompt limit for ${selectedModel.name}: ${cap} characters.`}
                      >
                        {len.toLocaleString()} / {cap.toLocaleString()}
                      </span>
                    )}
                    {!selectedModel && <span />}
                  </div>
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
              );
            })()}
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
    maxMB?: number;
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
          maxMB: inp.maxMB,
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
          maxMB: inp.maxMB,
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
          maxMB: inp.maxMB,
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
            {r.maxMB ? (
              <span className={`text-[9px] font-semibold tracking-tight ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                max {r.maxMB} MB
              </span>
            ) : null}
            <span className={`rounded-full px-1.5 py-[1px] text-[8.5px] font-black uppercase tracking-wider ${statusTone}`}>
              {armed && r.clickMode === "set" ? "click" : armed && r.clickMode === "clear" ? "unset" : status}
            </span>
          </button>
        );
      })}
    </div>
  );
}
