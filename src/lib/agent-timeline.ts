// Executors for the timeline_* agent tools (src/lib/agent-tools.ts).
//
// Mirrors runAgentGeneration's shape (src/lib/agent-generation.ts) but these
// are synchronous store mutations for the 5 edit tools — no polling needed.
// The 2 perception tools (probe/transcribe) do a short async round-trip.
//
// Every function returns a structured receipt (ok/message/clipId), never a
// bare "done" string — per the tool-design principle that a tool result must
// say exactly what changed, or explicitly report a no-op/validation failure,
// so Claude never mistakes a silently-adjusted outcome for success.

import { useAppStore } from "@/lib/store";

export interface TimelineToolResult {
  ok: boolean;
  message: string;
  clipId?: string;
}

function probeVideoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(v.duration || 0);
    v.onerror = () => reject(new Error("Couldn't read video metadata"));
    v.src = url;
  });
}

function findVideoItem(itemId: string) {
  const item = useAppStore.getState().items.find((i) => i.id === itemId);
  if (!item) return { item: null, error: `No canvas item with id "${itemId}".` };
  if (item.type !== "video") return { item: null, error: `Item "${itemId}" is a ${item.type}, not a video.` };
  const src = item.outputUrl || item.src;
  if (!src) return { item: null, error: `Item "${itemId}" has no playable media yet (still generating?).` };
  return { item, src, error: null as string | null };
}

export async function runTimelineAddClip(args: {
  item_id: string;
  trim_in?: number;
  trim_out?: number;
  order?: number;
}): Promise<TimelineToolResult> {
  const { item, src, error } = findVideoItem(args.item_id);
  if (!item || !src) return { ok: false, message: error! };

  let sourceDurationSec: number | undefined;
  try {
    sourceDurationSec = await probeVideoDuration(src);
  } catch {
    // Non-fatal — fall back to the store action's default window.
  }

  if (args.trim_in != null && args.trim_out != null && args.trim_in >= args.trim_out) {
    return { ok: false, message: `trim_in (${args.trim_in}) must be less than trim_out (${args.trim_out}).` };
  }
  if (sourceDurationSec && args.trim_out != null && args.trim_out > sourceDurationSec + 0.5) {
    return { ok: false, message: `trim_out (${args.trim_out}s) exceeds the clip's actual duration (${sourceDurationSec.toFixed(1)}s).` };
  }

  const clipId = useAppStore.getState().addTimelineClip(args.item_id, {
    trimIn: args.trim_in,
    trimOut: args.trim_out,
    order: args.order,
    sourceDurationSec,
  });

  const range = `${(args.trim_in ?? 0).toFixed(1)}s–${(args.trim_out ?? sourceDurationSec ?? 5).toFixed(1)}s`;
  return { ok: true, clipId, message: `Added clip ${clipId} (item ${args.item_id}, ${range}) to the timeline.` };
}

export function runTimelineTrimClip(args: { clip_id: string; trim_in?: number; trim_out?: number }): TimelineToolResult {
  const timeline = useAppStore.getState().timeline;
  const clip = timeline?.clips.find((c) => c.id === args.clip_id);
  if (!clip) return { ok: false, message: `No timeline clip with id "${args.clip_id}".` };

  const nextIn = args.trim_in ?? clip.trimIn;
  const nextOut = args.trim_out ?? clip.trimOut;
  if (nextIn >= nextOut) {
    return { ok: false, message: `Resulting trim_in (${nextIn}) would not be less than trim_out (${nextOut}) — no change made.` };
  }
  if (clip.sourceDurationSec && nextOut > clip.sourceDurationSec + 0.5) {
    return { ok: false, message: `trim_out (${nextOut}s) exceeds the source's duration (${clip.sourceDurationSec.toFixed(1)}s) — no change made.` };
  }
  if (nextIn === clip.trimIn && nextOut === clip.trimOut) {
    return { ok: true, clipId: clip.id, message: `Clip ${clip.id} already has that trim range — no-op.` };
  }

  useAppStore.getState().updateTimelineClip(args.clip_id, { trimIn: nextIn, trimOut: nextOut });
  return { ok: true, clipId: clip.id, message: `Clip ${clip.id} trimmed to ${nextIn.toFixed(1)}s–${nextOut.toFixed(1)}s.` };
}

export function runTimelineReorderClip(args: { clip_id: string; order: number }): TimelineToolResult {
  const timeline = useAppStore.getState().timeline;
  const clip = timeline?.clips.find((c) => c.id === args.clip_id);
  if (!clip) return { ok: false, message: `No timeline clip with id "${args.clip_id}".` };
  useAppStore.getState().reorderTimelineClip(args.clip_id, args.order);
  return { ok: true, clipId: clip.id, message: `Clip ${clip.id} moved to position ${args.order}.` };
}

