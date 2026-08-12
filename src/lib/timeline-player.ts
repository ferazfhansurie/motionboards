"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useAppStore, type Timeline } from "./store";

const DRIFT_CORRECTION_SEC = 0.15;

interface ResolvedClip {
  id: string;
  itemId: string;
  src: string;
  trimIn: number;
  trimOut: number;
  startOffset: number; // position in the global timeline, seconds
  duration: number;
}

function resolveClips(timeline: Timeline | null, srcForItem: (itemId: string) => string): ResolvedClip[] {
  if (!timeline) return [];
  const sorted = [...timeline.clips].sort((a, b) => a.order - b.order);
  let offset = 0;
  const out: ResolvedClip[] = [];
  for (const c of sorted) {
    const duration = Math.max(0, c.trimOut - c.trimIn);
    if (duration <= 0) continue;
    out.push({
      id: c.id,
      itemId: c.itemId,
      src: srcForItem(c.itemId),
      trimIn: c.trimIn,
      trimOut: c.trimOut,
      startOffset: offset,
      duration,
    });
    offset += duration;
  }
  return out;
}

function findClipAt(clips: ResolvedClip[], globalTime: number): { index: number; localTime: number } | null {
  if (clips.length === 0) return null;
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const isLast = i === clips.length - 1;
    if (globalTime < c.startOffset + c.duration || (isLast && globalTime <= c.startOffset + c.duration)) {
      return { index: i, localTime: c.trimIn + Math.max(0, globalTime - c.startOffset) };
    }
  }
  const last = clips[clips.length - 1];
  return { index: clips.length - 1, localTime: last.trimOut };
}

// Video elements are created and owned by the caller (via useRef in the
// consuming component) and passed in, rather than returned from this hook —
// mixing ref objects into a hook's returned data object defeats the React
// Compiler's purity analysis for every other field on that object.
export function useTimelinePlayer(
  videoElA: RefObject<HTMLVideoElement | null>,
  videoElB: RefObject<HTMLVideoElement | null>
) {
  const timeline = useAppStore((s) => s.timeline);
  const items = useAppStore((s) => s.items);

  const srcForItem = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      return item?.outputUrl || item?.src || "";
    },
    [items]
  );

  const clips = useMemo(() => resolveClips(timeline, srcForItem), [timeline, srcForItem]);
  const totalDuration = clips.length > 0 ? clips[clips.length - 1].startOffset + clips[clips.length - 1].duration : 0;

  const getVideoEl = useCallback(
    (slot: 0 | 1): HTMLVideoElement | null => (slot === 0 ? videoElA.current : videoElB.current),
    [videoElA, videoElB]
  );

  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeClipIndex, setActiveClipIndex] = useState(0);

  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const activeSlotRef = useRef<0 | 1>(0);
  const slotClipIndexRef = useRef<[number, number]>([-1, -1]);
  const activeClipIndexRef = useRef(0);

  // Load a clip's source into a given slot (does not change which slot is visible).
  const loadIntoSlot = useCallback((slot: 0 | 1, clipIndex: number) => {
    const clip = clips[clipIndex];
    const el = getVideoEl(slot);
    if (!clip || !el) return;
    if (el.src !== clip.src) el.src = clip.src;
    slotClipIndexRef.current = slot === 0 ? [clipIndex, slotClipIndexRef.current[1]] : [slotClipIndexRef.current[0], clipIndex];
  }, [clips, getVideoEl]);

  // Reset when the clip list changes (add/remove/reorder/trim/split, or board switch).
  useEffect(() => {
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    currentTimeRef.current = 0;
    setCurrentTime(0);
    activeClipIndexRef.current = 0;
    setActiveClipIndex(0);
    activeSlotRef.current = 0;
    setActiveSlot(0);
    slotClipIndexRef.current = [-1, -1];
    if (clips.length > 0) {
      loadIntoSlot(0, 0);
      const el = getVideoEl(0);
      if (el) el.currentTime = clips[0].trimIn;
      if (clips.length > 1) loadIntoSlot(1, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips.map((c) => `${c.id}:${c.src}:${c.trimIn}:${c.trimOut}`).join("|")]);

  const applyGlobalTime = useCallback((globalTime: number, opts?: { seeking?: boolean }) => {
    const resolved = findClipAt(clips, globalTime);
    if (!resolved) return;
    const { index, localTime } = resolved;
    const activeSlotEl = getVideoEl(activeSlotRef.current);

    if (index !== activeClipIndexRef.current) {
      // Crossing a clip boundary — prefer the preloaded inactive slot if it already
      // has the target clip; otherwise load it into the active slot directly (accepts
      // a possible brief stall rather than showing a mismatched frame).
      const inactiveSlot: 0 | 1 = activeSlotRef.current === 0 ? 1 : 0;
      if (slotClipIndexRef.current[inactiveSlot] === index) {
        const inactiveEl = getVideoEl(inactiveSlot);
        if (inactiveEl) inactiveEl.currentTime = localTime;
        activeSlotRef.current = inactiveSlot;
        setActiveSlot(inactiveSlot);
      } else {
        loadIntoSlot(activeSlotRef.current, index);
        if (activeSlotEl) activeSlotEl.currentTime = localTime;
      }
      activeClipIndexRef.current = index;
      setActiveClipIndex(index);
      // Preload the next clip into the now-inactive slot.
      const nowInactive: 0 | 1 = activeSlotRef.current === 0 ? 1 : 0;
      if (index + 1 < clips.length) loadIntoSlot(nowInactive, index + 1);
    } else if (activeSlotEl) {
      if (opts?.seeking || Math.abs(activeSlotEl.currentTime - localTime) > DRIFT_CORRECTION_SEC) {
        activeSlotEl.currentTime = localTime;
      }
    }

    currentTimeRef.current = globalTime;
    setCurrentTime(globalTime);
  }, [clips, loadIntoSlot, getVideoEl]);

  const tick = useCallback((now: number) => {
    if (lastTickRef.current == null) lastTickRef.current = now;
    const elapsed = (now - lastTickRef.current) / 1000;
    lastTickRef.current = now;

    let next = currentTimeRef.current + elapsed;
    if (next >= totalDuration) {
      next = totalDuration;
      applyGlobalTime(next);
      setIsPlaying(false);
      return;
    }
    applyGlobalTime(next);
    rafRef.current = requestAnimationFrame(tick);
  }, [applyGlobalTime, totalDuration]);

  const play = useCallback(() => {
    if (clips.length === 0) return;
    if (currentTimeRef.current >= totalDuration) {
      currentTimeRef.current = 0;
      applyGlobalTime(0, { seeking: true });
    }
    setIsPlaying(true);
    lastTickRef.current = null;
    getVideoEl(activeSlotRef.current)?.play().catch(() => {});
    rafRef.current = requestAnimationFrame(tick);
  }, [applyGlobalTime, clips.length, tick, totalDuration, getVideoEl]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    getVideoEl(activeSlotRef.current)?.pause();
  }, [getVideoEl]);

  const seek = useCallback((sec: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, sec));
    applyGlobalTime(clamped, { seeking: true });
  }, [applyGlobalTime, totalDuration]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    activeSlot,
    play,
    pause,
    seek,
    currentTime,
    isPlaying,
    activeClipIndex,
    activeClipId: clips[activeClipIndex]?.id ?? null,
    totalDuration,
    clips,
  };
}
