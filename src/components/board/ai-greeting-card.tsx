"use client";

// ADletic onboarding — short, two-step interactive flow:
//
//   1. ADletic types "Yo — what should I call you?" → name input.
//   2. Then "Nice. What brings you here, <name>?" → 4 use-case chips.
//   3. Goal-tailored closer + "What are we making today?".
//
// Captured values persist (mb_user_name, mb_user_goal). Returning users
// with both stored just see "Welcome back, <name>. What are we making
// today?" — single line, no inputs.
//
// Mechanical-keyboard tick on every non-whitespace character. Audio is
// unlocked by the user clicking the AI Agent toggle (or any prior gesture)
// before this card mounts, so the AudioContext can resume freely.
//
// Animation gated by a session flag so the typewriter only plays once per
// tab — re-renders show the full text instantly. If the tab is refreshed
// mid-flow, the input/chips for the current stage render immediately.

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

const NAME_STORAGE_KEY = "mb_user_name";
const GOAL_STORAGE_KEY = "mb_user_goal";
const SESSION_FLAG = "motionboards_adletic_greeted";

const CHAR_DELAY_BASE = 22;
const CHAR_DELAY_JITTER = 35;
const LINE_PAUSE = 320;

type Goal = "ads" | "social" | "storyboard" | "explore";

const GOAL_OPTIONS: { id: Goal; label: string }[] = [
  { id: "ads", label: "Ads" },
  { id: "social", label: "Social posts" },
  { id: "storyboard", label: "Storyboards" },
  { id: "explore", label: "Just exploring" },
];

const GOAL_PITCH: Record<Goal, string> = {
  ads: "Sweet — products and ad concepts are my thing.",
  social: "Solid — reels, posts, all of it.",
  storyboard: "Love that — I'll lay out scenes frame by frame.",
  explore: "Cool — take it for a spin.",
};

function isGoal(g: string): g is Goal {
  return g === "ads" || g === "social" || g === "storyboard" || g === "explore";
}

// Mechanical keyboard tactile click — sharp metal click + low keycap thock.
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
  skipAnimation?: boolean;
}

type Stage =
  | "asking_name"
  | "awaiting_name"
  | "asking_goal"
  | "awaiting_goal"
  | "saying_hi";

