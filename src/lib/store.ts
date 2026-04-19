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

function saveToDb(state: AppState) {
  const boards = getCurrentBoards(state).map((b) => ({
    ...b,
    items: b.items.map((item) => {
      const src = item.src || "";
      if (src.startsWith("data:")) return { ...item, src: "" };
      return item;
    }),
  }));
  fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      boards,
      activeBoardId: state.activeBoardId,
      selectedModelId: state.selectedModelId,
      savedAt: Date.now(),
    }),
  }).catch(() => {});
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
  setStartFrame: (id: string | null) => void;
  setEndFrame: (id: string | null) => void;
  toggleInputRef: (id: string) => void;
  setAudioInput: (id: string | null) => void;
  clearRefs: () => void;
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
  setDrawingColor: (color: string) => void;
  setDrawingStrokeWidth: (width: number) => void;
  addConnection: (fromId: string, toId: string) => void;
  removeConnection: (id: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  setAutoConnectGenerations: (v: boolean) => void;
  restoreBoardsSnapshot: (snapshot: unknown) => void;
  setConnectingFromId: (id: string | null) => void;
  setFoldersOpen: (open: boolean) => void;
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
  // Load saved state
  const saved = loadSavedState();
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
  pendingPrompt: null,
  startFrameId: null,
  endFrameId: null,
  inputRefs: [],
  audioInputId: null,
  isGenerating: false,
  generationOptions: {},
  isEditMode: false,
  isCropMode: false,
  activeCanvasTool: null,
  drawingColor: "#000000",
  drawingStrokeWidth: 3,
  connections: startBoard.connections || [],
  theme: (typeof window !== "undefined" && localStorage.getItem("motionboards_theme") as "light" | "dark") || "light",
  autoConnectGenerations: typeof window !== "undefined" ? localStorage.getItem("motionboards_autoconnect") !== "false" : true,
  connectingFromId: null,
  isFoldersOpen: false,
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
  selectItem: (id) => set({ selectedItemId: id, selectedItemIds: id ? [id] : [] }),
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
  setStartFrame: (startFrameId) => set({ startFrameId }),
  setEndFrame: (endFrameId) => set({ endFrameId }),
  toggleInputRef: (id) =>
    set((s) => ({
      inputRefs: s.inputRefs.includes(id)
        ? s.inputRefs.filter((r) => r !== id)
        : [...s.inputRefs, id],
    })),
  setAudioInput: (id) => set({ audioInputId: id }),
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

// Auto-snapshot: piggybacks on the autosave flow. We try to save a version
// after every DB save, but only actually POST when:
//   1. The content has changed since the previous snapshot (hash dedupe)
//   2. At least 5 minutes have passed since the last snapshot
// Server caps snapshots at 50 per user (trims oldest on insert) and the
// 14-day TTL sweep still runs, so storage stays bounded.
let lastSnapshotAt = 0;
let lastSnapshotHash = "";
const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000;

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
  // hash and a 5-minute minimum interval so it only persists meaningful
  // changes (see createAutoSnapshot).
  if (dbLoadedOnce) {
    if (dbSaveTimeout) clearTimeout(dbSaveTimeout);
    dbSaveTimeout = setTimeout(() => {
      saveToDb(state);
      createAutoSnapshot(state);
    }, 2000);
  }
});

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
  window.addEventListener("beforeunload", () => {
    if (lsSaveTimeout) clearTimeout(lsSaveTimeout);
    if (dbSaveTimeout) clearTimeout(dbSaveTimeout);
    const state = useAppStore.getState();
    saveToLocalStorage(state);
    // Try to save to DB via sendBeacon (works during page unload)
    const boards = getCurrentBoards(state);
    const blob = new Blob(
      [JSON.stringify({ boards, activeBoardId: state.activeBoardId, selectedModelId: state.selectedModelId, savedAt: Date.now() })],
      { type: "application/json" }
    );
    navigator.sendBeacon("/api/boards", blob);
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

      // Check if localStorage belongs to this user
      const storedUser = localStorage.getItem("motionboards_user");
      if (storedUser !== userId) {
        // Different user — clear localStorage and reset store
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

      // Load from DB
      return fetch("/api/boards")
        .then((r) => r.json())
        .then((data) => {
          if (data?.boards?.length > 0) {
            const localState = loadSavedState();
            const localSavedAt = localState?.savedAt || 0;
            const dbSavedAt = data.savedAt || 0;

            // If localStorage has newer data for this user, keep it and sync to DB
            if (localSavedAt > dbSavedAt && localState?.boards?.length) {
              dbLoadedOnce = true;
              saveToDb(useAppStore.getState());
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
