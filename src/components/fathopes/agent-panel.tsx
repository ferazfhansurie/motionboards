"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, Check, Plus, Wand2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { models } from "@/lib/models";
import { runGeneration } from "@/lib/fathopes-agent-gen";
import { showToast, updateToast } from "@/lib/ui-store";

const MEDIA_BASE = (process.env.NEXT_PUBLIC_FATHOPES_BASE || "").replace(/\/$/, "");
const mediaUrl = (src: string) => (MEDIA_BASE ? `${MEDIA_BASE}${src}` : src);

export interface AgentRef {
  id: string;
  src: string;   // R2 key-path
  name: string;
  type: "image" | "video";
}

export interface SavedItem {
  id: string; src: string; thumb: string; ratio: number;
  category: string; catSlug: string; type: "image" | "video"; name: string;
}

export interface LibraryItem {
  id: string; src: string; name: string; category: string; type: "image" | "video";
}

// Compact, grouped catalog of the whole gallery so the agent can recall items
// and use their public URLs directly as generation inputs.
function buildMediaContext(library: LibraryItem[]): string {
  if (!library.length) return "";
  const byCat = new Map<string, LibraryItem[]>();
  for (const it of library) {
    if (!byCat.has(it.category)) byCat.set(it.category, []);
    byCat.get(it.category)!.push(it);
  }
  const lines: string[] = [
    "## FATHOPES MEDIA LIBRARY (the user's gallery — you have full access)",
    "",
    "You are assisting inside the user's FatHopes media gallery (not the canvas). Their entire library is listed below, grouped by category. You CAN reference and recall any of it directly. When the user mentions media by description, name, or category (e.g. \"the river cleanup photo\", \"D.R. UP\", \"a Strand Mall shot\"), find the matching entry here and use its URL — pass it as input_image_url (images) or input_video_url (videos) to start_generation. You do NOT need the user to attach it manually. You may also answer questions about what's in the library.",
    "",
    `Total: ${library.length} items.`,
    "",
  ];
  for (const [cat, items] of byCat) {
    lines.push(`### ${cat} (${items.length})`);
    for (const it of items) lines.push(`- ${it.name} [${it.type}] ${mediaUrl(it.src)}`);
    lines.push("");
  }
  return lines.join("\n");
}

// Minimal message shapes matching /api/ai-prompt's contract.
type Part =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
type ApiMsg = { role: "user" | "assistant"; content: string | Part[] };

interface GenResult {
  status: "review" | "running" | "done" | "failed" | "cancelled";
  modelId: string;
  prompt: string;
  options?: Record<string, unknown>;
  inputImageUrl?: string;
  inputVideoUrl?: string;
  progress?: string;
  outputUrl?: string;
  outputType?: "image" | "video" | "audio";
  modelName?: string;
  error?: string;
  saved?: boolean;
}

async function readNDJSON(res: Response, onEvent: (e: Record<string, unknown>) => void) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (t) try { onEvent(JSON.parse(t)); } catch { /* skip */ }
    }
  }
  if (buf.trim()) try { onEvent(JSON.parse(buf.trim())); } catch { /* skip */ }
}

