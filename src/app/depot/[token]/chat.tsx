"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Styled after BOS Bot's chat: Inter, plain agent text with an avatar, grey
// bubble for the person, one rounded composer. FatHopes green is the accent.

type Msg = { id: number; job_id: string | null; role: "user" | "bot"; author: string | null; text: string | null; media_url: string | null; created_at: string };
type Job = { id: string; status: string; previewUrl: string | null; driveUrl: string | null };
type State = {
  site: { code: string; name: string; limit: number; usedToday: number };
  user: { name: string; phone: string } | null;
  messages: Msg[]; jobs: Job[]; workerOnline: boolean;
};

const GREEN = "#0a9b4a";
const INK = "#202225";
const MUTED = "#6b7078";
const PEARL = "#f3f4f6";
const FONT = 'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

const STATUS: Record<string, [string, string]> = {
  queued: ["Waiting to edit", "#8a6d00"], working: ["Editing", "#0a6fb5"], preview: ["Preview ready", GREEN],
  pending: ["Waiting for Faeez", "#8a6d00"], approved: ["Approved, uploading", "#0a6fb5"], publishing: ["Uploading to Drive", "#0a6fb5"],
  done: ["Done", GREEN], failed: ["Problem, see message", "#c62828"], rejected: ["Changes asked", "#8a6d00"],
};
// what the bot is busy with, shown as "typing"
const BUSY: Record<string, string> = {
  queued: "Waiting for the editor", working: "Editing your video", approved: "Uploading to Google Drive", publishing: "Uploading to Google Drive",
};
const SUGGEST = ["Add captions", "Add captions in BM", "Add captions in English", "Add title at the start: "];
const time = (s: string) => new Date(s).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

