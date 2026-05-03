"use client";

import { create } from "zustand";
import { imgCachePut, imgCacheGet, imgCacheDelete, imgCacheKeys } from "./image-cache";

// --- LocalStorage autosave ---
const STORAGE_KEY = "motionboards_state";

interface SavedState {
  boards: Board[];
  activeBoardId: string;
  selectedModelId: string | null;
  savedAt?: number;
}

function loadSavedState(): Partial<SavedState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    // Items with empty src are kept — they will be restored asynchronously from
    // IndexedDB by restoreFromImageCache() after the store initializes. Any lingering
    // blob: URLs from a previous session are dead references and must be cleared.
    if (parsed.boards) {
      for (const board of parsed.boards) {
        if (board.items) {
          board.items = board.items.map((item) => {
            const src = item.src || "";
            if (src.startsWith("blob:")) return { ...item, src: "" };
            return item;
          });
        }
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

// Captured ONCE when the module first loads — before the Zustand subscriber has
// a chance to fire saveToLocalStorage() and overwrite localStorage with a fresh
// `savedAt = Date.now()`. Without this, every page reload makes the LS timestamp
// look like "now," and the cross-device conflict resolver in the DB-load chain
// will *always* prefer the local copy — even when the DB holds newer state from
// another tab/device. The race actually played out in production: opening the
// canvas the day after a heavy generation session would clobber the DB with the
// stale browser-local state, taking every snapshot's content with it.
const initialLoadedState: Partial<SavedState> | null =
  typeof window !== "undefined" ? loadSavedState() : null;
const initialLoadedSavedAt: number = initialLoadedState?.savedAt || 0;
const initialLoadedItemCount: number = (initialLoadedState?.boards || []).reduce(
  (sum, b) => sum + (Array.isArray(b.items) ? b.items.length : 0),
  0
);

function getCurrentBoards(state: AppState): Board[] {
  return state.boards.map((b) =>
    b.id === state.activeBoardId
      ? { ...b, items: state.items, connections: state.connections, panX: state.panX, panY: state.panY, zoom: state.zoom, name: state.boardName }
      : b
  );
}

function saveToLocalStorage(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    // Track items whose src must be cached in IndexedDB instead of localStorage
    // (data: URIs are too large for LS; blob: URLs die with the document).
    const pendingCache: Array<{ id: string; src: string; isBlob: boolean }> = [];
    const boards = getCurrentBoards(state).map((b) => ({
      ...b,
      items: b.items.map((item) => {
        const src = item.src || "";
        if (src.startsWith("data:")) {
          pendingCache.push({ id: item.id, src, isBlob: false });
          return { ...item, src: "" };
        }
        if (src.startsWith("blob:")) {
          pendingCache.push({ id: item.id, src, isBlob: true });
          return { ...item, src: "" };
        }
        return item;
      }),
    }));
    const data: SavedState = {
      boards,
      activeBoardId: state.activeBoardId,
      selectedModelId: state.selectedModelId,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Persist unfinalized sources to IndexedDB (async, fire-and-forget).
    // data: URIs are stored as strings; blob: URLs are fetched and stored as Blobs.
    for (const p of pendingCache) {
      if (p.isBlob) {
        fetch(p.src)
          .then((r) => r.blob())
          .then((blob) => imgCachePut(p.id, blob))
          .catch(() => {});
      } else {
        imgCachePut(p.id, p.src).catch(() => {});
      }
    }

    // GC: remove IDB entries for items that no longer need caching
    // (src was finalized to a CDN URL, or the item was deleted).
    const activeIds = new Set(pendingCache.map((p) => p.id));
    imgCacheKeys()
      .then((keys) => {
        for (const k of keys) {
          if (!activeIds.has(k)) imgCacheDelete(k).catch(() => {});
        }
      })
      .catch(() => {});
  } catch {
    // localStorage full or unavailable
  }
}

// Max body size to send to /api/boards. Vercel's serverless function body
// limit is ~4.5 MB on every plan; we keep a ~500 KB safety margin.
const BOARDS_SAVE_MAX_BYTES = 4 * 1024 * 1024;

function stripUnfinalized(url: string | undefined): string {
  if (!url) return "";
  return url.startsWith("data:") || url.startsWith("blob:") ? "" : url;
}

async function saveToDb(state: AppState) {
  const boards = getCurrentBoards(state).map((b) => ({
    ...b,
    items: b.items.map((item) => ({
      ...item,
      // Strip any field that could hold a huge data: URI. These belong in
      // IndexedDB (via imgCache), not in the Neon-backed board JSON.
      src: stripUnfinalized(item.src),
      outputUrl: stripUnfinalized(item.outputUrl),
    })),
  }));
  const json = JSON.stringify({
    boards,
    activeBoardId: state.activeBoardId,
    selectedModelId: state.selectedModelId,
    savedAt: Date.now(),
  });

  // Gzip in the browser before sending — JSON typically compresses ~85%, so
  // a 5 MB raw board fits comfortably under Vercel's 4 MB request cap.
  // Without this, big boards silently skipped the autosave and mobile/other
  // devices loaded stale DB state on login.
  let bodyInit: BodyInit = json;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof CompressionStream !== "undefined") {
    try {
      const encoded = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
      const buffer = await new Response(encoded).arrayBuffer();
      bodyInit = buffer;
      headers["Content-Encoding"] = "gzip";
    } catch {
      // Fall through with the uncompressed body — caught by the size guard below.
    }
  }

  // Last-resort guard: if even gzip can't get under the cap (unusual), skip
  // the save instead of producing a 413 every 2s.
  const finalSize = bodyInit instanceof ArrayBuffer ? bodyInit.byteLength : json.length;
  if (finalSize > BOARDS_SAVE_MAX_BYTES) {
    console.warn(
      `[saveToDb] Skipping autosave: ${(finalSize / 1024 / 1024).toFixed(1)} MB exceeds the 4 MB body cap even after gzip. Delete old items.`
    );
    return;
  }

  fetch("/api/boards", { method: "POST", headers, body: bodyInit }).catch(() => {});
}

export interface ImageEditState {
  brightness: number;   // default 100
  contrast: number;     // default 100
  saturate: number;     // default 100
  hueRotate: number;    // default 0 (degrees)
  cropX: number;        // 0-1 fraction
  cropY: number;
  cropW: number;        // 1 = full width
  cropH: number;        // 1 = full height
}

export const defaultEditState: ImageEditState = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hueRotate: 0,
  cropX: 0,
  cropY: 0,
  cropW: 1,
  cropH: 1,
};

export interface BoardItem {
  id: string;
  type: "image" | "video" | "audio" | "generation" | "psd-layer" | "text" | "drawing";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string; // URL or data URI
  fileName?: string;
  prompt?: string;
  model?: string;
  modelName?: string;
  status?: "idle" | "processing" | "completed" | "failed";
  error?: string;
  outputUrl?: string;
  outputType?: "image" | "video" | "audio";
  cost?: string;
  progressText?: string;
  expectedDuration?: number; // seconds, for progress estimation
  starred?: boolean;
  // File size of the uploaded/dropped asset. Written when we know it
  // (drop, paste, folder-add). Used to pre-flight per-model input limits
  // before a generate call — so a 50 MB video can live on the canvas fine
  // but we warn before burning credits on a model that caps at 20 MB.
  sizeBytes?: number;
  // Persisted polling state so generations resume if the page refreshes.
  // Written when /api/generate returns a requestId; cleared once we hit
  // the terminal state on the next poll.
  requestId?: string;
  generationId?: string;
  pollProvider?: "gemini" | "openai" | "replicate" | "byteplus" | "comfy";
  createdAt: string;
  // PSD layer metadata
  psdGroupId?: string;
  psdLayerName?: string;
  psdLayerOrder?: number;
  psdBlendMode?: string;
  psdOpacity?: number;
  psdHidden?: boolean;
  // Image editing state (non-destructive)
  editState?: ImageEditState;
  // Text item fields
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontColor?: string;
  fontWeight?: string;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  backgroundColor?: string;
  // Drawing item fields
  drawingPaths?: string; // SVG path data
  strokeColor?: string;
  strokeWidth?: number;
  // Group membership — items sharing the same groupId move together when
  // any one is dragged or arrow-key-moved, and are selected as a unit.
  // Created via groupSelectedItems(); cleared via ungroupSelectedItems().
  groupId?: string;
}

