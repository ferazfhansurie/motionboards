"use client";

// Animated greeting bubble for the AI Agent onboarding. Appears above the
// empty-hero textarea when AI Agent mode is active and the user hasn't seen
// the greeting in this session (gated by sessionStorage so it shows once
// per tab open, not on every render).
//
// Effects:
//   - Typewriter animation, character-by-character with jittered delays so
//     it feels human, not metronomic.
//   - Subtle WebAudio "tick" on every other character. Volume is very low
//     (gain 0.025) and frequency is randomised slightly so it doesn't
//     sound robotic. Browsers gate AudioContext behind a user gesture —
//     this card mounts AFTER the user clicks the AI Agent toggle, so the
//     toggle click counts as the gesture and audio is unlocked.
//   - Blinking cursor while typing; fades out once the line ends.
//
// Skips the animation entirely (just shows static text) if the user has
// the prefers-reduced-motion media query set.

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

const GREETING_LINES = [
  "Yo — I'm ADletic 👋",
  "Tell me what you want to create. A video. A poster. A storyboard. Anything.",
  "I'll pick the right AI model, ask for what I need, and run it for you.",
  "So — what are we building today?",
];

const SESSION_FLAG = "motionboards_adletic_greeted";

// Per-character delay (ms). Lower = faster typing.
const CHAR_DELAY_BASE = 22;
const CHAR_DELAY_JITTER = 35;
// Pause between lines.
const LINE_PAUSE = 380;

// Mechanical keyboard tactile click. Two layers per keystroke:
//   1. CLICK — short high-freq square burst (~3 kHz, 14 ms decay): the
//      sharp metal-spring click of a tactile switch.
//   2. THOCK — low sine thump (~170 Hz, 60 ms decay): the bottom-out
//      hit of the keycap on the plate.
// Frequencies jitter per keystroke so it doesn't sound like a metronome.
function playTick(ctxRef: React.MutableRefObject<AudioContext | null>) {
  try {
    if (typeof window === "undefined") return;
    if (!ctxRef.current) {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      if (!Ctor) return;
      ctxRef.current = new Ctor();
    }
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;

    // Layer 1: the click
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = "square";
    click.frequency.setValueAtTime(2700 + Math.random() * 800, now);
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.022, now + 0.001);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);
    click.connect(clickGain).connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.02);

    // Layer 2: the thock (slightly delayed so it reads as 'after' the click)
    const thock = ctx.createOscillator();
    const thockGain = ctx.createGain();
    thock.type = "sine";
    thock.frequency.setValueAtTime(150 + Math.random() * 60, now + 0.004);
    thockGain.gain.setValueAtTime(0.0001, now + 0.004);
    thockGain.gain.exponentialRampToValueAtTime(0.05, now + 0.008);
    thockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    thock.connect(thockGain).connect(ctx.destination);
    thock.start(now + 0.004);
    thock.stop(now + 0.07);
  } catch { /* never block typing on audio errors */ }
}

interface Props {
  isDark: boolean;
  onComplete?: () => void;
  // When true, render the full greeting instantly without animation.
  skipAnimation?: boolean;
}

export function AIGreetingCard({ isDark, onComplete, skipAnimation }: Props) {
  // Snapshot the "should animate" decision once on mount so re-renders
  // (caused by typing into the textarea below us) don't restart the
  // typewriter mid-stream.
  const animateRef = useRef<boolean | null>(null);
  if (animateRef.current === null) {
    let alreadySeen = false;
    if (typeof window !== "undefined") {
      try { alreadySeen = sessionStorage.getItem(SESSION_FLAG) === "true"; } catch {}
    }
    const reducedMotion = typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    animateRef.current = !skipAnimation && !alreadySeen && !reducedMotion;
  }
  const shouldAnimate = animateRef.current;

  const [lineIdx, setLineIdx] = useState(shouldAnimate ? 0 : GREETING_LINES.length);
  const [charIdx, setCharIdx] = useState(shouldAnimate ? 0 : 0);
  const [done, setDone] = useState(!shouldAnimate);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Mark the greeting as seen as soon as it starts, so a fast reload
  // doesn't replay it.
  useEffect(() => {
    if (!shouldAnimate) return;
    try { sessionStorage.setItem(SESSION_FLAG, "true"); } catch {}
  }, [shouldAnimate]);

  // Drive the typewriter. Each tick advances either one character or moves
  // to the next line after a brief pause.
  useEffect(() => {
    if (!shouldAnimate || done) return;
    if (lineIdx >= GREETING_LINES.length) {
      setDone(true);
      onComplete?.();
      return;
    }
    const line = GREETING_LINES[lineIdx];
    if (charIdx >= line.length) {
      const t = setTimeout(() => {
        setLineIdx((i) => i + 1);
        setCharIdx(0);
      }, LINE_PAUSE);
      return () => clearTimeout(t);
    }
    const ch = line.charAt(charIdx);
    // Slow down at punctuation for a more natural cadence
    const punctuation = ch === "." || ch === "," || ch === "?" || ch === "!";
    const delay = punctuation
      ? CHAR_DELAY_BASE + 200
      : CHAR_DELAY_BASE + Math.random() * CHAR_DELAY_JITTER;
    const t = setTimeout(() => {
      setCharIdx((c) => c + 1);
      // Mechanical keyboards click on every keystroke. Skip whitespace —
      // hitting space on most boards is much quieter than letter keys.
      if (ch.trim()) playTick(audioCtxRef);
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineIdx, charIdx, shouldAnimate, done]);

  // Build what's visible so far
  const renderedLines: string[] = [];
  for (let i = 0; i < lineIdx; i++) renderedLines.push(GREETING_LINES[i]);
  if (lineIdx < GREETING_LINES.length) {
    renderedLines.push(GREETING_LINES[lineIdx].slice(0, charIdx));
  }

  return (
    <div className="flex items-start gap-2.5 p-1">
      <div className="relative shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#f26522] to-[#ec4899] rounded-xl blur-md opacity-30" />
        <div className="relative h-8 w-8 rounded-xl bg-gradient-to-br from-[#f26522] to-[#ec4899] flex items-center justify-center ring-1 ring-white/20">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[11px] font-bold tracking-tight ${isDark ? "text-white" : "text-[#0d1117]"}`}>
            ADletic
          </span>
          <span className="text-[9px] font-medium text-green-500 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-green-500 animate-pulse" />
            live
          </span>
        </div>
        <div className={`text-[12.5px] leading-snug space-y-1 ${isDark ? "text-gray-200" : "text-[#0d1117]"}`}>
          {renderedLines.map((line, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {line}
              {!done && i === renderedLines.length - 1 && (
                <span className="inline-block w-[2px] h-[1em] -mb-[2px] ml-0.5 bg-[#f26522] animate-pulse align-middle" />
              )}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