export default function DepotChat({ token, code }: { token: string; code: string; siteName: string }) {
  const [data, setData] = useState<State | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const lastKey = useRef("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/depot/${token}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [token]);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  const jobs = new Map((data?.jobs ?? []).map((j) => [j.id, j]));
  const busyJob = (data?.jobs ?? []).find((j) => BUSY[j.status]);
  const typing = sending !== null || !!busyJob;
  const typingLabel = sending !== null ? (progress !== null && progress < 100 ? `Uploading your video… ${progress}%` : "Typing") : busyJob ? BUSY[busyJob.status] : "";

  useEffect(() => {
    const key = `${data?.messages.length ?? 0}|${typing}|${sending ?? ""}`;
    if (key !== lastKey.current) { lastKey.current = key; endRef.current?.scrollIntoView({ behavior: "smooth" }); }
  }, [data, typing, sending]);

  // grow the composer with its text
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [text]);

  async function post(body: Record<string, unknown>) {
    const r = await fetch(`/api/depot/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Something went wrong");
    await load();
  }

  async function send() {
    setErr("");
    const msg = text.trim();
    if (!file && !msg) return;
    setSending(msg || (file ? "🎬 " + file.name : ""));
    setText("");
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
      await post({ text: msg, videoUrl });
      setFile(null); if (fileRef.current) fileRef.current.value = "";
    } catch (e) { setText(msg); setErr(e instanceof Error ? e.message : String(e)); }
    finally { setProgress(null); setSending(null); }
  }

  async function logout() {
    await fetch(`/api/depot/${token}/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setMenu(false); await load();
  }

  if (!data) return <div style={{ minHeight: "100dvh", background: "#fff" }} />;
  if (!data.user) return <Auth token={token} code={code} siteName={data.site.name} onDone={load} />;

  const lastMediaBot = new Map<string, number>();
  for (const m of data.messages) if (m.role === "bot" && m.media_url && m.job_id) lastMediaBot.set(m.job_id, m.id);
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  return (
    <div style={{ height: "100dvh", background: "#fff", color: INK, fontFamily: FONT }} className="mx-auto flex max-w-2xl flex-col">
      <header className="relative flex items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: "#e8e9ec" }}>
        <img src="/depot/avatar.png" alt="" className="h-9 w-9 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight">Video Bot · {data.site.code}</div>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: MUTED }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: data.workerOnline ? "#22c55e" : "#f59e0b" }} />
            {typing ? <span style={{ color: GREEN }}>{typingLabel.toLowerCase()}…</span> : data.workerOnline ? "Online" : "Editor offline, videos wait in line"}
          </div>
        </div>
        <div className="rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: PEARL, color: MUTED }}>{data.site.usedToday}/{data.site.limit} today</div>
        <button onClick={() => setMenu((m) => !m)} aria-label="Account" className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ background: INK }}>
          {data.user.name.slice(0, 1).toUpperCase()}
        </button>
        {menu && (
          <div className="absolute right-3 top-14 z-20 w-56 rounded-xl border bg-white p-1.5 text-sm shadow-lg" style={{ borderColor: "#e8e9ec" }}>
            <div className="px-3 py-2"><div className="font-semibold">{data.user.name}</div><div className="text-xs" style={{ color: MUTED }}>+{data.user.phone} · {data.site.code}</div></div>
            <button onClick={logout} className="w-full rounded-lg px-3 py-2 text-left font-medium hover:bg-[#f3f4f6]" style={{ color: "#c62828" }}>Log out</button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5" onClick={() => setMenu(false)}>
        <div className="flex flex-col gap-[14px]">
          <Bot>
            <Text text={`Hi ${data.user.name}! 👋\n\nSend me a video and tell me what to add:\n• **Captions**: I write what people say\n• **Text**: like a title at the start\n\nI'll send you a preview first. Then Faeez approves it and you get a Google Drive link.`} />
          </Bot>
          {data.messages.map((m) => {
            const job = m.job_id ? jobs.get(m.job_id) : undefined;
            const showActions = job && lastMediaBot.get(job.id) === m.id && ["preview", "rejected"].includes(job.status);
            const media = m.media_url && <video src={m.media_url} controls playsInline preload="metadata" className="mb-2 max-h-[60vh] w-full max-w-[320px] rounded-xl bg-black" />;
            if (m.role === "user") return (
              <Human key={m.id} at={m.created_at}>{media}{m.text && <Text text={m.text} />}</Human>
            );
            return (
              <Bot key={m.id} at={m.created_at}>
                {media}
                {m.text && <Text text={m.text} />}
                {job && m.media_url && (
                  <div className="mt-1.5 text-[12px] font-medium" style={{ color: STATUS[job.status]?.[1] }}>● {STATUS[job.status]?.[0] ?? job.status}</div>
                )}
                {showActions && (
                  <div className="mt-2.5 flex max-w-[320px] flex-col gap-1.5">
                    <button onClick={() => post({ action: "submit", jobId: job.id }).catch((e) => setErr(e.message))}
                      className="rounded-xl px-3 py-2.5 text-sm font-semibold text-white" style={{ background: GREEN }}>✅ Looks good, send to Faeez</button>
                    <div className="text-center text-[12px]" style={{ color: MUTED }}>Need a change? Type it below, e.g. &quot;make text bigger&quot;</div>
                  </div>
                )}
              </Bot>
            );
          })}
          {sending !== null && sending !== "" && <Human>{<Text text={sending} />}</Human>}
          {typing && <Bot><Typing label={typingLabel} /></Bot>}
        </div>
        <div ref={endRef} className="h-1" />
      </div>

      <div className="px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1">
        {err && <div className="mb-2 rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#c62828]">{err}</div>}
        {file && !text && progress === null && sending === null && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGEST.map((s) => <button key={s} onClick={() => { setText(s); boxRef.current?.focus(); }} className="rounded-full border px-3 py-1.5 text-[13px] font-medium" style={{ borderColor: "#d9dce1", color: INK }}>{s.replace(/: $/, "…")}</button>)}
          </div>
        )}
        <div className="rounded-[22px] border bg-white px-3 pb-2 pt-2.5 shadow-[0_1px_6px_rgba(0,0,0,.06)]" style={{ borderColor: "#d9dce1" }}>
          {file && (
            <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: PEARL }}>
              <span>🎬</span><span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
              <span className="text-xs" style={{ color: MUTED }}>{(file.size / 1048576).toFixed(0)} MB</span>
              {sending === null && <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="px-1" style={{ color: MUTED }} aria-label="Remove video">✕</button>}
            </div>
          )}
          {progress !== null && (
            <div className="mb-2 h-1.5 overflow-hidden rounded-full" style={{ background: PEARL }}><div className="h-full transition-all" style={{ width: `${progress}%`, background: GREEN }} /></div>
          )}
          <textarea ref={boxRef} value={text} onChange={(e) => setText(e.target.value)} rows={1}
            placeholder={file ? "What should I add?" : "Message Video Bot"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !touch) { e.preventDefault(); send(); } }}
            className="block w-full resize-none bg-transparent px-1 text-[16px] leading-[1.45] outline-none placeholder:text-[#9a9da2]" />
          <div className="mt-1.5 flex items-center justify-between">
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => fileRef.current?.click()} disabled={sending !== null} aria-label="Attach video"
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium" style={{ background: PEARL, color: INK }}>
              <span className="text-base">📎</span> Video
            </button>
            <button onClick={send} disabled={sending !== null || (!file && !text.trim())} aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white disabled:opacity-30" style={{ background: GREEN }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes dvb{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}`}</style>
    </div>
  );
}

