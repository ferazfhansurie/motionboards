"use client";

import { useEffect, useRef, useState } from "react";
import { X, Scissors, Loader2, Play, Pause } from "lucide-react";
import { useAppStore, type BoardItem } from "@/lib/store";

interface TrimDialogProps {
  item: BoardItem;
  onClose: () => void;
}

// In-browser video trimming via ffmpeg.wasm.
//
// Flow:
//   1. User scrubs a two-handle range slider (start / end seconds).
//   2. Preview <video> jumps to start when handles move + loops within range.
//   3. "Save trimmed" extracts the range with ffmpeg.wasm, uploads the
//      result to R2 via /api/upload-presign, and replaces the item's
//      outputUrl so every downstream user (Lipsync, downloads, generate
//      inputs) sees the trimmed file.
//
// ffmpeg.wasm is ~25 MB and lazy-loaded only when the user clicks Save —
// browsing trim handles is free.
export function TrimDialog({ item, onClose }: TrimDialogProps) {
  const updateItem = useAppStore((s) => s.updateItem);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const src = item.outputUrl || item.src;

  const onLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setTrimEnd(v.duration);
  };

  // Loop within trim range while playing.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => {
      if (v.currentTime >= trimEnd) {
        v.currentTime = trimStart;
      }
    };
    v.addEventListener("timeupdate", onTimeUpdate);
    return () => v.removeEventListener("timeupdate", onTimeUpdate);
  }, [trimStart, trimEnd]);

  // Snap to start when handles move so preview reflects the new range.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime < trimStart || v.currentTime > trimEnd) {
      v.currentTime = trimStart;
    }
  }, [trimStart, trimEnd]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.muted = false;
      v.currentTime = Math.max(v.currentTime, trimStart);
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const fmt = (s: number) => {
    const total = Math.max(0, s);
    const m = Math.floor(total / 60);
    const sec = total - m * 60;
    return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    setProgressLabel("Loading ffmpeg…");
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => {
        const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
        setProgressLabel(`Trimming… ${pct}%`);
      });
      // Load core from CDN (avoids bundling 25MB into our app).
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });

      setProgressLabel("Reading source video…");
      const inputName = "input.mp4";
      const outputName = "trimmed.mp4";
      await ffmpeg.writeFile(inputName, await fetchFile(src));

      setProgressLabel("Trimming…");
      const cutDuration = (trimEnd - trimStart).toFixed(3);
      // -ss BEFORE -i for fast seeking, then -t for output duration.
      // -c copy keeps re-encoding to a minimum (stream copy when possible).
      await ffmpeg.exec([
        "-ss", trimStart.toFixed(3),
        "-i", inputName,
        "-t", cutDuration,
        "-c", "copy",
        outputName,
      ]);

      setProgressLabel("Uploading…");
      const data = await ffmpeg.readFile(outputName);
      // ffmpeg.readFile returns Uint8Array | string. We wrote a binary
      // file, so cast through ArrayBuffer for the Blob constructor.
      const bytes = (data as Uint8Array).buffer.slice(0) as ArrayBuffer;
      const blob = new Blob([bytes], { type: "video/mp4" });
      const filename = `trimmed_${item.id}.mp4`;

      // Try R2 first, fall back to /api/upload.
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

      // Update the canvas item: outputUrl points to the new trimmed file,
      // and src is cleared so the inline player picks up outputUrl.
      const finalUrl: string = hostedUrl as string;
      const patch: Partial<BoardItem> = { outputUrl: finalUrl };
      if (item.type === "video" && !item.outputUrl) {
        patch.src = finalUrl;
      }
      updateItem(item.id, patch);

      setProgressLabel(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trim failed");
      setProgressLabel(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-[#0d1117] border border-gray-800 p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-[#f26522]" />
            <h3 className="text-sm font-semibold text-white">Trim video</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <video
          ref={videoRef}
          src={src}
          className="w-full max-h-[55vh] rounded-xl bg-black"
          onLoadedMetadata={onLoaded}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          playsInline
        />

        {duration > 0 && (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                disabled={busy}
                className="rounded-full bg-white/10 hover:bg-white/20 transition-colors p-2 disabled:opacity-50"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-3.5 w-3.5 text-white" /> : <Play className="h-3.5 w-3.5 text-white" fill="white" />}
              </button>
              <div className="flex-1 text-[11px] text-gray-400">
                <span className="text-[#f26522] font-mono">{fmt(trimStart)}</span>
                <span> → </span>
                <span className="text-[#f26522] font-mono">{fmt(trimEnd)}</span>
                <span className="text-gray-500"> ({fmt(trimEnd - trimStart)})</span>
              </div>
            </div>

            {/* Two-handle slider — both range inputs stack on the same track */}
            <div className="relative h-8 px-1">
              <div className="absolute top-1/2 left-1 right-1 h-1 -translate-y-1/2 rounded-full bg-gray-700" />
              <div
                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#f26522]"
                style={{
                  left: `calc(${(trimStart / duration) * 100}% + 4px)`,
                  right: `calc(${(1 - trimEnd / duration) * 100}% + 4px)`,
                }}
              />
              <input
                type="range"
                min={0}
                max={duration}
                step={0.05}
                value={trimStart}
                disabled={busy}
                onChange={(e) => {
                  const v = Math.min(parseFloat(e.target.value), trimEnd - 0.1);
                  setTrimStart(Math.max(0, v));
                }}
                className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <input
                type="range"
                min={0}
                max={duration}
                step={0.05}
                value={trimEnd}
                disabled={busy}
                onChange={(e) => {
                  const v = Math.max(parseFloat(e.target.value), trimStart + 0.1);
                  setTrimEnd(Math.min(duration, v));
                }}
                className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
            </div>
          </>
        )}

        {progressLabel && (
          <div className="flex items-center gap-2 text-xs text-[#f26522]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {progressLabel}
          </div>
        )}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

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
            onClick={handleSave}
            disabled={busy || duration === 0 || trimEnd - trimStart < 0.1}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#f26522] hover:bg-[#d9541a] text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scissors className="h-3.5 w-3.5" />}
            {busy ? "Saving…" : "Save trimmed"}
          </button>
        </div>
      </div>
    </div>
  );
}
