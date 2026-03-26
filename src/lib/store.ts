"use client";

import { create } from "zustand";

// --- LocalStorage autosave ---
const STORAGE_KEY = "motionboards_state";

interface SavedState {
  boards: Board[];
  activeBoardId: string;
  selectedModelId: string | null;
}

function loadSavedState(): Partial<SavedState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    // Save current board items into boards array
    const boards = state.boards.map((b) =>
      b.id === state.activeBoardId
        ? { ...b, items: state.items, connections: state.connections, panX: state.panX, panY: state.panY, zoom: state.zoom, name: state.boardName }
        : b
    );
    const data: SavedState = {
      boards,
      activeBoardId: state.activeBoardId,
      selectedModelId: state.selectedModelId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable
  }
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

export interface TimelineClip {
  id: string;
  itemId: string; // references BoardItem.id
  trimStart: number; // seconds
  trimEnd: number; // seconds (0 = full duration)
  duration: number; // total duration of source
}

export interface AppState {
  // Boards
  boards: Board[];
  activeBoardId: string;

  // Canvas (derived from active board)
  items: BoardItem[];
  selectedItemId: string | null;
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

  // Generation
  isGenerating: boolean;

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

  // Timeline
  isTimelineOpen: boolean;
  timelineClips: TimelineClip[];

  // Undo/Redo
  undoStack: BoardItem[][];
  redoStack: BoardItem[][];

  // Actions
  addItem: (item: BoardItem) => void;
  updateItem: (id: string, updates: Partial<BoardItem>) => void;
  removeItem: (id: string) => void;
  selectItem: (id: string | null) => void;
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
  clearRefs: () => void;
  setIsGenerating: (v: boolean) => void;
  setEditMode: (v: boolean) => void;
  setCropMode: (v: boolean) => void;
  updateEditState: (id: string, edits: Partial<ImageEditState>) => void;
  resetEditState: (id: string) => void;
  applyEditState: (id: string, newSrc: string) => void;
  addBoard: () => void;
  switchBoard: (boardId: string) => void;
  deleteBoard: (boardId: string) => void;
  renameBoard: (boardId: string, name: string) => void;
  setActiveCanvasTool: (tool: "select" | "text" | "draw" | "connect" | null) => void;
  setDrawingColor: (color: string) => void;
  setDrawingStrokeWidth: (width: number) => void;
  addConnection: (fromId: string, toId: string) => void;
  removeConnection: (id: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  setConnectingFromId: (id: string | null) => void;
  setTimelineOpen: (open: boolean) => void;
  addTimelineClip: (clip: TimelineClip) => void;
  removeTimelineClip: (id: string) => void;
  reorderTimelineClips: (clips: TimelineClip[]) => void;
  updateTimelineClip: (id: string, updates: Partial<TimelineClip>) => void;
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
  panX: startBoard.panX || 0,
  panY: startBoard.panY || 0,
  zoom: startBoard.zoom || 1,
  boardName: startBoard.name || "Board 1",
  selectedModelId: saved?.selectedModelId || "fal-ai/nano-banana/v2",
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
  isGenerating: false,
  isEditMode: false,
  isCropMode: false,
  activeCanvasTool: null,
  drawingColor: "#000000",
  drawingStrokeWidth: 3,
  connections: startBoard.connections || [],
  theme: (typeof window !== "undefined" && localStorage.getItem("motionboards_theme") as "light" | "dark") || "light",
  connectingFromId: null,
  isTimelineOpen: false,
  timelineClips: [],
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
  setConnectingFromId: (connectingFromId) => set({ connectingFromId }),
  setTimelineOpen: (isTimelineOpen) => set({ isTimelineOpen }),
  addTimelineClip: (clip) => set((s) => ({
    timelineClips: [...s.timelineClips, clip],
  })),
  removeTimelineClip: (id) => set((s) => ({
    timelineClips: s.timelineClips.filter((c) => c.id !== id),
  })),
  reorderTimelineClips: (timelineClips) => set({ timelineClips }),
  updateTimelineClip: (id, updates) => set((s) => ({
    timelineClips: s.timelineClips.map((c) => c.id === id ? { ...c, ...updates } : c),
  })),

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
    })),
  selectItem: (id) => set({ selectedItemId: id }),
  moveItem: (id, x, y) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, x, y } : i)),
    })),
  setPan: (panX, panY) => set({ panX, panY }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),
  setBoardName: (boardName) => set({ boardName }),
  setSelectedModel: (selectedModelId) => set({ selectedModelId }),
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
  clearRefs: () => set({ startFrameId: null, endFrameId: null, inputRefs: [] }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
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
      };
    }),
  switchBoard: (boardId) =>
    set((s) => {
      if (boardId === s.activeBoardId) return s;
      // Save current board
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

// Autosave on every state change (debounced) — localStorage + DB
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
useAppStore.subscribe((state) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveState(state); // localStorage
    // Also save to DB
    const boards = state.boards.map((b) =>
      b.id === state.activeBoardId
        ? { ...b, items: state.items, connections: state.connections, panX: state.panX, panY: state.panY, zoom: state.zoom, name: state.boardName }
        : b
    );
    fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boards, activeBoardId: state.activeBoardId, selectedModelId: state.selectedModelId }),
    }).catch(() => {}); // silent fail
  }, 2000); // 2s debounce for DB saves
});

// Load from DB on startup — keyed by user session
if (typeof window !== "undefined") {
  fetch("/api/auth/me")
    .then((r) => r.json())
    .then((authData) => {
      const userId = authData?.user?.id;
      if (!userId) return;

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
          }
        });
    })
    .catch(() => {});
}
