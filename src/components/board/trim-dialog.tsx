"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Scissors, Loader2, Play, Pause } from "lucide-react";
import { useAppStore, type BoardItem } from "@/lib/store";

interface TrimDialogProps {
  item: BoardItem;
  onClose: () => void;
}

type DragKind = "start" | "end" | "playhead" | null;

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
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  // Playhead is the *preview* time — separate from trimStart/trimEnd. Lets
  // users scrub anywhere inside the trim window without changing the cut.
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState<DragKind>(null);
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const src = item.outputUrl || item.src;

  const onLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setTrimEnd(v.duration);
    setPlayhead(0);
  };

  // Loop within trim range while playing.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => {
      // Loop the trim region during playback.
      if (v.currentTime >= trimEnd) {
        v.currentTime = trimStart;
      }
      // Mirror the playing video's time into the playhead state so the
      // marker glides as the video plays.
      if (!dragging) setPlayhead(v.currentTime);
    };
    v.addEventListener("timeupdate", onTimeUpdate);
    return () => v.removeEventListener("timeupdate", onTimeUpdate);
  }, [trimStart, trimEnd, dragging]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.muted = false;
      // Resume from the playhead unless it's outside the trim window.
      const start = Math.min(Math.max(playhead, trimStart), trimEnd - 0.05);
      v.currentTime = start;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  // Convert a clientX into a 0..duration time using the track's bounds.
  const xToTime = useCallback((clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || duration === 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  // Move the video element to `t` seconds and update the playhead state.
  // Used by both manual drags and click-to-seek on the timeline track.
  const seekTo = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setPlayhead(t);
  }, []);

  const onPointerDownTrack = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration || busy) return;
    // Don't hijack pointerdown that started on a handle — those have their
    // own handlers below that set the right DragKind first.
    const target = e.target as HTMLElement;
    if (target.dataset.handle) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const t = xToTime(e.clientX);
    // Click inside the trim window → move playhead. Outside → still seek
    // playhead (lets user preview pre-trim / post-trim regions too).
    setDragging("playhead");
    seekTo(t);
  };

  const beginHandleDrag = (kind: "start" | "end") => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration || busy) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(kind);
    const t = xToTime(e.clientX);
    if (kind === "start") {
      const next = Math.max(0, Math.min(t, trimEnd - 0.1));
      setTrimStart(next);
      seekTo(next);
    } else {
      const next = Math.min(duration, Math.max(t, trimStart + 0.1));
      setTrimEnd(next);
      seekTo(next);
    }
  };

  // Single move/up handler reused by all three drags. The `dragging` state
  // disambiguates which value to update.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (ev: PointerEvent) => {
      const t = xToTime(ev.clientX);
      if (dragging === "start") {
        const next = Math.max(0, Math.min(t, trimEnd - 0.1));
        setTrimStart(next);
        seekTo(next);
      } else if (dragging === "end") {
        const next = Math.min(duration, Math.max(t, trimStart + 0.1));
        setTrimEnd(next);
        seekTo(next);
      } else if (dragging === "playhead") {
        seekTo(Math.max(0, Math.min(t, duration)));
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, trimStart, trimEnd, duration, xToTime, seekTo]);

  // Pause playback during any drag — the user is scrubbing, not watching.
  useEffect(() => {
    if (!dragging) return;
    const v = videoRef.current;
    if (v && !v.paused) v.pause();
  }, [dragging]);

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
              <div className="text-[10px] text-gray-500 font-mono">{fmt(playhead)}</div>
            </div>

            {/*
              iPhone-style trim timeline:
                - Two yellow brackets = trim start / end. Drag to change cut.
                - Grey vertical bar between them = playhead. Drag to scrub
                  the preview frame anywhere in the video.
                - Click anywhere on the track = jump playhead there.
              All three handles seek the video element in real time so the
              preview always shows the exact frame under the bar being dragged.
            */}
            <div
              ref={trackRef}
              onPointerDown={onPointerDownTrack}
              className={`relative h-14 select-none ${busy ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
            >
              {/* Track background — full video duration */}
              <div className="absolute inset-y-1 left-0 right-0 rounded-md bg-white/5 border border-white/10" />

              {/* Dimmed pre-trim region */}
              <div
                className="absolute inset-y-1 left-0 rounded-l-md bg-black/60 backdrop-blur-[1px]"
                style={{ width: `${(trimStart / duration) * 100}%` }}
              />
              {/* Dimmed post-trim region */}
              <div
                className="absolute inset-y-1 right-0 rounded-r-md bg-black/60 backdrop-blur-[1px]"
                style={{ width: `${((duration - trimEnd) / duration) * 100}%` }}
              />

              {/* Trim window outline (between brackets) */}
              <div
                className="absolute inset-y-1 border-y-2 border-[#f26522] pointer-events-none"
                style={{
                  left: `${(trimStart / duration) * 100}%`,
                  right: `${((duration - trimEnd) / duration) * 100}%`,
                }}
              />

              {/* LEFT bracket = trim start */}
              <div
                data-handle="start"
                onPointerDown={beginHandleDrag("start")}
                className="absolute top-0 bottom-0 -translate-x-1/2 flex items-center justify-center cursor-ew-resize touch-none z-[2]"
                style={{ left: `${(trimStart / duration) * 100}%`, width: 18 }}
                title="Trim start"
              >
                <div className="h-full w-2.5 rounded-l-md bg-[#f26522] flex items-center justify-center pointer-events-none">
                  <div className="h-5 w-[2px] rounded bg-white/90" />
                </div>
              </div>

              {/* RIGHT bracket = trim end */}
              <div
                data-handle="end"
                onPointerDown={beginHandleDrag("end")}
                className="absolute top-0 bottom-0 -translate-x-1/2 flex items-center justify-center cursor-ew-resize touch-none z-[2]"
                style={{ left: `${(trimEnd / duration) * 100}%`, width: 18 }}
                title="Trim end"
              >
                <div className="h-full w-2.5 rounded-r-md bg-[#f26522] flex items-center justify-center pointer-events-none">
                  <div className="h-5 w-[2px] rounded bg-white/90" />
                </div>
              </div>

              {/* PLAYHEAD = grey vertical bar — scrubs preview without
                  changing the trim window. */}
              <div
                data-handle="playhead"
                onPointerDown={(e) => {
                  if (busy) return;
                  e.preventDefault();
                  e.stopPropagation();
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  setDragging("playhead");
                }}
                className="absolute top-0 bottom-0 -translate-x-1/2 cursor-ew-resize touch-none z-[3] flex items-center justify-center"
                style={{ left: `${(playhead / duration) * 100}%`, width: 16 }}
                title="Playhead"
              >
                <div className="h-full w-[3px] rounded bg-white shadow-[0_0_10px_rgba(255,255,255,0.4)] pointer-events-none" />
                <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow pointer-events-none" />
              </div>
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