export function runTimelineSplitClip(args: { clip_id: string; at_seconds: number }): TimelineToolResult {
  const timeline = useAppStore.getState().timeline;
  const clip = timeline?.clips.find((c) => c.id === args.clip_id);
  if (!clip) return { ok: false, message: `No timeline clip with id "${args.clip_id}".` };
  const clipDuration = clip.trimOut - clip.trimIn;
  if (args.at_seconds <= 0 || args.at_seconds >= clipDuration) {
    return { ok: false, message: `at_seconds (${args.at_seconds}) must be strictly between 0 and the clip's own duration (${clipDuration.toFixed(1)}s) — no change made.` };
  }
  const newClipId = useAppStore.getState().splitTimelineClip(args.clip_id, args.at_seconds);
  if (!newClipId) return { ok: false, message: `Split failed — clip ${args.clip_id} may have changed since it was last read.` };
  return { ok: true, clipId: newClipId, message: `Split clip ${clip.id} at ${args.at_seconds.toFixed(1)}s into ${clip.id} and ${newClipId}.` };
}

export function runTimelineRemoveClip(args: { clip_id: string }): TimelineToolResult {
  const timeline = useAppStore.getState().timeline;
  const clip = timeline?.clips.find((c) => c.id === args.clip_id);
  if (!clip) return { ok: true, message: `Clip "${args.clip_id}" is already not on the timeline — no-op.` };
  useAppStore.getState().removeTimelineClip(args.clip_id);
  return { ok: true, message: `Removed clip ${args.clip_id} from the timeline. The canvas item is untouched.` };
}

export async function runTimelineProbeClip(args: { item_id: string; at_seconds?: number }): Promise<TimelineToolResult> {
  const { item, src, error } = findVideoItem(args.item_id);
  if (!item || !src) return { ok: false, message: error! };

  try {
    const url = await new Promise<string>((resolve, reject) => {
      const v = document.createElement("video");
      v.crossOrigin = "anonymous";
      v.preload = "auto";
      v.muted = true;
      v.onloadedmetadata = () => {
        const t = args.at_seconds ?? v.duration / 2;
        v.currentTime = Math.max(0, Math.min(v.duration || t, t));
      };
      v.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(v, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("Frame capture failed"));
          resolve(URL.createObjectURL(blob));
        }, "image/jpeg", 0.85);
      };
      v.onerror = () => reject(new Error("Couldn't load the clip for probing"));
      v.src = src;
    });

    // Upload so the frame has a durable URL (blob: URLs die with the tab).
    const blob = await fetch(url).then((r) => r.blob());
    URL.revokeObjectURL(url);
    const filename = `probe_${item.id}_${Date.now()}.jpg`;
    let hostedUrl: string | null = null;
    try {
      const presign = await fetch("/api/upload-presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename, contentType: "image/jpeg" }),
      });
      if (presign.ok) {
        const { uploadUrl, publicUrl } = await presign.json();
        const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: blob });
        if (putRes.ok) hostedUrl = publicUrl;
      }
    } catch {}
    if (!hostedUrl) {
      const form = new FormData();
      form.append("file", new File([blob], filename, { type: "image/jpeg" }));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const d = await res.json();
      if (res.ok && d.url) hostedUrl = d.url;
    }
    if (!hostedUrl) return { ok: false, message: "Captured the frame but couldn't upload it." };

    return {
      ok: true,
      message: `Frame captured from item ${item.id} at ${(args.at_seconds ?? 0).toFixed(1)}s: ${hostedUrl}. Attach this URL as a reference image in your next message if you need to look at it directly.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Probe failed" };
  }
}

export async function runTimelineTranscribeClip(args: { item_id: string }): Promise<TimelineToolResult> {
  const { item, src, error } = findVideoItem(args.item_id);
  if (!item || !src) return { ok: false, message: error! };

  try {
    const res = await fetch("/api/timeline/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: src }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.error || "Transcription failed" };

    const segments = (data.segments || []) as { start: number; end: number; text: string }[];
    if (segments.length === 0) {
      return { ok: true, message: `No speech detected in item ${item.id} (music-only or silent).` };
    }
    const lines = segments.map((s) => `[${s.start.toFixed(1)}s–${s.end.toFixed(1)}s] ${s.text}`).join("\n");
    return { ok: true, message: `Transcript for item ${item.id}:\n${lines}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Transcription failed" };
  }
}
