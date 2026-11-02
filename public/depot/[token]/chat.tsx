"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { id: number; job_id: string | null; role: "user" | "bot"; author: string | null; text: string | null; media_url: string | null; created_at: string };
type Job = { id: string; status: string; previewUrl: string | null; driveUrl: string | null };
type State = { site: { code: string; name: string; limit: number; usedToday: number }; messages: Msg[]; jobs: Job[]; workerOnline: boolean };

const STATUS: Record<string, [string, string]> = {
  queued: ["Waiting to edit", "#8a6d00"], working: ["Editing…", "#0a6fb5"], preview: ["Preview ready", "#0a9b4a"],
  pending: ["Waiting for Faeez", "#8a6d00"], approved: ["Approved, uploading", "#0a6fb5"], publishing: ["Uploading to Drive", "#0a6fb5"],
  done: ["Done ✓", "#0a9b4a"], failed: ["Problem, see message", "#c62828"], rejected: ["Changes asked", "#8a6d00"],
};
const SUGGEST = ["Add captions", "Add captions in BM", "Add captions in English", "Add title at the start: "];
const time = (s: string) => new Date(s).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

export default function DepotChat({ token, code, siteName }: { token: string; code: string; siteName: string }) {
  const [data, setData] = useState<State | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastCount = useRef(0);

  useEffect(() => { setName(localStorage.getItem("depot-name") || ""); }, []);

  const load = useCallback(async () => {
    const r = await fetch(`/api/depot/${token}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [token]);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    const n = data?.messages.length ?? 0;
    if (n !== lastCount.current) { lastCount.current = n; endRef.current?.scrollIntoView({ behavior: "smooth" }); }
  }, [data]);

  async function post(body: Record<string, unknown>) {
    const r = await fetch(`/api/depot/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...body }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Something went wrong");
    await load();
  }

  async function send() {
    setErr("");
    if (!file && !text.trim()) return;
    try {
      let videoUrl: string | undefined;
      if (file) {
        const p = await fetch(`/api/depot/${token}/presign`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type || "video/mp4", size: file.size }) });
        const pj = await p.json();
        if (!p.ok) throw new Error(pj.error || "Upload failed");
        setProgress(0);
        await new Promise<void>((res, rej) => {
          const x = new XMLHttpRequest();
          x.open("PUT", pj.uploadUrl);
          x.setRequestHeader("Content-Type", file.type || "video/mp4");
          x.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
          x.onload = () => (x.status < 300 ? res() : rej(new Error("Upload failed, please try again")));
          x.onerror = () => rej(new Error("Upload failed, check your internet and try again"));
          x.send(file);
        });
        videoUrl = pj.publicUrl;
      }
      await post({ text, videoUrl });
      setText(""); setFile(null); if (fileRef.current) fileRef.current.value = "";
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setProgress(null); }
  }

  if (name === null) return null;
  if (!name) return (
    <div style={{ minHeight: "100dvh", background: "#eef2ee", color: "#14181f" }} className="flex items-center justify-center p-6">
      <form onSubmit={(e) => { e.preventDefault(); const n = nameDraft.trim(); if (n) { localStorage.setItem("depot-name", n); setName(n); } }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <img src="/depot/fathopes-logo-white.png" alt="" className="mb-4 h-8 rounded bg-[#0a9b4a] p-1.5" />
        <h1 className="text-xl font-bold">Video Bot · {code}</h1>
        <p className="mt-1 text-sm text-[#5b6573]">Send a video, tell me what to add, and I&apos;ll edit it for you.</p>
        <label className="mt-5 block text-sm font-semibold">What&apos;s your name?</label>
        <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="e.g. Ahmad"
          className="mt-1.5 w-full rounded-xl border border-[#d5dbd5] px-4 py-3 text-base outline-none focus:border-[#0a9b4a]" />
        <button className="mt-4 w-full rounded-xl bg-[#0a9b4a] py-3 font-bold text-white">Start</button>
      </form>
    </div>
  );

  const jobs = new Map((data?.jobs ?? []).map((j) => [j.id, j]));
  const lastMediaBot = new Map<string, number>();
  for (const m of data?.messages ?? []) if (m.role === "bot" && m.media_url && m.job_id) lastMediaBot.set(m.job_id, m.id);

  return (
    <div style={{ height: "100dvh", background: "#eef2ee", color: "#14181f" }} className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center gap-3 bg-[#0a9b4a] px-4 py-3 text-white shadow">
        <img src="/depot/fathopes-logo-white.png" alt="FatHopes" className="h-7" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight">Video Bot · {code}</div>
          <div className="flex items-center gap-1.5 text-xs opacity-90">
            <span className={`inline-block h-2 w-2 rounded-full ${data?.workerOnline ? "bg-[#b6f5c9]" : "bg-[#ffb4a8]"}`} />
            {data?.workerOnline ? "Editor online" : "Editor offline, videos wait in line"}
          </div>
        </div>
        {data && <div className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">{data.site.usedToday}/{data.site.limit} today</div>}
      </header>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-4">
        <Bubble role="bot">Hi {name}! 👋 Send me a video and tell me what to add: <b>captions</b> (I write what people say) or <b>text</b> like a title. I&apos;ll send you a preview, then Faeez approves it and you get a Google Drive link.</Bubble>
        {data?.messages.map((m) => {
          const job = m.job_id ? jobs.get(m.job_id) : undefined;
          const showActions = job && lastMediaBot.get(job.id) === m.id && ["preview", "rejected"].includes(job.status);
          return (
            <Bubble key={m.id} role={m.role} author={m.role === "user" ? m.author : null} at={m.created_at}>
              {m.media_url && <video src={m.media_url} controls playsInline preload="metadata" className="mb-1.5 max-h-[60vh] w-full rounded-lg bg-black" />}
              {m.text && <LinkText text={m.text} />}
              {job && m.role === "bot" && m.media_url && (
                <div className="mt-1.5 text-xs font-semibold" style={{ color: STATUS[job.status]?.[1] }}>● {STATUS[job.status]?.[0] ?? job.status}</div>
              )}
              {showActions && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <button onClick={() => post({ action: "submit", jobId: job.id }).catch((e) => setErr(e.message))}
                    className="rounded-lg bg-[#0a9b4a] px-3 py-2.5 text-sm font-bold text-white">✅ Looks good, send to Faeez</button>
                  <div className="text-center text-xs text-[#5b6573]">Need a change? Type it below, e.g. &quot;make text bigger&quot;</div>
                </div>
              )}
            </Bubble>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-[#d5dbd5] bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5">
        {err && <div className="mb-2 rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[#c62828]">{err}</div>}
        {file && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#eaf8ef] px-3 py-2 text-sm">
            <span>🎬</span><span className="min-w-0 flex-1 truncate font-semibold">{file.name}</span>
            <span className="text-xs text-[#5b6573]">{(file.size / 1048576).toFixed(0)} MB</span>
            {progress === null && <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="px-1 text-[#5b6573]">✕</button>}
          </div>
        )}
        {progress !== null && (
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-[#e3e8e3]"><div className="h-full bg-[#0a9b4a] transition-all" style={{ width: `${progress}%` }} /></div>
        )}
        {file && !text && progress === null && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGEST.map((s) => <button key={s} onClick={() => setText(s)} className="rounded-full border border-[#0a9b4a] px-3 py-1 text-xs font-semibold text-[#0a7a3a]">{s.replace(/: $/, "…")}</button>)}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button onClick={() => fileRef.current?.click()} disabled={progress !== null} aria-label="Attach video"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eaf8ef] text-xl">📎</button>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={file ? "What should I add?" : "Type a message"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-[#d5dbd5] px-4 py-2.5 text-base outline-none focus:border-[#0a9b4a]" />
          <button onClick={send} disabled={progress !== null || (!file && !text.trim())} aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0a9b4a] text-lg font-bold text-white disabled:opacity-40">➤</button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, author, at, children }: { role: "user" | "bot"; author?: string | null; at?: string; children: React.ReactNode }) {
  const me = role === "user";
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-sm ${me ? "rounded-br-md bg-[#d4f5dd]" : "rounded-bl-md bg-white"}`}>
        {author && <div className="mb-0.5 text-xs font-bold text-[#0a7a3a]">{author}</div>}
        {children}
        {at && <div className="mt-1 text-right text-[11px] text-[#7d8794]">{time(at)}</div>}
      </div>
    </div>
  );
}

function LinkText({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words">
      {text.split(/(https?:\/\/\S+)/g).map((p, i) =>
        /^https?:\/\//.test(p)
          ? <a key={i} href={p} target="_blank" rel="noreferrer" className="font-semibold text-[#0a6fb5] underline">{p.includes("drive.google.com") ? "▶ Open video in Google Drive" : p}</a>
          : <span key={i}>{p}</span>)}
    </div>
  );
}