export interface Board {
  id: string;
  name: string;
  items: BoardItem[];
  panX: number;
  panY: number;
  zoom: number;
  connections: Connection[];
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
}

export interface AppState {
  // Boards
  boards: Board[];
  activeBoardId: string;

  // Canvas (derived from active board)
  items: BoardItem[];
  selectedItemId: string | null;
  selectedItemIds: string[]; // multi-selection (marquee, shift-click)
  clipboard: BoardItem[]; // copied items, in-memory only
  panX: number;
  panY: number;
  zoom: number;
  boardName: string;

  // Model panel
  selectedModelId: string | null;
  isModelPanelOpen: boolean;

  // Templates panel
  isTemplatesOpen: boolean;
  pendingPrompt: string | null;

  // Panels
  isDashboardOpen: boolean;
  isProfileOpen: boolean;
  isHistoryOpen: boolean;
  isAIPromptOpen: boolean;
  // AI Agent mode — when true, the empty-hero "Generate" sends the user's
  // request to ADletic AI in the panel instead of directly running the
  // currently selected model. Persisted to localStorage on toggle.
  aiAgentMode: boolean;
  // Seed message for the AI panel — set by AI Agent mode handoff. Panel
  // consumes it on mount, fires it as the first user message, then clears.
  // imageUrl is an optional public URL that gets attached as a reference;
  // forceNewChat tells the panel to start a fresh chat thread first.
  pendingChatSeed: { text: string; imageUrl?: string; forceNewChat?: boolean } | null;

  // References
  startFrameId: string | null;
  endFrameId: string | null;
  inputRefs: string[]; // item IDs selected as INPUT
  audioInputId: string | null; // item ID for audio input

  // Generation
  isGenerating: boolean;
  generationOptions: Record<string, unknown>; // per-generation options (aspect_ratio, duration, etc.)

  // Edit mode
  isEditMode: boolean;
  isCropMode: boolean;

  // Canvas tool mode
  activeCanvasTool: "select" | "text" | "draw" | "connect" | null;
  // When set, the matching item enters edit mode immediately on render.
  // Cleared by the consumer after it activates editing.
  autoEditItemId: string | null;
  drawingColor: string;
  drawingStrokeWidth: number;
  connections: Connection[];
  theme: "light" | "dark";
  connectingFromId: string | null;
  // When true, every new generation automatically draws connection lines from
  // its input refs (start frame, end frame, input refs, audio) to the generation
  autoConnectGenerations: boolean;

  // Folders panel
  isFoldersOpen: boolean;

  // Single-tab session lock — set by the heartbeat poll when another tab
  // (same browser or different device) currently owns the session. While
  // this is true, autosaves are paused and the canvas surfaces a blocking
  // modal. Cleared as soon as the heartbeat returns isYou=true again
  // (either the other tab closed and we reclaimed the slot, or the user
  // hit "Take over here").
  multiTabLockout: {
    ownerTabId: string;
    ownerSeenAt: number;
    detectedAt: number;
  } | null;
  takeoverInProgress: boolean;
  // True only while the canvas page (`/generate`) is mounted. Other pages
  // (media library, dashboard, etc.) read the store but never push canvas
  // state changes to /api/boards — so they don't need to participate in
  // the single-tab lock. Toggled by canvas.tsx on mount/unmount; gates
  // the saveToDb subscriber + heartbeat lifecycle.
  canvasMounted: boolean;

  // Undo/Redo
  undoStack: BoardItem[][];
  redoStack: BoardItem[][];

