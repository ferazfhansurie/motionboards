// In-app UI primitives: toasts, folder picker, confirm, and prompt dialogs.
//
// Replaces window.alert/confirm/prompt so interactions stay inside the app
// chrome (stylable, themable, non-blocking). Exposes promise-based helpers so
// call sites read the same way native dialogs did.

import { create } from "zustand";

export type ToastKind = "info" | "success" | "error" | "loading";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

type FolderPickerResolver = (folderId: string | null) => void;
type ConfirmResolver = (ok: boolean) => void;
type PromptResolver = (value: string | null) => void;
export interface SharePayload {
  title: string;
  body: string;
  category: "General" | "Showcase" | "Help" | "Wins" | "Feedback";
}
type ShareResolver = (payload: SharePayload | null) => void;

interface UIState {
  toasts: Toast[];
  pushToast: (t: Toast) => void;
  patchToast: (id: string, patch: Partial<Omit<Toast, "id">>) => void;
  dismissToast: (id: string) => void;

  folderPicker: { open: boolean; resolve: FolderPickerResolver | null };
  openFolderPicker: (resolve: FolderPickerResolver) => void;
  closeFolderPicker: (folderId: string | null) => void;

  confirm: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    danger: boolean;
    resolve: ConfirmResolver | null;
  };
  openConfirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    resolve: ConfirmResolver;
  }) => void;
  closeConfirm: (ok: boolean) => void;

  prompt: {
    open: boolean;
    title: string;
    description: string;
    placeholder: string;
    defaultValue: string;
    multiline: boolean;
    confirmLabel: string;
    resolve: PromptResolver | null;
  };
  openPrompt: (opts: {
    title: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    multiline?: boolean;
    confirmLabel?: string;
    resolve: PromptResolver;
  }) => void;
  closePrompt: (value: string | null) => void;

  share: {
    open: boolean;
    mediaType: "image" | "video";
    defaultTitle: string;
    defaultBody: string;
    resolve: ShareResolver | null;
  };
  openShare: (opts: {
    mediaType: "image" | "video";
    defaultTitle?: string;
    defaultBody?: string;
    resolve: ShareResolver;
  }) => void;
  closeShare: (payload: SharePayload | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts, t] })),
  patchToast: (id, patch) =>
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  folderPicker: { open: false, resolve: null },
  openFolderPicker: (resolve) => {
    // If a picker is already open, cancel it first so we don't lose the earlier
    // caller's promise.
    const prev = get().folderPicker.resolve;
    if (prev) prev(null);
    set({ folderPicker: { open: true, resolve } });
  },
  closeFolderPicker: (folderId) => {
    const r = get().folderPicker.resolve;
    if (r) r(folderId);
    set({ folderPicker: { open: false, resolve: null } });
  },

  confirm: {
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    danger: false,
    resolve: null,
  },
  openConfirm: ({ title, message, confirmLabel, cancelLabel, danger, resolve }) => {
    const prev = get().confirm.resolve;
    if (prev) prev(false);
    set({
      confirm: {
        open: true,
        title,
        message,
        confirmLabel: confirmLabel || "Confirm",
        cancelLabel: cancelLabel || "Cancel",
        danger: !!danger,
        resolve,
      },
    });
  },
  closeConfirm: (ok) => {
    const r = get().confirm.resolve;
    if (r) r(ok);
    set((s) => ({ confirm: { ...s.confirm, open: false, resolve: null } }));
  },

  prompt: {
    open: false,
    title: "",
    description: "",
    placeholder: "",
    defaultValue: "",
    multiline: false,
    confirmLabel: "OK",
    resolve: null,
  },
  openPrompt: ({ title, description, placeholder, defaultValue, multiline, confirmLabel, resolve }) => {
    const prev = get().prompt.resolve;
    if (prev) prev(null);
    set({
      prompt: {
        open: true,
        title,
        description: description || "",
        placeholder: placeholder || "",
        defaultValue: defaultValue || "",
        multiline: !!multiline,
        confirmLabel: confirmLabel || "OK",
        resolve,
      },
    });
  },
  closePrompt: (value) => {
    const r = get().prompt.resolve;
    if (r) r(value);
    set((s) => ({ prompt: { ...s.prompt, open: false, resolve: null } }));
  },

  share: {
    open: false,
    mediaType: "image",
    defaultTitle: "",
    defaultBody: "",
    resolve: null,
  },
  openShare: ({ mediaType, defaultTitle, defaultBody, resolve }) => {
    const prev = get().share.resolve;
    if (prev) prev(null);
    set({
      share: {
        open: true,
        mediaType,
        defaultTitle: defaultTitle || "",
        defaultBody: defaultBody || "",
        resolve,
      },
    });
  },
  closeShare: (payload) => {
    const r = get().share.resolve;
    if (r) r(payload);
    set((s) => ({ share: { ...s.share, open: false, resolve: null } }));
  },
}));

// --- Convenience API (callable from anywhere) -------------------------------

let toastCounter = 0;

// Show a toast. Returns the toast id so callers can update or dismiss it later.
// Loading toasts never auto-dismiss (duration = 0); others default to 3s.
export function showToast(
  message: string,
  opts?: { kind?: ToastKind; durationMs?: number }
): string {
  const id = `t_${Date.now()}_${++toastCounter}`;
  const kind = opts?.kind ?? "info";
  useUIStore.getState().pushToast({ id, kind, message });
  const defaultDur = kind === "loading" ? 0 : kind === "error" ? 4500 : 3000;
  const dur = opts?.durationMs ?? defaultDur;
  if (dur > 0) {
    setTimeout(() => useUIStore.getState().dismissToast(id), dur);
  }
  return id;
}

export function updateToast(
  id: string,
  patch: { message?: string; kind?: ToastKind },
  opts?: { durationMs?: number }
) {
  useUIStore.getState().patchToast(id, patch);
  const kind = patch.kind;
  const defaultDur = kind === "loading" ? 0 : kind === "error" ? 4500 : 3000;
  const dur = opts?.durationMs ?? defaultDur;
  if (dur > 0) {
    setTimeout(() => useUIStore.getState().dismissToast(id), dur);
  }
}

export function dismissToast(id: string) {
  useUIStore.getState().dismissToast(id);
}

// Returns the picked folder id, or null if the user cancelled.
export function pickFolder(): Promise<string | null> {
  return new Promise((resolve) => {
    useUIStore.getState().openFolderPicker(resolve);
  });
}

export function askConfirm(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    useUIStore.getState().openConfirm({ ...opts, resolve });
  });
}

export function askPrompt(opts: {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  confirmLabel?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    useUIStore.getState().openPrompt({ ...opts, resolve });
  });
}

// Collect title + body + category for a community post.
export function askShareToCommunity(opts: {
  mediaType: "image" | "video";
  defaultTitle?: string;
  defaultBody?: string;
}): Promise<SharePayload | null> {
  return new Promise((resolve) => {
    useUIStore.getState().openShare({ ...opts, resolve });
  });
}
