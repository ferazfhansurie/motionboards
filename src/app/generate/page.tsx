"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@/components/board/canvas";
import { MultiTabLockout } from "@/components/board/multi-tab-lockout";
import { Loader2 } from "lucide-react";
import { track } from "@/lib/track";
import { useAppStore, startTabHeartbeat, stopTabHeartbeat } from "@/lib/store";

export default function GeneratePage() {
  const [ready, setReady] = useState(false);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const setCanvasMounted = useAppStore((s) => s.setCanvasMounted);

  useEffect(() => {
    // Engaged-user signal. Separates "saw the ad → bounced" from
    // "saw the ad → opened the canvas". The general page_view already fires
    // from TrackImpressions in the root layout — this is the explicit
    // "canvas opened" event for funnel reporting.
    track("canvas_opened");

    // Check auth but don't redirect — let everyone use the canvas
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        // Store auth status globally for gating actions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__mb_user = data.user || null;
        setAuthedUserId(data?.user?.id || null);
      })
      .catch(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__mb_user = null;
      })
      .finally(() => setReady(true));
  }, []);

  // Single-tab session lock — the heartbeat (and the saveToDb gate that
  // depends on `canvasMounted`) is canvas-only. Visiting /media or other
  // pages doesn't take a slot, so the user can keep those open in as
  // many tabs as they want without seeing the multi-tab modal.
  useEffect(() => {
    if (!authedUserId) return;
    setCanvasMounted(true);
    startTabHeartbeat();
    return () => {
      stopTabHeartbeat();
      setCanvasMounted(false);
    };
  }, [authedUserId, setCanvasMounted]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <>
      <Canvas />
      <MultiTabLockout />
    </>
  );
}