  // Actions
  addItem: (item: BoardItem) => void;
  updateItem: (id: string, updates: Partial<BoardItem>) => void;
  removeItem: (id: string) => void;
  selectItem: (id: string | null) => void;
  selectItems: (ids: string[]) => void;
  copySelectedItems: () => void;
  pasteItems: (atX?: number, atY?: number) => void;
  removeSelectedItems: () => void;
  moveItem: (id: string, x: number, y: number) => void;
  setPan: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  setBoardName: (name: string) => void;
  setSelectedModel: (id: string | null) => void;
  setModelPanelOpen: (open: boolean) => void;
  setTemplatesOpen: (open: boolean) => void;
  setPendingPrompt: (prompt: string | null) => void;
  setDashboardOpen: (open: boolean) => void;
  setProfileOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  setAIPromptOpen: (open: boolean) => void;
  setAiAgentMode: (on: boolean) => void;
  setPendingChatSeed: (seed: { text: string; imageUrl?: string; forceNewChat?: boolean } | null) => void;
  setStartFrame: (id: string | null) => void;
  setEndFrame: (id: string | null) => void;
  toggleInputRef: (id: string) => void;
  setAudioInput: (id: string | null) => void;
  toggleStar: (id: string) => void;
  clearRefs: () => void;
  // Organize mode — drag-select N items, hit Organize, then use arrow keys
  // to tetris them into place. Up/Down cycles which item is active inside
  // the selection; Left/Right nudges it by a grid step; Enter auto-packs
  // the whole group into a tight reading-order grid; Esc exits.
  organizeMode: boolean;
  organizeActiveId: string | null;
  toggleOrganizeMode: () => void;
  cycleOrganizeActive: (dir: "next" | "prev") => void;
  nudgeOrganizeActive: (dx: number, dy: number) => void;
  autoPackSelection: () => void;
  // Move every selected item (or the single selected item) by (dx, dy) in
  // canvas units. Used by the arrow-key handler outside organize mode for
  // Tetris-style step movement.
  moveSelectedItems: (dx: number, dy: number) => void;
  // Group / ungroup. Group assigns a fresh shared groupId to every selected
  // item; ungroup clears it. Selecting any item in a group via selectItem()
  // expands the selection to the whole group automatically.
  groupSelectedItems: () => void;
  ungroupSelectedItems: () => void;
  setIsGenerating: (v: boolean) => void;
  setGenerationOptions: (opts: Record<string, unknown>) => void;
  setGenerationOption: (key: string, value: unknown) => void;
  setEditMode: (v: boolean) => void;
  setCropMode: (v: boolean) => void;
  updateEditState: (id: string, edits: Partial<ImageEditState>) => void;
  resetEditState: (id: string) => void;
  applyEditState: (id: string, newSrc: string) => void;
  addBoard: () => void;
  insertImportedBoard: (board: Board) => void;
  switchBoard: (boardId: string) => void;
  deleteBoard: (boardId: string) => void;
  renameBoard: (boardId: string, name: string) => void;
  setActiveCanvasTool: (tool: "select" | "text" | "draw" | "connect" | null) => void;
  setAutoEditItemId: (id: string | null) => void;
  setDrawingColor: (color: string) => void;
  setDrawingStrokeWidth: (width: number) => void;
  addConnection: (fromId: string, toId: string) => void;
  removeConnection: (id: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  setAutoConnectGenerations: (v: boolean) => void;
  restoreBoardsSnapshot: (snapshot: unknown) => void;
  setConnectingFromId: (id: string | null) => void;
  setFoldersOpen: (open: boolean) => void;
  setMultiTabLockout: (info: AppState["multiTabLockout"]) => void;
  setTakeoverInProgress: (v: boolean) => void;
  setCanvasMounted: (v: boolean) => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

const initialBoard: Board = {
  id: "board_1",
  name: "Board 1",
  items: [],
  connections: [],
  panX: 0,
  panY: 0,
  zoom: 1,
};

export const useAppStore = create<AppState>((set) => {
  // Reuse the module-init snapshot so we don't double-read localStorage
  // (and so the captured initialLoadedSavedAt above stays consistent with
  // the boards we hydrate the store from here).
  const saved = initialLoadedState;
  const startBoard = saved?.boards?.[0]
    ? (saved.boards.find((b) => b.id === saved.activeBoardId) || saved.boards[0])
    : initialBoard;

  return ({
  boards: saved?.boards || [initialBoard],
  activeBoardId: saved?.activeBoardId || "board_1",
  items: startBoard.items || [],
  selectedItemId: null,
  selectedItemIds: [],
  clipboard: [],
  panX: startBoard.panX || 0,
  panY: startBoard.panY || 0,
  zoom: startBoard.zoom || 1,
  boardName: startBoard.name || "Board 1",
  selectedModelId: saved?.selectedModelId || "gemini-3.1-flash-image-preview",
  isModelPanelOpen: false,
  isTemplatesOpen: false,
  isDashboardOpen: false,
  isProfileOpen: false,
  isHistoryOpen: false,
  isAIPromptOpen: false,
  // Default to AI Agent for genuinely new visitors — they need the
  // onboarding flow to land. Anyone who's already completed onboarding once
  // (mb_user_name set, regardless of which device they did it on) just gets
  // a clean canvas; the AI Agent toggle is still one click away.
  // Explicit toggles (motionboards_ai_agent_mode === "true"|"false") always
  // win and are respected verbatim.
  aiAgentMode: (() => {
    if (typeof window === "undefined") return true;
    try {
      const explicit = window.localStorage.getItem("motionboards_ai_agent_mode");
      if (explicit === "true") return true;
      if (explicit === "false") return false;
      // No explicit choice yet — onboarded users default to plain canvas,
      // first-time visitors default to the AI greeting flow.
      const onboarded = !!window.localStorage.getItem("mb_user_name");
      return !onboarded;
    } catch {
      return true;
    }
  })(),
  pendingChatSeed: null,
  pendingPrompt: null,
  startFrameId: null,
  endFrameId: null,
  inputRefs: [],
  audioInputId: null,
  organizeMode: false,
  organizeActiveId: null,
  isGenerating: false,
  generationOptions: {},
  isEditMode: false,
  isCropMode: false,
  activeCanvasTool: null,
  autoEditItemId: null,
  drawingColor: "#000000",
  drawingStrokeWidth: 3,
  connections: startBoard.connections || [],
  theme: (typeof window !== "undefined" && localStorage.getItem("motionboards_theme") as "light" | "dark") || "light",
  autoConnectGenerations: typeof window !== "undefined" ? localStorage.getItem("motionboards_autoconnect") !== "false" : true,
  connectingFromId: null,
  isFoldersOpen: false,
  multiTabLockout: null,
  takeoverInProgress: false,
  canvasMounted: false,
  undoStack: [],
  redoStack: [],

  pushUndo: () => set((s) => ({
    undoStack: [...s.undoStack.slice(-49), s.items],
    redoStack: [],
  })),
  undo: () => set((s) => {
    if (s.undoStack.length === 0) return s;
    const prev = s.undoStack[s.undoStack.length - 1];
    return {
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, s.items],
      items: prev,
    };
  }),
  redo: () => set((s) => {
    if (s.redoStack.length === 0) return s;
    const next = s.redoStack[s.redoStack.length - 1];
    return {
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, s.items],
      items: next,
    };
  }),
  setActiveCanvasTool: (activeCanvasTool) => set({ activeCanvasTool }),
  setAutoEditItemId: (autoEditItemId) => set({ autoEditItemId }),
  setDrawingColor: (drawingColor) => set({ drawingColor }),
  setDrawingStrokeWidth: (drawingStrokeWidth) => set({ drawingStrokeWidth }),
  addConnection: (fromId, toId) => set((s) => ({
    connections: [...s.connections, { id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, fromId, toId }],
  })),
  removeConnection: (id) => set((s) => ({
    connections: s.connections.filter((c) => c.id !== id),
  })),
  setTheme: (theme) => {
    if (typeof window !== "undefined") localStorage.setItem("motionboards_theme", theme);
    set({ theme });
  },
  setAutoConnectGenerations: (v) => {
    if (typeof window !== "undefined") localStorage.setItem("motionboards_autoconnect", String(v));
    set({ autoConnectGenerations: v });
  },
  restoreBoardsSnapshot: (snapshot) =>
    set(() => {
      const snap = snapshot as { boards?: Board[]; activeBoardId?: string; selectedModelId?: string | null };
      const nextBoards = Array.isArray(snap.boards) && snap.boards.length > 0
        ? snap.boards
        : [{ id: "board_1", name: "Board 1", items: [], connections: [], panX: 0, panY: 0, zoom: 1 }];
      const targetId = snap.activeBoardId && nextBoards.find((b) => b.id === snap.activeBoardId)
        ? snap.activeBoardId
        : nextBoards[0].id;
      const active = nextBoards.find((b) => b.id === targetId) || nextBoards[0];
      return {
        boards: nextBoards,
        activeBoardId: active.id,
        items: active.items || [],
        connections: active.connections || [],
        panX: active.panX || 0,
        panY: active.panY || 0,
        zoom: active.zoom || 1,
        boardName: active.name || "Board 1",
        selectedModelId: snap.selectedModelId ?? null,
        selectedItemId: null,
        selectedItemIds: [],
        startFrameId: null,
        endFrameId: null,
        inputRefs: [],
        audioInputId: null,
        undoStack: [],
        redoStack: [],
      };
    }),
  setConnectingFromId: (connectingFromId) => set({ connectingFromId }),
  setFoldersOpen: (isFoldersOpen) => set({ isFoldersOpen }),
  setMultiTabLockout: (multiTabLockout) => set({ multiTabLockout }),
  setTakeoverInProgress: (takeoverInProgress) => set({ takeoverInProgress }),
  setCanvasMounted: (canvasMounted) => set({ canvasMounted }),

  addItem: (item) => set((s) => ({
    undoStack: [...s.undoStack.slice(-49), s.items],
    redoStack: [],
    items: [...s.items, item],
  })),
  updateItem: (id, updates) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    })),
  removeItem: (id) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-49), s.items],
      redoStack: [],
      items: s.items.filter((i) => i.id !== id),
      connections: s.connections.filter((c) => c.fromId !== id && c.toId !== id),
      selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
      startFrameId: s.startFrameId === id ? null : s.startFrameId,
      endFrameId: s.endFrameId === id ? null : s.endFrameId,
      inputRefs: s.inputRefs.filter((r) => r !== id),
      audioInputId: s.audioInputId === id ? null : s.audioInputId,
    })),
  selectItem: (id) =>
    set((s) => {
      if (!id) return { selectedItemId: null, selectedItemIds: [] };
      const item = s.items.find((i) => i.id === id);
      // No group → behave exactly as before (single-item select).
      if (!item || !item.groupId) {
        return { selectedItemId: id, selectedItemIds: [id] };
      }
      // Item has a groupId → select every member of that group as a unit.
      const ids = s.items.filter((i) => i.groupId === item.groupId).map((i) => i.id);
      return { selectedItemId: id, selectedItemIds: ids };
    }),
  selectItems: (ids) => set({ selectedItemIds: ids, selectedItemId: ids[0] || null }),
  copySelectedItems: () =>
    set((s) => {
      const ids = s.selectedItemIds.length > 0 ? s.selectedItemIds : (s.selectedItemId ? [s.selectedItemId] : []);
      const copied = s.items.filter((i) => ids.includes(i.id));
      return { clipboard: copied.map((i) => ({ ...i })) };
    }),
  pasteItems: (atX, atY) =>
    set((s) => {
      if (s.clipboard.length === 0) return s;
      // Compute offset so pasted group appears near the target (or offset by 30px from originals)
      const minX = Math.min(...s.clipboard.map((i) => i.x));
      const minY = Math.min(...s.clipboard.map((i) => i.y));
      const offsetX = atX !== undefined ? atX - minX : 30;
      const offsetY = atY !== undefined ? atY - minY : 30;
      // Guarantee unique IDs even when clipboard has multiple items pasted in one tick.
      // Track an old→new ID map so we can also clone connections that were
      // entirely between copied items (preserving the visual relationship).
      const now = Date.now();
      const idMap = new Map<string, string>();
      const pasted = s.clipboard.map((srcItem, i) => {
        const newId = `item_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        idMap.set(srcItem.id, newId);
        return {
          ...srcItem,
          id: newId,
          x: srcItem.x + offsetX,
          y: srcItem.y + offsetY,
          createdAt: new Date().toISOString(),
        };
      });
      // Duplicate any connection where BOTH endpoints are inside the pasted set.
      // Connections that crossed in/out of the copied group are not duplicated —
      // those would create misleading lines from external items the user didn't pick.
      const newConnections = s.connections
        .filter((c) => idMap.has(c.fromId) && idMap.has(c.toId))
        .map((c, i) => ({
          id: `conn_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          fromId: idMap.get(c.fromId)!,
          toId: idMap.get(c.toId)!,
        }));
      return {
        undoStack: [...s.undoStack.slice(-49), s.items],
        redoStack: [],
        items: [...s.items, ...pasted],
        connections: [...s.connections, ...newConnections],
        selectedItemIds: pasted.map((p) => p.id),
        selectedItemId: pasted[0]?.id || null,
      };
    }),

  removeSelectedItems: () =>
    set((s) => {
      const ids = s.selectedItemIds.length > 0 ? s.selectedItemIds : (s.selectedItemId ? [s.selectedItemId] : []);
      if (ids.length === 0) return s;
      const idSet = new Set(ids);
      return {
        undoStack: [...s.undoStack.slice(-49), s.items],
        redoStack: [],
        items: s.items.filter((i) => !idSet.has(i.id)),
        connections: s.connections.filter((c) => !idSet.has(c.fromId) && !idSet.has(c.toId)),
        selectedItemId: null,
        selectedItemIds: [],
        startFrameId: idSet.has(s.startFrameId || "") ? null : s.startFrameId,
        endFrameId: idSet.has(s.endFrameId || "") ? null : s.endFrameId,
        inputRefs: s.inputRefs.filter((r) => !idSet.has(r)),
        audioInputId: idSet.has(s.audioInputId || "") ? null : s.audioInputId,
      };
    }),
  moveItem: (id, x, y) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, x, y } : i)),
    })),
  setPan: (panX, panY) => set({ panX, panY }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),
  setBoardName: (boardName) => set({ boardName }),
  setSelectedModel: (selectedModelId) => set({ selectedModelId, generationOptions: {} }),
  setModelPanelOpen: (isModelPanelOpen) => set({ isModelPanelOpen }),
  setTemplatesOpen: (isTemplatesOpen) => set({ isTemplatesOpen }),
  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
  setDashboardOpen: (isDashboardOpen) => set({ isDashboardOpen }),
  setProfileOpen: (isProfileOpen) => set({ isProfileOpen, isHistoryOpen: false }),
  setHistoryOpen: (isHistoryOpen) => set({ isHistoryOpen, isProfileOpen: false }),
  setAIPromptOpen: (isAIPromptOpen) => set({ isAIPromptOpen }),
  setAiAgentMode: (aiAgentMode) => {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem("motionboards_ai_agent_mode", String(aiAgentMode)); } catch {}
    }
    set({ aiAgentMode });
  },
  setPendingChatSeed: (pendingChatSeed) => set({ pendingChatSeed }),
  setStartFrame: (startFrameId) => set({ startFrameId }),
  setEndFrame: (endFrameId) => set({ endFrameId }),
  toggleInputRef: (id) =>
    set((s) => ({
      inputRefs: s.inputRefs.includes(id)
        ? s.inputRefs.filter((r) => r !== id)
        : [...s.inputRefs, id],
    })),
  setAudioInput: (id) => set({ audioInputId: id }),
  toggleStar: (id) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, starred: !i.starred } : i)),
    })),

  toggleOrganizeMode: () =>
    set((s) => {
      // Exiting — clear active id.
      if (s.organizeMode) return { organizeMode: false, organizeActiveId: null };
      // Entering — need at least one selected item.
      const ids = s.selectedItemIds.length > 0
        ? s.selectedItemIds
        : (s.selectedItemId ? [s.selectedItemId] : []);
      if (ids.length === 0) return s;
      // First-active = the selection's top-left (reading order).
      const first = s.items
        .filter((i) => ids.includes(i.id))
        .sort((a, b) => (Math.abs(a.y - b.y) > 50 ? a.y - b.y : a.x - b.x))[0];
      return { organizeMode: true, organizeActiveId: first ? first.id : null };
    }),

  cycleOrganizeActive: (dir) =>
    set((s) => {
      const ids = s.selectedItemIds;
      if (ids.length === 0) return s;
      const sorted = ids
        .map((id) => s.items.find((i) => i.id === id))
        .filter((it): it is BoardItem => !!it)
        .sort((a, b) => (Math.abs(a.y - b.y) > 50 ? a.y - b.y : a.x - b.x))
        .map((it) => it.id);
      const cur = s.organizeActiveId && sorted.includes(s.organizeActiveId)
        ? sorted.indexOf(s.organizeActiveId)
        : -1;
      const next = dir === "next"
        ? (cur + 1) % sorted.length
        : (cur - 1 + sorted.length) % sorted.length;
      return { organizeActiveId: sorted[next] };
    }),

  nudgeOrganizeActive: (dx, dy) =>
    set((s) => {
      if (!s.organizeActiveId) return s;
      return {
        items: s.items.map((it) =>
          it.id === s.organizeActiveId ? { ...it, x: it.x + dx, y: it.y + dy } : it
        ),
      };
    }),

  // One-shot pack — shelf-pack everything into a tight grid anchored at the
  // top-left of whatever's being packed.
  //
  // Targeting:
  //   - 2+ items selected → pack just the selection
  //   - 0 or 1 selected   → pack ALL items on the board (the common case
  //     when the user just clicks Organize → Enter on a messy board)
  //
  // Algorithm:
  //   - Sort items by height desc → each row's tallest item sets the row
  //     height; later rows can pack shorter items underneath without the
  //     ragged-row gaps the old reading-order sort produced.
  //   - Tight 8 px GAP (was 12 px) so the canvas reads as one cohesive grid
  //     rather than a loose collage.
  //   - Row width target ≈ sqrt(total area × 1.6) for a roughly landscape
  //     aspect ratio (was × 2 → too tall when many items).
  //   - Wraps when adding the next item would push the row past the target.
  autoPackSelection: () =>
    set((s) => {
      const selectionIds = s.selectedItemIds.length > 1
        ? s.selectedItemIds
        : (s.selectedItemId ? [s.selectedItemId] : []);
      const targetIds = selectionIds.length >= 2
        ? selectionIds
        : s.items.map((i) => i.id);
      if (targetIds.length < 2) return s;
      const idSet = new Set(targetIds);
      const targets = s.items.filter((i) => idSet.has(i.id));
      if (targets.length < 2) return s;

      // Sort by height descending → tightest shelf-pack. Ties broken by
      // width desc so similar-height items group consistently.
      const sorted = [...targets].sort((a, b) => {
        const hd = (b.height || 200) - (a.height || 200);
        if (hd !== 0) return hd;
        return (b.width || 200) - (a.width || 200);
      });

      const anchorX = Math.min(...targets.map((it) => it.x));
      const anchorY = Math.min(...targets.map((it) => it.y));
      const GAP = 8;
      const totalArea = sorted.reduce(
        (sum, it) => sum + ((it.width || 200) + GAP) * ((it.height || 200) + GAP),
        0
      );
      // Aim for a roughly landscape grid (1.6:1). Floor at 600 so a tiny
      // selection still gets a usable row width.
      const targetRowW = Math.max(600, Math.sqrt(totalArea * 1.6));

      let x = anchorX;
      let y = anchorY;
      let rowH = 0;
      const updates = new Map<string, { x: number; y: number }>();
      for (const it of sorted) {
        const w = it.width || 200;
        const h = it.height || 200;
        // Wrap if this item would overflow the target row width
        if (x > anchorX && (x - anchorX) + w > targetRowW) {
          x = anchorX;
          y += rowH + GAP;
          rowH = 0;
        }
        updates.set(it.id, { x, y });
        x += w + GAP;
        if (h > rowH) rowH = h;
      }
      return {
        items: s.items.map((it) => {
          const u = updates.get(it.id);
          return u ? { ...it, x: u.x, y: u.y } : it;
        }),
      };
    }),

  moveSelectedItems: (dx, dy) =>
    set((s) => {
      const ids = s.selectedItemIds.length > 0
        ? s.selectedItemIds
        : (s.selectedItemId ? [s.selectedItemId] : []);
      if (ids.length === 0) return s;
      const idSet = new Set(ids);
      return {
        items: s.items.map((it) =>
          idSet.has(it.id) ? { ...it, x: it.x + dx, y: it.y + dy } : it
        ),
      };
    }),

  groupSelectedItems: () =>
    set((s) => {
      const ids = s.selectedItemIds.length > 0
        ? s.selectedItemIds
        : (s.selectedItemId ? [s.selectedItemId] : []);
      if (ids.length < 2) return s;
      const idSet = new Set(ids);
      // Mint a new groupId every time so re-grouping after edits doesn't
      // accidentally share state with an earlier group of the same items.
      const groupId = `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      // Push undo so users can roll back a misclick on Ctrl+G
      const newUndoStack = [...s.undoStack.slice(-49), s.items];
      return {
        undoStack: newUndoStack,
        redoStack: [],
        items: s.items.map((it) => (idSet.has(it.id) ? { ...it, groupId } : it)),
      };
    }),

  ungroupSelectedItems: () =>
    set((s) => {
      const ids = s.selectedItemIds.length > 0
        ? s.selectedItemIds
        : (s.selectedItemId ? [s.selectedItemId] : []);
      if (ids.length === 0) return s;
      const idSet = new Set(ids);
      const newUndoStack = [...s.undoStack.slice(-49), s.items];
      return {
        undoStack: newUndoStack,
        redoStack: [],
        items: s.items.map((it) => {
          if (!idSet.has(it.id) || !it.groupId) return it;
          const next = { ...it };
          delete next.groupId;
          return next;
        }),
      };
    }),
  clearRefs: () => set({ startFrameId: null, endFrameId: null, inputRefs: [], audioInputId: null }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGenerationOptions: (generationOptions) => set({ generationOptions }),
  setGenerationOption: (key, value) => set((s) => ({ generationOptions: { ...s.generationOptions, [key]: value } })),
  setEditMode: (isEditMode) => set({ isEditMode, isCropMode: false }),
  setCropMode: (isCropMode) => set({ isCropMode }),
  updateEditState: (id, edits) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id
          ? { ...i, editState: { ...(i.editState || defaultEditState), ...edits } }
          : i
      ),
    })),
  resetEditState: (id) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, editState: undefined } : i
      ),
    })),
  applyEditState: (id, newSrc) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, src: newSrc, editState: undefined } : i
      ),
    })),
  addBoard: () =>
    set((s) => {
      // Save current board state
      const updatedBoards = s.boards.map((b) =>
        b.id === s.activeBoardId
          ? { ...b, items: s.items, connections: s.connections, panX: s.panX, panY: s.panY, zoom: s.zoom }
          : b
      );
      const newId = `board_${Date.now()}`;
      const newBoard: Board = {
        id: newId,
        name: `Board ${updatedBoards.length + 1}`,
        items: [],
        connections: [],
        panX: 0,
        panY: 0,
        zoom: 1,
      };
      return {
        boards: [...updatedBoards, newBoard],
        activeBoardId: newId,
        items: [],
        connections: [],
        selectedItemId: null,
        panX: 0,
        panY: 0,
        zoom: 1,
        boardName: newBoard.name,
        startFrameId: null,
        endFrameId: null,
        inputRefs: [],
        audioInputId: null,
      };
    }),
  insertImportedBoard: (board) =>
    set((s) => {
      // Persist the currently-active board's live state, then append + switch
      // to the imported one. IDs on the imported board are already unique
      // (minted by importBoardFromFile) so no collision with existing boards.
      const updatedBoards = s.boards.map((b) =>
        b.id === s.activeBoardId
          ? { ...b, items: s.items, connections: s.connections, panX: s.panX, panY: s.panY, zoom: s.zoom }
          : b
      );
      return {
        boards: [...updatedBoards, board],
        activeBoardId: board.id,
        items: board.items,
        connections: board.connections || [],
        selectedItemId: null,
        selectedItemIds: [],
        panX: board.panX || 0,
        panY: board.panY || 0,
        zoom: board.zoom || 1,
        boardName: board.name,
        startFrameId: null,
        endFrameId: null,
        inputRefs: [],
        audioInputId: null,
        undoStack: [],
        redoStack: [],
      };
    }),
  switchBoard: (boardId) =>
    set((s) => {
      if (boardId === s.activeBoardId) return s;
      const updatedBoards = s.boards.map((b) =>
        b.id === s.activeBoardId
          ? { ...b, items: s.items, connections: s.connections, panX: s.panX, panY: s.panY, zoom: s.zoom }
          : b
      );
      const target = updatedBoards.find((b) => b.id === boardId);
      if (!target) return s;
      return {
        boards: updatedBoards,
        activeBoardId: boardId,
        items: target.items,
        connections: target.connections || [],
        selectedItemId: null,
        panX: target.panX,
        panY: target.panY,
        zoom: target.zoom,
        boardName: target.name,
        startFrameId: null,
        endFrameId: null,
        inputRefs: [],
        audioInputId: null,
      };
    }),
  deleteBoard: (boardId) =>
    set((s) => {
      if (s.boards.length <= 1) return s;
      const remaining = s.boards.filter((b) => b.id !== boardId);
      if (boardId === s.activeBoardId) {
        const target = remaining[0];
        return {
          boards: remaining,
          activeBoardId: target.id,
          items: target.items,
          connections: target.connections || [],
          selectedItemId: null,
          panX: target.panX,
          panY: target.panY,
          zoom: target.zoom,
          boardName: target.name,
          startFrameId: null,
          endFrameId: null,
          inputRefs: [],
          audioInputId: null,
        };
      }
      return { boards: remaining };
    }),
  renameBoard: (boardId, name) =>
    set((s) => ({
      boards: s.boards.map((b) => (b.id === boardId ? { ...b, name } : b)),
      boardName: s.activeBoardId === boardId ? name : s.boardName,
    })),
});
});

// Autosave on every state change — fast localStorage + debounced DB
let dbSaveTimeout: ReturnType<typeof setTimeout> | null = null;
let lsSaveTimeout: ReturnType<typeof setTimeout> | null = null;
let dbLoadedOnce = false; // prevent overwriting DB before initial load completes

// --- Single-tab session lock ---
//
// Each tab generates this id once at module load and pings /api/active-tab
// every 5s to claim ownership of the user's session. Non-owner tabs see a
// modal and stop firing autosaves so they can't clobber the owner's state.
// See lib/db.ts heartbeatActiveTab() for the matching server logic.
export const TAB_ID = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const TAB_BROADCAST_CHANNEL = "motionboards_tab";
const TAB_HEARTBEAT_MS = 5000;

// Auto-snapshot: piggybacks on the autosave flow. We try to save a version
// after every DB save, but only actually POST when:
//   1. The content has changed since the previous snapshot (hash dedupe)
//   2. At least 5 minutes have passed since the last snapshot
// Server caps snapshots at 50 per user (trims oldest on insert) and the
// 14-day TTL sweep still runs, so storage stays bounded.
let lastSnapshotAt = 0;
let lastSnapshotHash = "";
// Auto-snapshot cadence — at most one snapshot every 2 hours per browser
// session, gated additionally by a content-hash dedupe so identical state
// never produces a new row. A separate setInterval fires every 2 hours so
// even an idle session gets periodic checkpoints.
const SNAPSHOT_MIN_INTERVAL_MS = 2 * 60 * 60 * 1000;

// Fast non-cryptographic string hash (djb2) — good enough to detect whether
// anything in the serialized board state has changed since last snapshot.
function cheapHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h.toString(36);
}

async function createAutoSnapshot(state: AppState): Promise<void> {
  // Skip if too soon since last snapshot
  const now = Date.now();
  if (now - lastSnapshotAt < SNAPSHOT_MIN_INTERVAL_MS) return;

  // Compute cheap hash of the current boards — skip if nothing changed.
  // We hash the same stripped shape we'd send to the server so the dedupe
  // decision matches the persisted payload.
  const boards = stripSnapshotBoards(state);
  const shape = JSON.stringify({ boards, activeBoardId: state.activeBoardId, selectedModelId: state.selectedModelId });
  const hash = cheapHash(shape);
  if (hash === lastSnapshotHash) return;

  const result = await saveBoardSnapshotWithLabel(state);
  if (result.ok) {
    lastSnapshotAt = now;
    lastSnapshotHash = hash;
  }
}

// Strip transient/oversized fields that don't need to live in a snapshot.
function stripSnapshotBoards(state: AppState): ReturnType<typeof getCurrentBoards> {
  return getCurrentBoards(state).map((b) => ({
    ...b,
    items: b.items.map((item) => {
      const src = item.src || "";
      if (src.startsWith("data:") || src.startsWith("blob:")) return { ...item, src: "" };
      return item;
    }),
  }));
}

// Exported so the Profile panel can trigger a manual checkpoint without
// having to wrangle the store's getCurrentBoards helper itself. Manual
// checkpoints bypass the hash + interval dedupe (user explicitly asked).
export async function saveBoardSnapshotWithLabel(
  state: AppState,
  label?: string
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "No window" };
  try {
    const boards = stripSnapshotBoards(state);
    const payload = {
      boards,
      activeBoardId: state.activeBoardId,
      selectedModelId: state.selectedModelId,
      savedAt: Date.now(),
    };
    const json = JSON.stringify({ data: payload, ...(label ? { label } : {}) });

    // gzip the body client-side so big canvases (multi-MB JSON) fit under
    // Vercel's 4.5MB request limit. JSON typically compresses ~85%.
    let bodyInit: BodyInit = json;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (typeof CompressionStream !== "undefined") {
      const encoded = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
      const buffer = await new Response(encoded).arrayBuffer();
      bodyInit = buffer;
      headers["Content-Encoding"] = "gzip";
    }
    const res = await fetch("/api/board-versions", {
      method: "POST",
      headers,
      body: bodyInit,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err?.error || `HTTP ${res.status}` };
    }
    // Update the dedupe state so the next auto-snapshot doesn't immediately
    // save the same content again.
    lastSnapshotAt = Date.now();
    lastSnapshotHash = cheapHash(JSON.stringify({ boards, activeBoardId: state.activeBoardId, selectedModelId: state.selectedModelId }));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

useAppStore.subscribe((state) => {
  // localStorage: short debounce (300ms) — fast enough to survive most refreshes
  if (lsSaveTimeout) clearTimeout(lsSaveTimeout);
  lsSaveTimeout = setTimeout(() => saveToLocalStorage(state), 300);

  // DB: longer debounce (2s), only after initial DB load completes.
  // Version snapshot tries to piggyback on this; it's deduped by content
  // hash and a 2-hour minimum interval so it only persists meaningful
  // changes (see createAutoSnapshot).
  //
  // Three guards:
  //   - dbLoadedOnce      — wait until initial DB load finishes, otherwise
  //                         we'd race-write before reading.
  //   - !multiTabLockout  — another /generate tab owns the session; their
  //                         state is canonical, ours would clobber.
  //   - canvasMounted     — only the canvas page actually edits boards.
  //                         A media-library tab toggling theme shouldn't
  //                         POST stale boards back to the DB — that was
  //                         a real path that overwrote canvas edits made
  //                         by a sibling /generate tab.
  if (dbLoadedOnce && !state.multiTabLockout && state.canvasMounted) {
    if (dbSaveTimeout) clearTimeout(dbSaveTimeout);
    dbSaveTimeout = setTimeout(() => {
      saveToDb(state);
      createAutoSnapshot(state);
    }, 2000);
  }
});

// Heartbeat: even if the user doesn't make any changes, fire a snapshot
// attempt every 2 hours. createAutoSnapshot's hash dedupe will skip if the
// content hasn't changed, so this is cheap when idle but ensures long
// editing sessions still produce regular checkpoints.
if (typeof window !== "undefined") {
  setInterval(() => {
    if (!dbLoadedOnce) return;
    createAutoSnapshot(useAppStore.getState());
  }, 2 * 60 * 60 * 1000);
}

// Restore unfinalized image sources from IndexedDB into items with empty src.
// Runs after state loads (from localStorage and/or DB) to rehydrate pasted/dropped
// images that hadn't finished uploading to the CDN at the time of the last save.
async function restoreFromImageCache() {
  if (typeof window === "undefined") return;
  try {
    const keys = await imgCacheKeys();
    if (keys.length === 0) return;
    const state = useAppStore.getState();

    // Find items with empty src across all boards, keyed by id
    const needsRestore = new Set<string>();
    for (const b of state.boards) {
      for (const item of b.items) {
        if (!item.src && keys.includes(item.id)) needsRestore.add(item.id);
      }
    }
    for (const item of state.items) {
      if (!item.src && keys.includes(item.id)) needsRestore.add(item.id);
    }

    for (const id of needsRestore) {
      const cached = await imgCacheGet(id);
      if (!cached) continue;
      const src = typeof cached === "string" ? cached : URL.createObjectURL(cached);
      useAppStore.setState((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, src } : i)),
        boards: s.boards.map((b) => ({
          ...b,
          items: b.items.map((i) => (i.id === id ? { ...i, src } : i)),
        })),
      }));
    }

    // GC: delete IDB entries whose items no longer exist in any board
    const allItemIds = new Set<string>();
    const freshState = useAppStore.getState();
    for (const b of freshState.boards) for (const item of b.items) allItemIds.add(item.id);
    for (const item of freshState.items) allItemIds.add(item.id);
    for (const k of keys) {
      if (!allItemIds.has(k)) imgCacheDelete(k).catch(() => {});
    }
  } catch {
    // noop
  }
}

// Flush pending saves on page close / refresh
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (lsSaveTimeout) clearTimeout(lsSaveTimeout);
    if (dbSaveTimeout) clearTimeout(dbSaveTimeout);
    const state = useAppStore.getState();
    saveToLocalStorage(state);
    // Warn the user if a generation is still running. Modern browsers show a
    // generic dialog ("Leave site?") — custom messages are ignored for
    // anti-phishing reasons. Setting returnValue is what actually triggers it.
    const hasInFlightGeneration = state.items.some((i) => i.status === "processing");
    if (hasInFlightGeneration) {
      e.preventDefault();
      e.returnValue = "A generation is still running. Leaving may interrupt it.";
    }
    // Skip the DB sync if (a) another tab owns the lock — its state is
    // canonical and ours would just clobber it, OR (b) the canvas page is
    // not currently mounted — non-canvas tabs (media, dashboard, etc.)
    // hold a snapshot from initial load and shouldn't echo it back to DB
    // on close. LS save still ran above so local progress isn't lost.
    if (!state.multiTabLockout && state.canvasMounted) {
      // Try to save to DB via sendBeacon (works during page unload).
      // Strip data:/blob: URIs the same way saveToDb does — sendBeacon can't set
      // Content-Encoding for gzip, so the body must be small enough to fit
      // Vercel's 4.5 MB cap on its own. Without this, a board with even one
      // pasted data: image silently failed to flush on close and the next
      // session loaded yesterday's pre-paste state.
      const boards = getCurrentBoards(state).map((b) => ({
        ...b,
        items: b.items.map((item) => ({
          ...item,
          src: stripUnfinalized(item.src),
          outputUrl: stripUnfinalized(item.outputUrl),
        })),
      }));
      const beaconJson = JSON.stringify({
        boards,
        activeBoardId: state.activeBoardId,
        selectedModelId: state.selectedModelId,
        savedAt: Date.now(),
        tabId: TAB_ID,
      });
      // Last-resort guard: if the stripped body is still > 4 MB, sendBeacon
      // would 413 silently. Skip rather than producing the same data loss the
      // beacon was supposed to prevent. The 2s debounced saveToDb running just
      // before this almost always covers the same content via gzip.
      if (beaconJson.length <= 4 * 1024 * 1024) {
        const blob = new Blob([beaconJson], { type: "application/json" });
        navigator.sendBeacon("/api/boards", blob);
      }
    }

    // Release the tab lock so a sibling tab can take over immediately
    // instead of waiting out the 30s TTL. Beacons survive page unload.
    try {
      const releaseBlob = new Blob(
        [JSON.stringify({ tabId: TAB_ID, action: "release" })],
        { type: "application/json" }
      );
      navigator.sendBeacon("/api/active-tab", releaseBlob);
    } catch {}

    // Same-browser tabs find out instantly via BroadcastChannel — no need to
    // wait for the next 5s server heartbeat to clear the modal.
    try {
      const ch = new BroadcastChannel(TAB_BROADCAST_CHANNEL);
      ch.postMessage({ type: "bye", tabId: TAB_ID });
      ch.close();
    } catch {}
  });
}

// Restore from IDB as soon as the store is hydrated from localStorage
if (typeof window !== "undefined") {
  restoreFromImageCache();
}

// Load from DB on startup — keyed by user session
if (typeof window !== "undefined") {
  fetch("/api/auth/me")
    .then((r) => r.json())
    .then((authData) => {
      const userId = authData?.user?.id;
      if (!userId) { dbLoadedOnce = true; return; }

      // Check if localStorage belongs to this user. If not, this is a fresh
      // device / browser / account-switch — wipe local state so we don't
      // preserve someone else's boards.
      const storedUser = localStorage.getItem("motionboards_user");
      const isFreshDevice = storedUser !== userId;
      if (isFreshDevice) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem("motionboards_user", userId);
        useAppStore.setState({
          boards: [{ id: "board_1", name: "Board 1", items: [], connections: [], panX: 0, panY: 0, zoom: 1 }],
          activeBoardId: "board_1",
          items: [],
          panX: 0, panY: 0, zoom: 1,
          boardName: "Board 1",
          selectedModelId: null,
        });
      }

      // The single-tab heartbeat used to start here, but the lock only
      // applies to the canvas page (`/generate`). Other pages don't write
      // boards, so multi-tab there is harmless. The canvas itself starts
      // the heartbeat on mount via startTabHeartbeat() — see canvas.tsx.

      // Load from DB
      return fetch("/api/boards")
        .then((r) => r.json())
        .then((data) => {
          if (data?.boards?.length > 0) {
            // CRITICAL: use the timestamp captured at module init, NOT a fresh
            // localStorage read. By the time this DB fetch resolves, the store
            // subscriber has likely rewritten LS with a `savedAt = Date.now()`
            // — even though no real content change happened — and re-reading
            // here would make local always look newer than DB. The captured
            // value reflects the *last actual content save* before this page
            // load began.
            const localSavedAt = initialLoadedSavedAt;
            const dbSavedAt = data.savedAt || 0;
            const dbItemCount = (data.boards || []).reduce(
              (sum: number, b: Board) => sum + (Array.isArray(b.items) ? b.items.length : 0),
              0
            );

            // Trust the timestamp comparison, but add a defensive tiebreaker:
            // if DB has materially more items than local AND the DB save is
            // recent (within 7 days), prefer DB. This catches the edge case
            // where a different tab/device flushed bigger state to the DB
            // while this browser was idle, and the local LS is stale.
            const dbHasMoreItems = dbItemCount > initialLoadedItemCount && dbItemCount > 0;
            const dbIsRecent = dbSavedAt > 0 && Date.now() - dbSavedAt < 7 * 24 * 60 * 60 * 1000;
            const dbWinsByItemCount = dbHasMoreItems && dbIsRecent;

            if (
              !isFreshDevice &&
              localSavedAt > dbSavedAt &&
              !dbWinsByItemCount &&
              initialLoadedState?.boards?.length
            ) {
              dbLoadedOnce = true;
              // Catch-up write: push genuinely-newer local state to DB.
              // Two gates:
              //   - !multiTabLockout: another /generate tab owns the slot.
              //     Their state is canonical, ours would clobber.
              //   - canvasMounted: only the canvas page is allowed to write
              //     /api/boards. A media-library tab loaded with old LS
              //     should never overwrite a sibling /generate tab's state.
              //     If canvas mounts later, the next state change will
              //     trigger the regular debounced saveToDb anyway.
              const s = useAppStore.getState();
              if (!s.multiTabLockout && s.canvasMounted) {
                saveToDb(s);
              }
              return;
            }

            const board = data.boards.find((b: Board) => b.id === data.activeBoardId) || data.boards[0];
            useAppStore.setState({
              boards: data.boards,
              activeBoardId: data.activeBoardId || data.boards[0].id,
              items: board.items || [],
              connections: board.connections || [],
              panX: board.panX || 0,
              panY: board.panY || 0,
              zoom: board.zoom || 1,
              boardName: board.name || "Board 1",
              selectedModelId: data.selectedModelId || null,
            });
            // Items loaded from DB may still have empty src if they were unfinalized
            // on their last save. Re-run the IDB restore against the new items.
            restoreFromImageCache();
          }
          dbLoadedOnce = true;
        });
    })
    .catch(() => { dbLoadedOnce = true; });
}

// --- Tab heartbeat / lockout machinery ---

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let broadcastChannel: BroadcastChannel | null = null;

async function pingHeartbeat(action: "heartbeat" | "claim" = "heartbeat"): Promise<void> {
  try {
    const res = await fetch("/api/active-tab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabId: TAB_ID, action }),
      // Don't let cached response masquerade as a fresh check
      cache: "no-store",
    });
    if (!res.ok) return;
    const data: { ownerTabId: string | null; ownerSeenAt: number; isYou: boolean } = await res.json();
    const current = useAppStore.getState().multiTabLockout;
    if (data.isYou) {
      // We own the slot — clear any prior lockout (e.g., other tab closed).
      if (current) useAppStore.setState({ multiTabLockout: null });
    } else if (data.ownerTabId && data.ownerTabId !== TAB_ID) {
      // Someone else owns it. Lock down this tab.
      useAppStore.setState({
        multiTabLockout: {
          ownerTabId: data.ownerTabId,
          ownerSeenAt: data.ownerSeenAt,
          detectedAt: Date.now(),
        },
      });
    }
  } catch {
    // Network error — keep the previous state. Better to over-trust the
    // current lockout decision than to ping/pong on flaky connections.
  }
}

export function startTabHeartbeat(): Promise<void> {
  if (heartbeatTimer) return Promise.resolve(); // already running
  // Same-browser detection via BroadcastChannel — instant, no server round-trip.
  // Catches the common case of "user opened the same site in a second tab".
  // Cross-device cases still rely on the 5s /api/active-tab poll below.
  if (typeof BroadcastChannel !== "undefined") {
    try {
      broadcastChannel = new BroadcastChannel(TAB_BROADCAST_CHANNEL);
      broadcastChannel.postMessage({ type: "hello", tabId: TAB_ID });
      broadcastChannel.addEventListener("message", (e) => {
        const msg = e.data as { type?: string; tabId?: string } | null;
        if (!msg || !msg.tabId || msg.tabId === TAB_ID) return;
        if (msg.type === "hello" || msg.type === "heartbeat") {
          // Another tab said hi. The one who claimed the server slot first
          // wins; the other will see ownership mismatch on the next ping
          // and lock itself down. We just nudge our own ping to happen
          // immediately rather than waiting up to 5s for confirmation.
          pingHeartbeat();
        } else if (msg.type === "bye") {
          // Other tab closed cleanly — re-check ownership so the modal
          // (if any) clears as soon as the slot is reclaimable.
          pingHeartbeat();
        }
      });
    } catch {
      broadcastChannel = null;
    }
  }

  // First ping returns its promise — caller awaits it before kicking off any
  // path that might write to the DB, so non-owner tabs get their lockout
  // flag set before they have a chance to clobber the owner's state.
  const first = pingHeartbeat();
  heartbeatTimer = setInterval(() => {
    pingHeartbeat();
  }, TAB_HEARTBEAT_MS);
  return first;
}

// Stop heartbeating + release the lock. Called when the canvas page
// unmounts (user navigated to /media, /dashboard, etc.) so a sibling
// tab on /generate can take over immediately instead of waiting out the
// 30s server-side TTL. Also clears any lockout state since the modal
// belongs to the canvas alone.
export function stopTabHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (broadcastChannel) {
    try { broadcastChannel.postMessage({ type: "bye", tabId: TAB_ID }); } catch {}
    try { broadcastChannel.close(); } catch {}
    broadcastChannel = null;
  }
  // Best-effort release. fetch() rather than sendBeacon() — we're not in
  // a page-unload context so the browser won't have any reason to drop it.
  fetch("/api/active-tab", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tabId: TAB_ID, action: "release" }),
    keepalive: true,
  }).catch(() => {});
  // Reset state. If the user comes back to the canvas, startTabHeartbeat
  // re-claims (or surfaces the modal) on first ping.
  useAppStore.setState({ multiTabLockout: null });
}

// Force-claim the slot from another tab. Surfaces as the "Take over here"
// button on the multi-tab modal. After a successful claim, the previous
// owner sees the mismatch on its next 5s heartbeat and shows the same modal.
export async function takeOverTabLock(): Promise<boolean> {
  useAppStore.setState({ takeoverInProgress: true });
  try {
    const res = await fetch("/api/active-tab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabId: TAB_ID, action: "claim" }),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data: { ownerTabId: string | null; isYou: boolean } = await res.json();
    if (data.isYou) {
      useAppStore.setState({ multiTabLockout: null });
      // Pull whatever the other tab last saved, then resume autosaves.
      try {
        const boardsRes = await fetch("/api/boards", { cache: "no-store" });
        if (boardsRes.ok) {
          const data2 = await boardsRes.json();
          if (data2?.boards?.length > 0) {
            // Stay on whichever board the user is currently viewing in this
            // tab. Without this we would jump to whatever board the OTHER
            // tab was active on (data2.activeBoardId is the server's record
            // of the previous owner's view), which is jarring - the user
            // hit "Take over here" expecting to keep working where they
            // were, not to be teleported.
            const localActiveId = useAppStore.getState().activeBoardId;
            const localStillExists =
              localActiveId && data2.boards.some((b: Board) => b.id === localActiveId);
            const targetBoardId =
              (localStillExists ? localActiveId : null) ||
              data2.activeBoardId ||
              data2.boards[0].id;
            const board =
              data2.boards.find((b: Board) => b.id === targetBoardId) || data2.boards[0];
            useAppStore.setState({
              boards: data2.boards,
              activeBoardId: targetBoardId,
              items: board.items || [],
              connections: board.connections || [],
              panX: board.panX || 0,
              panY: board.panY || 0,
              zoom: board.zoom || 1,
              boardName: board.name || "Board 1",
              selectedModelId: data2.selectedModelId || null,
            });
          }
        }
      } catch {}
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    useAppStore.setState({ takeoverInProgress: false });
  }
}
