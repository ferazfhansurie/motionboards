"use client";

import type { Board, BoardItem, Connection } from "./store";

// Portable board file (.mbboard JSON).
// Media is embedded as base64 data URIs so the file is self-contained and
// works on any account — on import we re-upload each data URI to Neon under
// the importing user's session, so the URLs stop pointing at the original
// owner's files (which would expire or be deleted on them).
export interface BoardExport {
  version: 1;
  exportedAt: string;
  board: {
    name: string;
    items: BoardItem[];
    connections: Connection[];
    panX: number;
    panY: number;
    zoom: number;
  };
}

// Fetch a URL and return it as a base64 data: URI. Returns the original URL
// unchanged if the fetch fails or the input is already a data URI / empty.
async function urlToDataUri(url: string | undefined | null): Promise<string> {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function exportBoardToFile(board: Board, onProgress?: (done: number, total: number) => void): Promise<void> {
  // Walk items, resolve each media field to a data URI so the file is portable
  const items: BoardItem[] = [];
  const total = board.items.length;
  for (let i = 0; i < board.items.length; i++) {
    const item = board.items[i];
    const next: BoardItem = { ...item };
    if (item.src) next.src = await urlToDataUri(item.src);
    if (item.outputUrl) next.outputUrl = await urlToDataUri(item.outputUrl);
    items.push(next);
    onProgress?.(i + 1, total);
  }

  const payload: BoardExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    board: {
      name: board.name,
      items,
      connections: board.connections || [],
      panX: board.panX || 0,
      panY: board.panY || 0,
      zoom: board.zoom || 1,
    },
  };

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const safeName = board.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "board";
  const filename = `${safeName}-${new Date().toISOString().slice(0, 10)}.mbboard.json`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// Upload a data URI to /api/upload under the current session so the resulting
// URL belongs to the importing user. Returns the new /api/files/:id URL, or
// the original data URI if the upload fails.
async function dataUriToUploadedUrl(dataUri: string): Promise<string> {
  if (!dataUri.startsWith("data:")) return dataUri;
  try {
    const blobRes = await fetch(dataUri);
    const blob = await blobRes.blob();
    if (blob.size === 0) return dataUri;
    const ext = (blob.type.split("/")[1] || "bin").split(";")[0];
    const file = new File([blob], `import.${ext}`, { type: blob.type || "application/octet-stream" });
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) return dataUri;
    const data = await res.json();
    return typeof data.url === "string" ? data.url : dataUri;
  } catch {
    return dataUri;
  }
}

export async function importBoardFromFile(
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<{ board: Board; skipped: number }> {
  const text = await file.text();
  let parsed: BoardExport;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not a valid MotionBoards export file");
  }
  if (parsed.version !== 1 || !parsed.board) {
    throw new Error("Unsupported export format");
  }

  // Rebuild items with NEW ids so they don't collide with existing ones,
  // remapping connection endpoints at the same time.
  const idMap = new Map<string, string>();
  const now = Date.now();
  const total = parsed.board.items.length;
  let skipped = 0;
  const items: BoardItem[] = [];

  for (let i = 0; i < parsed.board.items.length; i++) {
    const src = parsed.board.items[i];
    const newId = `item_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`;
    idMap.set(src.id, newId);

    // Upload any data: URIs to the current user's account
    const newSrc = src.src ? await dataUriToUploadedUrl(src.src) : src.src;
    const newOut = src.outputUrl ? await dataUriToUploadedUrl(src.outputUrl) : src.outputUrl;
    if (src.src && src.src.startsWith("data:") && !newSrc.startsWith("/") && !newSrc.startsWith("http")) {
      skipped++;
    }

    items.push({
      ...src,
      id: newId,
      src: newSrc,
      outputUrl: newOut,
      createdAt: new Date().toISOString(),
    });
    onProgress?.(i + 1, total);
  }

  // Remap connection endpoints; drop any that reference items we didn't import
  const connections: Connection[] = (parsed.board.connections || [])
    .filter((c) => idMap.has(c.fromId) && idMap.has(c.toId))
    .map((c, i) => ({
      id: `conn_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      fromId: idMap.get(c.fromId)!,
      toId: idMap.get(c.toId)!,
    }));

  const newBoard: Board = {
    id: `board_${now}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${parsed.board.name} (imported)`,
    items,
    connections,
    panX: parsed.board.panX || 0,
    panY: parsed.board.panY || 0,
    zoom: parsed.board.zoom || 1,
  };

  return { board: newBoard, skipped };
}
