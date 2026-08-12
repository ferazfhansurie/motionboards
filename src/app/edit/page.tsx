"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { EditorWorkspace } from "@/components/edit/editor-workspace";
import { AIPromptPanel } from "@/components/board/ai-prompt-panel";
import { MultiTabLockout } from "@/components/board/multi-tab-lockout";
import { track } from "@/lib/track";
import { useAppStore, startTabHeartbeat, stopTabHeartbeat } from "@/lib/store";

// Dedicated AI video editor page — same account/board data as /generate,
// but a purpose-built editor layout (preview + timeline + chat) instead of
// the freeform moodboard canvas. Chat is docked open by default since this
// page's whole point is directing edits through Claude.
export default function EditPage() {
  const [ready, setReady] = useState(false);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const setCanvasMounted = useAppStore((s) => s.setCanvasMounted);
  const setAIPromptOpen = useAppStore((s) => s.setAIPromptOpen);

  useEffect(() => {
    track("editor_opened");
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
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

  useEffect(() => {
    setAIPromptOpen(true);
  }, [setAIPromptOpen]);

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
      <div className="flex h-screen items-center justify-center bg-[#0a0c10]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <>
      <EditorWorkspace />
      <AIPromptPanel variant="editor" />
      <MultiTabLockout />
    </>
  );
}
