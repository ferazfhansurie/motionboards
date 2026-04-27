"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@/components/board/canvas";
import { Loader2 } from "lucide-react";
import { fbqTrack } from "@/components/analytics/meta-pixel";

export default function GeneratePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Engaged-user signal. Separates "saw the ad → bounced" from
    // "saw the ad → opened the canvas". PageView already fires from the
    // root pixel; ViewContent here lets us optimise specifically toward
    // people who load the actual app.
    fbqTrack("ViewContent", { content_name: "Canvas", content_category: "app" });

    // Check auth but don't redirect — let everyone use the canvas
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        // Store auth status globally for gating actions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__mb_user = data.user || null;
      })
      .catch(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__mb_user = null;
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return <Canvas />;
}