export function AIGreetingCard({ isDark, skipAnimation }: Props) {
  // Read existing name + goal once on mount so we can pick up mid-flow.
  const initialNameRef = useRef<string | null>(null);
  const initialGoalRef = useRef<string | null>(null);
  if (initialNameRef.current === null) {
    if (typeof window !== "undefined") {
      try { initialNameRef.current = localStorage.getItem(NAME_STORAGE_KEY) || ""; } catch { initialNameRef.current = ""; }
    } else {
      initialNameRef.current = "";
    }
  }
  if (initialGoalRef.current === null) {
    if (typeof window !== "undefined") {
      try { initialGoalRef.current = localStorage.getItem(GOAL_STORAGE_KEY) || ""; } catch { initialGoalRef.current = ""; }
    } else {
      initialGoalRef.current = "";
    }
  }
  const hasNameOnMount = !!initialNameRef.current;
  const hasGoalOnMount = !!initialGoalRef.current && isGoal(initialGoalRef.current);

  // Snapshot animate decision once so re-renders don't replay the typewriter.
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

  const [name, setName] = useState<string>(initialNameRef.current || "");
  const [goal, setGoal] = useState<Goal | "">(
    isGoal(initialGoalRef.current || "") ? (initialGoalRef.current as Goal) : "",
  );
  // Initial stage: returning users with both stored skip to the welcome
  // line; partial-state visitors resume at the next missing step. When the
  // typewriter is suppressed (refresh mid-flow / reduced motion), jump
  // directly to the awaiting stage so the input/chips render right away.
  const [stage, setStage] = useState<Stage>(() => {
    if (hasNameOnMount && hasGoalOnMount) return "saying_hi";
    if (shouldAnimate) {
      return hasNameOnMount ? "asking_goal" : "asking_name";
    }
    return hasNameOnMount ? "awaiting_goal" : "awaiting_name";
  });
  const [nameInput, setNameInput] = useState("");

  // Build the line list for the current stage. Awaiting stages keep the
  // previous question visible so the input/chips appear with context.
  const lines = (() => {
    if (stage === "asking_name" || stage === "awaiting_name") {
      return ["Yo — what should I call you?"];
    }
    if (stage === "asking_goal" || stage === "awaiting_goal") {
      return [`Nice. What brings you here${name ? `, ${name}` : ""}?`];
    }
    if (stage === "saying_hi") {
      if (hasNameOnMount && hasGoalOnMount) {
        return [`Welcome back, ${name}. What are we making today?`];
      }
      if (goal && isGoal(goal)) {
        return [GOAL_PITCH[goal], "What are we making today?"];
      }
      return [`Nice — let's go, ${name}.`, "What are we making today?"];
    }
    return [] as string[];
  })();

  const [lineIdx, setLineIdx] = useState(shouldAnimate ? 0 : lines.length);
  const [charIdx, setCharIdx] = useState(0);
  const [linesDone, setLinesDone] = useState(!shouldAnimate);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Mark greeting seen once it starts so a fast reload doesn't replay.
  useEffect(() => {
    if (!shouldAnimate) return;
    try { sessionStorage.setItem(SESSION_FLAG, "true"); } catch {}
  }, [shouldAnimate]);

  // Reset typewriter cursors on transitions to "asking_*" / "saying_hi".
  // Awaiting stages keep cursors at the end of the previous question so
  // the typewriter doesn't replay the line under the input/chips.
  useEffect(() => {
    if (!shouldAnimate) {
      setLineIdx(lines.length);
      setLinesDone(true);
      return;
    }
    if (stage === "awaiting_name" || stage === "awaiting_goal") return;
    setLineIdx(0);
    setCharIdx(0);
    setLinesDone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Drive the typewriter for the current `lines`.
  useEffect(() => {
    if (!shouldAnimate || linesDone) return;
    if (lineIdx >= lines.length) {
      setLinesDone(true);
      // Hand off to next interactive stage once typing finishes.
      if (stage === "asking_name") setStage("awaiting_name");
      else if (stage === "asking_goal") setStage("awaiting_goal");
      // saying_hi stays — terminal.
      return;
    }
    const line = lines[lineIdx];
    if (charIdx >= line.length) {
      const t = setTimeout(() => {
        setLineIdx((i) => i + 1);
        setCharIdx(0);
      }, LINE_PAUSE);
      return () => clearTimeout(t);
    }
    const ch = line.charAt(charIdx);
    const punctuation = ch === "." || ch === "," || ch === "?" || ch === "!";
    const delay = punctuation
      ? CHAR_DELAY_BASE + 200
      : CHAR_DELAY_BASE + Math.random() * CHAR_DELAY_JITTER;
    const t = setTimeout(() => {
      setCharIdx((c) => c + 1);
      if (ch.trim()) playTick(audioCtxRef);
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineIdx, charIdx, shouldAnimate, linesDone, stage]);

  const submitName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try { localStorage.setItem(NAME_STORAGE_KEY, trimmed); } catch {}
    setName(trimmed);
    setNameInput("");
    setStage(shouldAnimate ? "asking_goal" : "awaiting_goal");
  };

  const submitGoal = (g: Goal) => {
    try { localStorage.setItem(GOAL_STORAGE_KEY, g); } catch {}
    setGoal(g);
    setStage("saying_hi");
  };

  // Build visible text up to current cursor. Math.min guards against a
  // brief render where lineIdx is stale relative to a shrinking lines array
  // during stage transitions.
  const renderedLines: string[] = [];
  for (let i = 0; i < Math.min(lineIdx, lines.length); i++) renderedLines.push(lines[i]);
  if (lineIdx < lines.length) renderedLines.push(lines[lineIdx].slice(0, charIdx));

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
              {!linesDone && i === renderedLines.length - 1 && (
                <span className="inline-block w-[2px] h-[1em] -mb-[2px] ml-0.5 bg-[#f26522] animate-pulse align-middle" />
              )}
            </p>
          ))}
        </div>

        {/* Step 1 — name capture */}
        {stage === "awaiting_name" && (
          <form
            onSubmit={(e) => { e.preventDefault(); submitName(); }}
            className="mt-2 pointer-events-auto flex items-center gap-2"
          >
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name…"
              maxLength={40}
              className={`flex-1 text-[12.5px] rounded-lg px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-[#f26522]/20 transition-all ${isDark ? "bg-[#161b22] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-200 text-[#0d1117] placeholder-gray-400"}`}
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className={`text-[11px] font-semibold rounded-lg px-3 py-1.5 transition-colors ${
                nameInput.trim()
                  ? "bg-[#f26522] text-white hover:bg-[#d9541a]"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Save
            </button>
          </form>
        )}

        {/* Step 2 — use-case chips */}
        {stage === "awaiting_goal" && (
          <div className="mt-2 pointer-events-auto flex flex-wrap gap-1.5">
            {GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => submitGoal(opt.id)}
                className={`text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors ${
                  isDark
                    ? "bg-[#161b22] border-gray-700 text-gray-200 hover:bg-[#1f2630] hover:border-[#f26522]/40"
                    : "bg-white border-gray-200 text-[#0d1117] hover:bg-[#fff5ee] hover:border-[#f26522]/40"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