function Bot({ at, children }: { at?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <img src="/depot/avatar.png" alt="" className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 text-[15px] leading-[1.55]">
        {children}
        {at && <div className="mt-1 text-[11px]" style={{ color: "#9a9da2" }}>{time(at)}</div>}
      </div>
    </div>
  );
}

function Human({ at, children }: { at?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end pl-11">
      <div className="max-w-full rounded-2xl px-3.5 py-2.5 text-[15px] leading-[1.5]" style={{ background: PEARL }}>{children}</div>
      {at && <div className="mt-1 text-[11px]" style={{ color: "#9a9da2" }}>{time(at)}</div>}
    </div>
  );
}

function Typing({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-[13px]" style={{ color: MUTED }}>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => <span key={i} className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: MUTED, animation: `dvb 1.2s ${i * 0.15}s infinite ease-in-out` }} />)}
      </span>
      {label}…
    </div>
  );
}

// line breaks kept, **bold** and links rendered
function Text({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words">
      {text.split(/(https?:\/\/\S+|\*\*[^*\n]+\*\*)/g).map((p, i) =>
        /^https?:\/\//.test(p)
          ? <a key={i} href={p} target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: "#0a6fb5" }}>{p.includes("drive.google.com") ? "▶ Open video in Google Drive" : p}</a>
          : /^\*\*/.test(p) ? <b key={i} className="font-semibold">{p.slice(2, -2)}</b>
          : <span key={i}>{p}</span>)}
    </div>
  );
}

function Auth({ token, code, siteName, onDone }: { token: string; code: string; siteName: string; onDone: () => void }) {
  // only rendered after the client has loaded data, so localStorage is safe here
  const [mode, setMode] = useState<"login" | "register">(() => (localStorage.getItem("depot-registered") ? "login" : "register"));
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await fetch(`/api/depot/${token}/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, name, phone, password }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Something went wrong"); if (r.status === 409) setMode("login"); return; }
    localStorage.setItem("depot-registered", "1");
    onDone();
  }

  const input = "mt-1.5 w-full rounded-xl border px-3.5 py-3 text-[16px] outline-none focus:border-[#0a9b4a]";
  return (
    <div style={{ minHeight: "100dvh", background: "#fff", color: INK, fontFamily: FONT }} className="flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <img src="/depot/avatar.png" alt="" className="h-12 w-12 rounded-full" />
        <h1 className="mt-4 text-[24px] font-semibold tracking-tight">Video Bot · {code}</h1>
        <p className="mt-1 text-[14px]" style={{ color: MUTED }}>{siteName} depot. Send a video, say what to add, and I&apos;ll edit it for you.</p>

        <div className="mt-6 grid grid-cols-2 rounded-xl p-1 text-[14px] font-medium" style={{ background: PEARL }}>
          {(["register", "login"] as const).map((m) => (
            <button type="button" key={m} onClick={() => { setMode(m); setErr(""); }} className="rounded-lg py-2"
              style={mode === m ? { background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.1)" } : { color: MUTED }}>
              {m === "register" ? "Register" : "Log in"}
            </button>
          ))}
        </div>

        {mode === "register" && (
          <label className="mt-4 block text-[13px] font-medium">Your name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmad" autoComplete="name" className={input} style={{ borderColor: "#d9dce1" }} />
          </label>
        )}
        <label className="mt-4 block text-[13px] font-medium">Phone number
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="012-345 6789" inputMode="tel" autoComplete="tel" className={input} style={{ borderColor: "#d9dce1" }} />
        </label>
        <label className="mt-4 block text-[13px] font-medium">Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={mode === "register" ? "At least 6 characters" : ""}
            autoComplete={mode === "register" ? "new-password" : "current-password"} className={input} style={{ borderColor: "#d9dce1" }} />
        </label>
        {err && <div className="mt-3 rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#c62828]">{err}</div>}
        <button disabled={busy} className="mt-5 w-full rounded-xl py-3 text-[15px] font-semibold text-white disabled:opacity-60" style={{ background: GREEN }}>
          {busy ? "Please wait…" : mode === "register" ? "Create account" : "Log in"}
        </button>
        <p className="mt-4 text-center text-[12px]" style={{ color: MUTED }}>
          {mode === "login" ? "Forgot your password? Ask Faeez to reset it." : "Only for FatHopes depot staff."}
        </p>
      </form>
    </div>
  );
}
