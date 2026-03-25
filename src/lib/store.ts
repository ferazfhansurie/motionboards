"use client";

import { create } from "zustand";

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
  type: "image" | "video" | "audio" | "generation" | "psd-layer";
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
}

export interface Board {
  id: string;
  name: string;
  items: BoardItem[];
  panX: number;
  panY: number;
  zoom: number;
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

  // References
  startFrameId: string | null;
  endFrameId: string | null;
  inputRefs: string[]; // item IDs selected as INPUT

  // Generation
  isGenerating: boolean;

  // Edit mode
  isEditMode: boolean;
  isCropMode: boolean;

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
}

const initialBoard: Board = {
  id: "board_1",
  name: "Board 1",
  items: [],
  panX: 0,
  panY: 0,
  zoom: 1,
};

export const useAppStore = create<AppState>((set) => ({
  boards: [initialBoard],
  activeBoardId: "board_1",
  items: [],
  selectedItemId: null,
  panX: 0,
  panY: 0,
  zoom: 1,
  boardName: "Board 1",
  selectedModelId: null,
  isModelPanelOpen: false,
  isTemplatesOpen: false,
  isDashboardOpen: false,
  isProfileOpen: false,
  isHistoryOpen: false,
  pendingPrompt: null,
  startFrameId: null,
  endFrameId: null,
  inputRefs: [],
  isGenerating: false,
  isEditMode: false,
  isCropMode: false,

  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  updateItem: (id, updates) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    })),
  removeItem: (id) =>
    set((s) => ({
      items: s.items.filter((i) => i.id !== id),
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
          ? { ...b, items: s.items, panX: s.panX, panY: s.panY, zoom: s.zoom }
          : b
      );
      const newId = `board_${Date.now()}`;
      const newBoard: Board = {
        id: newId,
        name: `Board ${updatedBoards.length + 1}`,
        items: [],
        panX: 0,
        panY: 0,
        zoom: 1,
      };
      return {
        boards: [...updatedBoards, newBoard],
        activeBoardId: newId,
        items: [],
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
          ? { ...b, items: s.items, panX: s.panX, panY: s.panY, zoom: s.zoom }
          : b
      );
      const target = updatedBoards.find((b) => b.id === boardId);
      if (!target) return s;
      return {
        boards: updatedBoards,
        activeBoardId: boardId,
        items: target.items,
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
}));
