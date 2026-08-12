"use client";

import { useState } from "react";
import { X, Loader2, Download } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface TimelineExportDialogProps {
  onClose: () => void;
}

// Exports the current single-track timeline to one MP4 via ffmpeg.wasm:
// per-clip trim (-ss/-t -c copy) then a concat-demuxer join. Mirrors
// trim-dialog.tsx's ffmpeg + upload pattern, generalized to N clips.
//
// Known limitation: -c copy concat requires matching codec/resolution/
// framerate across clips. True for same-model AI generations; not
// guaranteed when mixing uploaded footage with generated clips.
export function TimelineExportDialog({ onClose }: TimelineExportDialogProps) {
  const timeline = useAppStore((s) => s.timeline);
  const items = useAppStore((s) => s.items);
  const addItem = useAppStore((s) => s.addItem);
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clips = timeline?.clips ? [...timeline.clips].sort((a, b) => a.order - b.order) : [];

  const handleExport = async () => {
    if (clips.length === 0) return;
    setBusy(true);
    setError(null);
    setProgressLabel("Loading ffmpeg…");
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => {
        const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
        setProgressLabel(`Rendering… ${pct}%`);
      });
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });

      const cutNames: string[] = [];
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const item = items.find((it) => it.id === clip.itemId);
        const src = item?.outputUrl || item?.src;
        if (!src) continue;
        setProgressLabel(`Reading clip ${i + 1} of ${clips.length}…`);
        const inputName = `in_${i}.mp4`;
        const cutName = `cut_${i}.mp4`;
        await ffmpeg.writeFile(inputName, await fetchFile(src));
        const cutDuration = (clip.trimOut - clip.trimIn).toFixed(3);
        await ffmpeg.exec([
          "-ss", clip.trimIn.toFixed(3),
          "-i", inputName,
          "-t", cutDuration,
          "-c", "copy",
          cutName,
        ]);
        cutNames.push(cutName);
      }

      if (cutNames.length === 0) throw new Error("No valid clips to export");

      setProgressLabel("Joining clips…");
      const manifest = cutNames.map((n) => `file '${n}'`).join("\n");
      await ffmpeg.writeFile("concat.txt", manifest);
      await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "output.mp4"]);

      setProgressLabel("Uploading…");
      const data = await ffmpeg.readFile("output.mp4");
      const bytes = (data as Uint8Array).buffer.slice(0) as ArrayBuffer;
      const blob = new Blob([bytes], { type: "video/mp4" });
      const filename = `timeline_export_${Date.now()}.mp4`;

      let hostedUrl: string | null = null;
      try {
        const presign = await fetch("/api/upload-presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filename, contentType: "video/mp4" }),
        });
        if (presign.ok) {
          const { uploadUrl, publicUrl } = await presign.json();
          const putRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "content-type": "video/mp4" },
            body: blob,
          });
          if (putRes.ok) hostedUrl = publicUrl;
        }
      } catch {}
      if (!hostedUrl) {
        const form = new FormData();
        form.append("file", new File([blob], filename, { type: "video/mp4" }));
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const d = await res.json();
        if (res.ok && d.url) hostedUrl = d.url;
        else throw new Error(d.error || "Upload failed");
      }

      addItem({
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: "video",
        x: 0,
        y: 0,
        width: 320,
        height: 180,
        src: hostedUrl as string,
        outputUrl: hostedUrl as string,
        outputType: "video",
        status: "completed",
        createdAt: new Date().toISOString(),
      });

      setProgressLabel(null);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. If clips have different codecs/resolutions, stream-copy export can't join them yet.`
          : "Export failed"
      );
      setProgressLabel(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[#0d1117] border border-gray-800 p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Export timeline</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] text-gray-400">
          Joins {clips.length} clip{clips.length === 1 ? "" : "s"} into a single MP4 and adds it to the canvas.
        </p>

        {progressLabel && (
          <div className="flex items-center gap-2 text-xs text-[#f26522]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {progressLabel}
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy || clips.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#f26522] hover:bg-[#d9541a] text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {busy ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