export function FathopesAgent({
  open, setOpen, references, setReferences, onSaved, library,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  references: AgentRef[];
  setReferences: (fn: (prev: AgentRef[]) => AgentRef[]) => void;
  onSaved: (item: SavedItem) => void;
  library: LibraryItem[];
}) {
  const { theme } = useAppStore();
  const isDark = theme === "dark";
  const c = isDark
    ? { bg: "#1c1712", line: "#2a231a", text: "#f4ece0", dim: "#9a8f7d", tile: "#221c14", bubble: "#2a231a" }
    : { bg: "#fff8ec", line: "#e7ddc9", text: "#0d1117", dim: "#8a7d68", tile: "#f0e6d4", bubble: "#f0e6d4" };
  const accent = "#f26522";

  const [history, setHistory] = useState<ApiMsg[]>([]);
  const [results, setResults] = useState<Record<string, GenResult>>({});
  const [streamingText, setStreamingText] = useState("");
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaContext = useMemo(() => buildMediaContext(library), [library]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, streamingText, results, open]);

  function setResult(id: string, patch: Partial<GenResult>) {
    setResults((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  // Run one round-trip to Claude with the current history; handle the streamed
  // text + any start_generation tool calls.
  async function runClaude(curHistory: ApiMsg[]) {
    setBusy(true);
    setStreamingText("");
    let text = "";
    const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = [];
    try {
      const res = await fetch("/api/ai-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: curHistory, mediaContext }),
      });
      if (res.status === 401) { setStreamingText(""); pushAssistant("Please log in to use the AI agent."); setBusy(false); return; }
      if (!res.ok || !res.body) { pushAssistant("The AI agent is unavailable right now."); setBusy(false); return; }

      await readNDJSON(res, (e) => {
        if (e.type === "text") { text += e.text as string; setStreamingText(text); }
        else if (e.type === "tool_use") toolUses.push({ id: e.id as string, name: e.name as string, input: (e.input as Record<string, unknown>) || {} });
        else if (e.type === "error") text += `\n\n_${e.message}_`;
      });
    } catch {
      pushAssistant("Something went wrong talking to the AI.");
      setBusy(false);
      return;
    }
    setStreamingText("");

    // Commit assistant message (text + any tool_use blocks).
    const content: Part[] = [];
    if (text.trim()) content.push({ type: "text", text });
    for (const t of toolUses) content.push({ type: "tool_use", id: t.id, name: t.name, input: t.input });
    const next = [...curHistory, { role: "assistant" as const, content: content.length ? content : [{ type: "text", text: "" } as Part] }];
    setHistory(next);

    const gen = toolUses.find((t) => t.name === "start_generation");
    if (gen) {
      const inp = gen.input as Record<string, unknown>;
      setResult(gen.id, {
        status: "review",
        modelId: String(inp.model_id || ""),
        prompt: String(inp.prompt || ""),
        options: (inp.options as Record<string, unknown>) || {},
        inputImageUrl: inp.input_image_url ? String(inp.input_image_url) : undefined,
        inputVideoUrl: inp.input_video_url ? String(inp.input_video_url) : undefined,
      });
      setBusy(false); // wait for user to approve the review card
    } else {
      setBusy(false);
    }
  }

  function pushAssistant(t: string) {
    setHistory((prev) => [...prev, { role: "assistant", content: [{ type: "text", text: t }] }]);
  }

  async function send() {
    const text = input.trim();
    if ((!text && references.length === 0) || busy) return;
    setInput("");

    const refNote = references.length
      ? `\n\n[Reference media the user attached — you may pass these URLs as input_image_url / input_video_url for i2i / i2v / s2e:\n${references.map((r) => `${r.type}: ${mediaUrl(r.src)}`).join("\n")}]`
      : "";
    const parts: Part[] = [{ type: "text", text: (text || "Use these references.") + refNote }];
    for (const r of references.filter((r) => r.type === "image")) {
      parts.push({ type: "image_url", image_url: { url: mediaUrl(r.src) } });
    }
    const next = [...history, { role: "user" as const, content: parts }];
    setHistory(next);
    setReferences(() => []);
    await runClaude(next);
  }

  async function approve(id: string) {
    const r = results[id];
    if (!r) return;
    setResult(id, { status: "running", progress: "Starting…" });
    setBusy(true);
    const out = await runGeneration(
      { modelId: r.modelId, prompt: r.prompt, options: r.options, inputImageUrl: r.inputImageUrl, inputVideoUrl: r.inputVideoUrl },
      (p) => setResult(id, { progress: p }),
    );
    setResult(id, {
      status: out.error ? "failed" : "done",
      outputUrl: out.outputUrl, outputType: out.outputType, modelName: out.modelName, error: out.error, progress: undefined,
    });
    const toolResult: Part = {
      type: "tool_result", tool_use_id: id,
      content: out.error ? `Generation failed: ${out.error}` : `Generation completed. Output URL: ${out.outputUrl}`,
      is_error: !!out.error,
    };
    const next: ApiMsg[] = [...history, { role: "user", content: [toolResult] }];
    setHistory(next);
    await runClaude(next);
  }

  async function cancel(id: string) {
    setResult(id, { status: "cancelled" });
    const toolResult: Part = { type: "tool_result", tool_use_id: id, content: "The user cancelled this generation." };
    const next: ApiMsg[] = [...history, { role: "user", content: [toolResult] }];
    setHistory(next);
    await runClaude(next);
  }

  async function saveToGallery(id: string) {
    const r = results[id];
    if (!r?.outputUrl || (r.outputType !== "image" && r.outputType !== "video")) return;
    const toastId = showToast("Saving to gallery…", { kind: "loading" });
    try {
      const res = await fetch("/api/fathopes/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: r.outputUrl, category: "AI Generations", type: r.outputType, name: `${r.modelName || "generation"}` }),
      });
      if (!res.ok) throw new Error();
      const { item } = await res.json();
      onSaved(item);
      setResult(id, { saved: true });
      updateToast(toastId, { kind: "success", message: "Saved to gallery." });
    } catch {
      updateToast(toastId, { kind: "error", message: "Save failed." });
    }
  }

  // ---- render ----
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[120] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
        style={{ background: accent, boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}
        title="AI agent"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-[120] flex w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
      style={{ background: c.bg, color: c.text, borderColor: c.line, height: "min(640px, calc(100vh - 2.5rem))" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: c.line }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: accent }}><Sparkles className="h-4 w-4" /></span>
        <div className="flex-1">
          <p className="text-[13px] font-bold leading-tight">ADletic AI</p>
          <p className="text-[11px] leading-tight" style={{ color: c.dim }}>Generate & use your media as references</p>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-full p-1.5" style={{ color: c.dim }}><X className="h-4 w-4" /></button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {history.length === 0 && !streamingText && (
          <div className="mt-6 text-center text-[13px]" style={{ color: c.dim }}>
            <Wand2 className="mx-auto mb-2 h-6 w-6" style={{ color: accent }} />
            I know your whole FatHopes library ({library.length} items).<br />Ask about it, or tell me what to make — I can pull any item in as a reference.
          </div>
        )}

        {history.map((m, mi) => {
          if (m.role === "user") {
            const parts = Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content } as Part];
            // skip pure tool_result messages (internal)
            if (parts.every((p) => p.type === "tool_result")) return null;
            const txt = parts.filter((p): p is Extract<Part, { type: "text" }> => p.type === "text").map((p) => p.text.split("\n\n[Reference media")[0]).join(" ");
            const imgs = parts.filter((p): p is Extract<Part, { type: "image_url" }> => p.type === "image_url");
            return (
              <div key={mi} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-[13px] text-white" style={{ background: accent }}>
                  {imgs.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {imgs.map((p, i) => <img key={i} src={p.image_url.url} alt="" className="h-12 w-12 rounded object-cover" />)}
                    </div>
                  )}
                  {txt && <span className="whitespace-pre-wrap">{txt}</span>}
                </div>
              </div>
            );
          }
          // assistant
          const parts = Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content } as Part];
          return (
            <div key={mi} className="space-y-2">
              {parts.map((p, pi) => {
                if (p.type === "text" && p.text.trim()) {
                  return (
                    <div key={pi} className="flex justify-start">
                      <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-sm px-3 py-2 text-[13px]" style={{ background: c.bubble }}>{p.text}</div>
                    </div>
                  );
                }
                if (p.type === "tool_use") {
                  const r = results[p.id];
                  if (!r) return null;
                  return <GenCard key={pi} r={r} c={c} accent={accent} onApprove={() => approve(p.id)} onCancel={() => cancel(p.id)} onEdit={(prompt) => setResult(p.id, { prompt })} onSave={() => saveToGallery(p.id)} />;
                }
                return null;
              })}
            </div>
          );
        })}

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-sm px-3 py-2 text-[13px]" style={{ background: c.bubble }}>{streamingText}</div>
          </div>
        )}
        {busy && !streamingText && (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: c.dim }}><Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…</div>
        )}
      </div>

      {/* Reference chips */}
      {references.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto border-t px-3 py-2" style={{ borderColor: c.line }}>
          {references.map((r) => (
            <div key={r.id} className="relative shrink-0">
              {r.type === "video" ? (
                <video src={mediaUrl(r.src)} muted className="h-12 w-12 rounded-md object-cover" style={{ background: c.tile }} />
              ) : (
                <img src={mediaUrl(r.src)} alt="" className="h-12 w-12 rounded-md object-cover" style={{ background: c.tile }} />
              )}
              <button onClick={() => setReferences((prev) => prev.filter((x) => x.id !== r.id))} className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-2.5 w-2.5" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t p-2" style={{ borderColor: c.line }}>
        <div className="flex items-end gap-2 rounded-xl px-2 py-1.5" style={{ background: c.tile }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder={references.length ? "What should I do with these?" : "Make an image of…"}
            className="max-h-28 flex-1 resize-none bg-transparent text-[13px] outline-none"
            style={{ color: c.text }}
          />
          <button onClick={send} disabled={busy} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-50" style={{ background: accent }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function GenCard({
  r, c, accent, onApprove, onCancel, onEdit, onSave,
}: {
  r: GenResult;
  c: { line: string; text: string; dim: string; tile: string; bubble: string };
  accent: string;
  onApprove: () => void; onCancel: () => void; onEdit: (p: string) => void; onSave: () => void;
}) {
  const modelName = models.find((m) => m.id === r.modelId)?.name || r.modelId;
  return (
    <div className="rounded-xl border p-2.5 text-[12px]" style={{ borderColor: c.line, background: c.tile }}>
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold" style={{ color: accent }}><Wand2 className="h-3.5 w-3.5" /> {modelName}</div>

      {r.status === "review" ? (
        <>
          <textarea
            value={r.prompt}
            onChange={(e) => onEdit(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border bg-transparent p-1.5 text-[12px] outline-none"
            style={{ borderColor: c.line, color: c.text }}
          />
          <div className="mt-2 flex gap-1.5">
            <button onClick={onApprove} className="flex-1 rounded-md py-1.5 font-semibold text-white" style={{ background: accent }}>Generate</button>
            <button onClick={onCancel} className="rounded-md border px-3 py-1.5 font-medium" style={{ borderColor: c.line, color: c.text }}>Cancel</button>
          </div>
        </>
      ) : r.status === "running" ? (
        <div className="flex items-center gap-2 py-2" style={{ color: c.dim }}><Loader2 className="h-4 w-4 animate-spin" /> {r.progress || "Working…"}</div>
      ) : r.status === "cancelled" ? (
        <p style={{ color: c.dim }}>Cancelled.</p>
      ) : r.status === "failed" ? (
        <p style={{ color: "#dc2626" }}>{r.error || "Generation failed."}</p>
      ) : (
        <>
          {r.outputType === "video" ? (
            <video src={r.outputUrl} controls className="w-full rounded-md" />
          ) : r.outputType === "audio" ? (
            <audio src={r.outputUrl} controls className="w-full" />
          ) : (
            <img src={r.outputUrl} alt="" className="w-full rounded-md" />
          )}
          {(r.outputType === "image" || r.outputType === "video") && (
            <button
              onClick={onSave}
              disabled={r.saved}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 font-semibold disabled:opacity-70"
              style={{ background: r.saved ? c.bubble : accent, color: r.saved ? c.text : "#fff" }}
            >
              {r.saved ? <><Check className="h-3.5 w-3.5" /> Saved to gallery</> : <><Plus className="h-3.5 w-3.5" /> Save to gallery</>}
            </button>
          )}
        </>
      )}
    </div>
  );
}
