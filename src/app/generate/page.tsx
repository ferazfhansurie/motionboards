"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@/components/board/canvas";
import { Loader2 } from "lucide-react";

export default function GeneratePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
