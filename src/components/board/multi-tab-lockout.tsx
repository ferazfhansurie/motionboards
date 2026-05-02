"use client";

import { useEffect, useState } from "react";
import { Loader2, Monitor, RefreshCw } from "lucide-react";
import { useAppStore, takeOverTabLock } from "@/lib/store";

// Full-screen blocking overlay shown when another tab/device owns the
// session lock. Two reasons it exists:
//
// 1. Two tabs both autosaving every 2s = last writer wins, silently. People
//    were losing whole sessions to this — wake up the next day, see an
//    older state, no checkpoint to recover from because every checkpoint
//    had already deduped against the stale state.
// 2. The user explicitly asked: "1 tab for 1 account is available, if it
//    detects multiple logins then show a popout that can only be removed
//    by closing the other tab and refresh."
//
// Detection happens in store.ts via /api/active-tab heartbeats every 5s
// plus an instant BroadcastChannel signal for same-browser tabs.
export function MultiTabLockout() {
  const lockout = useAppStore((s) => s.multiTabLockout);
  const takeoverInProgress = useAppStore((s) => s.takeoverInProgress);
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === "dark";
  const [secondsSinceDetected, setSecondsSinceDetected] = useState(0);

  useEffect(() => {
    if (!lockout) return;
    setSecondsSinceDetected(Math.floor((Date.now() - lockout.detectedAt) / 1000));
    const id = setInterval(() => {
      setSecondsSinceDetected(Math.floor((Date.now() - lockout.detectedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lockout]);

  if (!lockout) return null;

  const handleTakeOver = async () => {
    const ok = await takeOverTabLock();
    if (!ok) {
      // Force-claim should always succeed unless the network is down.
      // Don't dismiss — the next heartbeat will retry naturally.
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center backdrop-blur-md ${
        isDark ? "bg-black/70" : "bg-black/50"
      }`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="multi-tab-lockout-title"
    >
      <div
        className={`mx-4 w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
          isDark
            ? "border-white/10 bg-zinc-900 text-white"
            : "border-black/10 bg-white text-zinc-900"
        }`}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700"
            }`}
          >
            <Monitor className="h-5 w-5" />
          </div>
          <h2 id="multi-tab-lockout-title" className="text-lg font-semibold">
            MotionBoards is open elsewhere
          </h2>
        </div>

        <p className={`mb-3 text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
          You&apos;re signed in on another tab or device, and only one session can edit at a
          time — otherwise saves from the two windows fight each other and your work disappears.
        </p>

        <p className={`mb-4 text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
          Close the other tab/device, then refresh this page to continue. Or take over the
          session here — the other window will lock when it next checks in (within 5 seconds).
        </p>

        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-xs ${
            isDark ? "border-white/10 bg-white/5 text-zinc-400" : "border-black/10 bg-black/5 text-zinc-500"
          }`}
        >
          <div>
            Other session active{" "}
            <span className="tabular-nums">{secondsSinceDetected}s</span> ago
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleTakeOver}
            disabled={takeoverInProgress}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isDark
                ? "bg-white text-zinc-900 hover:bg-zinc-200"
                : "bg-zinc-900 text-white hover:bg-zinc-700"
            }`}
          >
            {takeoverInProgress ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Taking over...
              </>
            ) : (
              <>Take over here</>
            )}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition ${
              isDark
                ? "border-white/15 text-white hover:bg-white/10"
                : "border-black/15 text-zinc-900 hover:bg-black/5"
            }`}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
