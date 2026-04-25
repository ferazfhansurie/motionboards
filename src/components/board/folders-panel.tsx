"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  FolderPlus,
  Trash2,
  Upload,
  ChevronLeft,
  Plus,
  ImageIcon,
  Film,
  Music,
  Loader2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { askConfirm, askPrompt, showToast, updateToast } from "@/lib/ui-store";

interface Folder {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
}

interface FolderItem {
  id: string;
  folderId: string;
  fileId: string;
  mediaType: "image" | "video" | "audio";
  fileName: string;
  createdAt: string;
}

export function FoldersPanel() {
  const { isFoldersOpen, setFoldersOpen, theme, addItem, panX, panY, zoom } = useAppStore();
  const isDark = theme === "dark";

  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [items, setItems] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadFolders() {
    setLoading(true);
    try {
      const res = await fetch("/api/folders").then((r) => r.json()).catch(() => ({ folders: [] }));
      setFolders(res?.folders || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadItems(folderId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/folders/${folderId}/items`).then((r) => r.json()).catch(() => ({ items: [] }));
      setItems(res?.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isFoldersOpen) return;
    loadFolders();
  }, [isFoldersOpen]);

  useEffect(() => {
    if (!activeFolderId) {
      setItems([]);
      return;
    }
    loadItems(activeFolderId);
  }, [activeFolderId]);

  if (!isFoldersOpen) return null;

  async function createFolder() {
    const name = await askPrompt({
      title: "New folder",
      placeholder: "Folder name",
      confirmLabel: "Create",
    });
    if (!name || !name.trim()) return;
    setBusy(true);
    const toastId = showToast("Creating folder…", { kind: "loading" });
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      }).then((r) => r.json());
      if (res?.folder) {
        setFolders((prev) => [res.folder, ...prev]);
        setActiveFolderId(res.folder.id);
        updateToast(toastId, { kind: "success", message: "Folder created." });
      } else {
        updateToast(toastId, { kind: "error", message: "Could not create folder." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(id: string) {
    const ok = await askConfirm({
      title: "Delete folder?",
      message: "The folder and every item inside it will be removed. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const toastId = showToast("Deleting folder…", { kind: "loading" });
    try {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFolders((prev) => prev.filter((f) => f.id !== id));
        if (activeFolderId === id) setActiveFolderId(null);
        updateToast(toastId, { kind: "success", message: "Folder deleted." });
      } else {
        updateToast(toastId, { kind: "error", message: "Delete failed." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!activeFolderId) return;
    const list = Array.from(files);
    setBusy(true);
    const toastId = showToast(`Uploading ${list.length} file${list.length === 1 ? "" : "s"}…`, {
      kind: "loading",
    });
    let done = 0;
    try {
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/folders/${activeFolderId}/items`, {
          method: "POST",
          body: form,
        }).then((r) => r.json()).catch(() => null);
        if (res?.item) {
          setItems((prev) => [res.item, ...prev]);
          done += 1;
        }
      }
      loadFolders();
      if (done === list.length) {
        updateToast(toastId, { kind: "success", message: `Uploaded ${done} file${done === 1 ? "" : "s"}.` });
      } else {
        updateToast(toastId, {
          kind: done > 0 ? "info" : "error",
          message: `Uploaded ${done} of ${list.length}.`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!activeFolderId) return;
    const ok = await askConfirm({
      title: "Remove item?",
      message: "This item will be removed from the folder.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/folders/${activeFolderId}/items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        loadFolders();
      }
    } finally {
      setBusy(false);
    }
  }

  function addItemToCanvas(it: FolderItem) {
    const src = `/api/files/${it.fileId}`;
    const id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const baseX = (-panX + window.innerWidth / 2 - 150) / zoom;
    const baseY = (-panY + window.innerHeight / 2 - 100) / zoom;
    if (it.mediaType === "image") {
      const img = new window.Image();
      img.onload = () => {
        const maxW = 500;
        const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
        addItem({
          id,
          type: "image",
          x: baseX,
          y: baseY,
          width: Math.round(img.naturalWidth * scale),
          height: Math.round(img.naturalHeight * scale),
          src,
          fileName: it.fileName,
          createdAt: new Date().toISOString(),
        });
      };
      img.src = src;
    } else if (it.mediaType === "video") {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        const maxW = 500;
        const scale = v.videoWidth > maxW ? maxW / v.videoWidth : 1;
        addItem({
          id,
          type: "video",
          x: baseX,
          y: baseY,
          width: Math.round(v.videoWidth * scale) || 400,
          height: Math.round(v.videoHeight * scale) || 225,
          src,
          fileName: it.fileName,
          createdAt: new Date().toISOString(),
        });
      };
      v.src = src;
    } else {
      addItem({
        id,
        type: "audio",
        x: baseX,
        y: baseY,
        width: 280,
        height: 80,
        src,
        fileName: it.fileName,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const panel = isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-200";
  const headerBorder = isDark ? "border-gray-800" : "border-gray-100";
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-500" : "text-gray-400";
  const hover = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";

  const activeFolder = folders.find((f) => f.id === activeFolderId) || null;

  return (
    <div className="fixed right-0 top-0 z-[48] flex h-full w-[360px] pointer-events-auto">
      <div
        className={`flex h-full w-full flex-col border-l ${panel}`}
        style={{ boxShadow: isDark ? "-20px 0 40px rgba(0,0,0,0.4)" : "-20px 0 40px rgba(0,0,0,0.06)" }}
      >
        <div className={`flex items-center justify-between px-4 py-3 border-b ${headerBorder}`}>
          {activeFolder ? (
            <button
              onClick={() => setActiveFolderId(null)}
              className={`flex items-center gap-2 text-sm font-bold ${text}`}
            >
              <ChevronLeft className="h-4 w-4" />
              {activeFolder.name}
            </button>
          ) : (
            <h3 className={`text-sm font-bold ${text}`}>Folders</h3>
          )}
          <button
            className={`rounded-lg p-1.5 ${sub} ${hover}`}
            onClick={() => setFoldersOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!activeFolder ? (
          <div className="flex-1 overflow-y-auto p-2">
            <button
              onClick={createFolder}
              disabled={busy}
              className={`flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-[12px] font-semibold transition-colors ${isDark ? "border-gray-800 text-gray-300 hover:border-[#f26522] hover:text-[#f26522]" : "border-gray-200 text-gray-600 hover:border-[#f26522] hover:text-[#f26522]"}`}
            >
              <FolderPlus className="h-4 w-4" /> New Folder
            </button>
            <div className="mt-2 space-y-1">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className={`h-4 w-4 animate-spin ${sub}`} />
                </div>
              ) : folders.length === 0 ? (
                <p className={`px-2 py-6 text-center text-[11px] ${sub}`}>
                  No folders yet. Create one to stash references and generations.
                </p>
              ) : (
                folders.map((f) => (
                  <div
                    key={f.id}
                    className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer ${hover}`}
                    onClick={() => setActiveFolderId(f.id)}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f26522]/10 text-[#f26522]">
                      <FolderPlus className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-semibold truncate ${text}`}>{f.name}</p>
                      <p className={`text-[10px] ${sub}`}>{f.itemCount} item{f.itemCount === 1 ? "" : "s"}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(f.id);
                      }}
                      className="p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            <div className={`flex items-center gap-2 border-b px-4 py-2 ${headerBorder}`}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${isDark ? "bg-white/5 text-gray-200 hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <span className={`text-[10px] ${sub}`}>Drop files here to add</span>
            </div>
            <div
              className="flex-1 overflow-y-auto p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
              }}
            >
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className={`h-4 w-4 animate-spin ${sub}`} />
                </div>
              ) : items.length === 0 ? (
                <p className={`px-2 py-10 text-center text-[11px] ${sub}`}>
                  Empty folder. Upload or save from the canvas.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className={`group relative overflow-hidden rounded-xl border ${isDark ? "border-gray-800 bg-[#161b22]" : "border-gray-200 bg-gray-50"}`}
                    >
                      <div className="aspect-square relative">
                        {it.mediaType === "video" ? (
                          <video
                            src={`/api/files/${it.fileId}`}
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            controls
                            className="h-full w-full object-cover"
                          />
                        ) : it.mediaType === "image" ? (
                          <img src={`/api/files/${it.fileId}`} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Music className={`h-8 w-8 ${sub}`} />
                          </div>
                        )}
                        <span className={`absolute left-1.5 top-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white`}>
                          {it.mediaType === "video" ? <Film className="h-3 w-3" /> : it.mediaType === "image" ? <ImageIcon className="h-3 w-3" /> : <Music className="h-3 w-3" />}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className={`truncate text-[10px] font-semibold ${text}`} title={it.fileName}>
                          {it.fileName}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => addItemToCanvas(it)}
                            title="Add to canvas"
                            className={`rounded p-1 ${sub} hover:text-[#f26522]`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteItem(it.id)}
                            title="Delete"
                            className={`rounded p-1 ${sub} hover:text-red-500`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className={`border-t px-3 py-2 text-[9px] text-center ${headerBorder} ${sub}`}>
          Items auto-expire after 14 days.
        </div>
      </div>
    </div>
  );
}
