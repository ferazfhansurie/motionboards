"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const isImage = (u: string) => /\.(png|jpe?g|webp)(\?|$)/i.test(u);

type Job = { id: string; depot: string; manager: string | null; status: string; videoUrl: string | null; previewUrl: string | null; driveUrl: string | null;
  instructions: { text: string; at: string; by?: string }[]; capcutName: string | null; note: string | null; updatedAt: string };
type Site = { code: string; name: string; token: string; daily_limit: number };
type User = { id: number; depot: string; name: string; phone: string; disabled: boolean; created_at: string; last_seen: string | null; videos: number;
  last_msg: string | null; last_text: string | null };
type Admin = { id: number; name: string; phone: string; last_seen: string | null };
type Msg = { id: number; role: "user" | "bot" | "admin"; author: string | null; text: string; media_url: string | null; created_at: string };
const when = (s: string) => new Date(s).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

const LABEL: Record<string, string> = { queued: "Waiting to edit", working: "Editing", preview: "Manager reviewing", pending: "Needs your approval",
  approved: "Approved, uploading", publishing: "Uploading to Drive", done: "Done", failed: "Failed", rejected: "Change asked", waiting: "Asking manager", closed: "Closed" };
const ago = (s: string) => { const m = Math.round((Date.now() - new Date(s).getTime()) / 60000); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

export default function Approvals({ me }: { me: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sendState, setSendState] = useState("");
  const [newAdmin, setNewAdmin] = useState({ name: "", phone: "", password: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const threadEnd = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"pending" | "all" | "chats" | "people" | "links">("pending");
  const [chatUser, setChatUser] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/depot/admin", { cache: "no-store" });
    if (r.status === 401) { location.replace("/depot/admin"); return; }
    if (r.ok) { const j = await r.json(); setJobs(j.jobs); setSites(j.sites); setUsers(j.users ?? []); setAdmins(j.admins ?? []); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  // the open chat refreshes with the rest of the page
  const loadChat = useCallback(async (id: number) => {
    const r = await fetch(`/api/depot/admin?chat=${id}`, { cache: "no-store" });
    if (r.ok) setMsgs((await r.json()).messages);
  }, []);
  useEffect(() => {
    if (tab !== "chats" || chatUser === null) return;
    loadChat(chatUser); const t = setInterval(() => loadChat(chatUser), 5000); return () => clearInterval(t);
  }, [tab, chatUser, loadChat]);
  useEffect(() => { threadEnd.current?.scrollIntoView({ block: "end" }); }, [msgs.length, chatUser]);

  async function post(body: Record<string, unknown>) {
    const r = await fetch("/api/depot/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Failed");
    return j;
  }

  async function sendReply() {
    if (chatUser === null || (!reply.trim() && !file)) return;
    try {
      let videoUrl: string | undefined;
      if (file) {
        setSendState("Uploading video… 0%");
        const p = await fetch("/api/depot/admin/presign", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type || "video/mp4", size: file.size }) });
        const pj = await p.json();
        if (!p.ok) throw new Error(pj.error || "Upload failed");
        await new Promise<void>((res, rej) => {
          const x = new XMLHttpRequest();
          x.open("PUT", pj.uploadUrl);
          x.setRequestHeader("Content-Type", file.type || "video/mp4");
          x.upload.onprogress = (e) => e.lengthComputable && setSendState(`Uploading video… ${Math.round((e.loaded / e.total) * 100)}%`);
          x.onload = () => (x.status < 300 ? res() : rej(new Error("Upload failed")));
          x.onerror = () => rej(new Error("Upload failed"));
          x.send(file);
        });
        videoUrl = pj.publicUrl;
      }
      setSendState("Sending…");
      await post({ action: "reply", userId: chatUser, text: reply, videoUrl });
      setReply(""); setFile(null); if (fileRef.current) fileRef.current.value = "";
      await loadChat(chatUser); load();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    setSendState("");
  }

  async function addAdmin() {
    try { await post({ action: "admin_add", ...newAdmin }); setNewAdmin({ name: "", phone: "", password: "" }); load(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }
  async function removeAdmin(a: Admin) {
    if (!confirm(`Remove ${a.name} as admin?`)) return;
    try { await post({ action: "admin_remove", adminId: a.id }); load(); } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }
  async function logout() {
    await fetch("/api/depot/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    location.replace("/depot/admin");
  }

  async function act(jobId: string, action: "approve" | "change") {
    setBusy(jobId);
    const r = await fetch("/api/depot/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, action, note: notes[jobId] }) });
    if (!r.ok) alert((await r.json().catch(() => ({}))).error || "Failed");
    setNotes((n) => ({ ...n, [jobId]: "" })); setBusy(""); load();
  }

  async function userAct(u: User, action: "user_off" | "user_on" | "user_reset") {
    if (action !== "user_on" && !confirm(action === "user_off" ? `Turn off ${u.name}'s account?` : `Reset ${u.name}'s password?`)) return;
    const r = await fetch("/api/depot/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, userId: u.id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) alert(j.error || "Failed");
    else if (j.password) alert(`New password for ${u.name}: ${j.password}\nSend it to them; they can log in with it now.`);
    load();
  }

  const shown = tab === "pending" ? jobs.filter((j) => j.status === "pending") : jobs;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div style={{ minHeight: "100dvh", background: "#f3f5f3", color: "#14181f" }}>
      <header className="sticky top-0 z-10 bg-[#0a9b4a] px-5 py-3 text-white shadow">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <img src="/depot/fathopes-logo-white.png" alt="" className="h-7" />
          <div className="flex-1 font-bold">Depot video approvals</div>
          {(["pending", "all", "chats", "people", "links"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 text-sm font-semibold ${tab === t ? "bg-white text-[#0a7a3a]" : "bg-white/15"}`}>
              {t === "pending" ? `To approve (${jobs.filter((j) => j.status === "pending").length})` : t === "all" ? "All videos" : t === "chats" ? "Chats" : t === "people" ? `People (${users.length})` : "Depot links"}
            </button>
          ))}
          <button onClick={logout} title={`Logged in as ${me}`} className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">Log out</button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-5">
        {tab === "chats" ? (
          users.length === 0 ? <div className="rounded-xl bg-white p-10 text-center text-[#5b6573] shadow-sm">Nobody has registered yet.</div> :
          <div className="grid gap-4 md:grid-cols-[300px_1fr]">
            <div className={`overflow-hidden rounded-xl bg-white shadow-sm ${chatUser !== null ? "hidden md:block" : ""}`}>
              {users.map((u) => (
                <button key={u.id} onClick={() => { setMsgs([]); setChatUser(u.id); }}
                  className={`block w-full border-b border-[#eef0ee] px-4 py-3 text-left text-sm last:border-0 ${chatUser === u.id ? "bg-[#e8f5ee]" : "hover:bg-[#f7f8f7]"}`}>
                  <div className="flex items-center gap-2"><b className="text-xs text-[#0a7a3a]">{u.depot}</b><span className="flex-1 truncate font-semibold">{u.name}</span>
                    <span className="text-[11px] text-[#9aa3ae]">{u.last_msg ? ago(u.last_msg) : ""}</span></div>
                  <div className="mt-0.5 truncate text-xs text-[#5b6573]">{u.last_text ?? "No messages yet"}</div>
                </button>
              ))}
            </div>
            <div className={`flex min-h-[60vh] flex-col overflow-hidden rounded-xl bg-white shadow-sm ${chatUser === null ? "hidden md:flex" : ""}`}>
              {chatUser === null ? <div className="m-auto text-sm text-[#5b6573]">Pick a person to read their chat.</div> : (() => {
                const u = users.find((x) => x.id === chatUser);
                return <>
                  <div className="flex items-center gap-2 border-b border-[#eef0ee] px-4 py-3 text-sm">
                    <button onClick={() => setChatUser(null)} className="md:hidden">←</button>
                    <b>{u?.name}</b><span className="text-[#5b6573]">{u?.depot} · +{u?.phone}</span>

                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: "75vh" }}>
                    {msgs.length === 0 && <div className="text-center text-sm text-[#9aa3ae]">No messages yet.</div>}
                    {msgs.map((m) => (
                      <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-[#f3f4f6]" : m.role === "admin" ? "border border-[#cfe0f5] bg-[#eef5fd]" : "border border-[#e3efe7] bg-[#f6fbf8]"}`}>
                          <div className="mb-0.5 text-[11px] font-semibold text-[#7d8794]">{m.role === "user" ? (m.author || u?.name) : m.role === "admin" ? `${m.author || "Admin"} (admin)` : "Video Bot"} · {when(m.created_at)}</div>
                          {m.media_url && (isImage(m.media_url) ? <a href={m.media_url} target="_blank" rel="noreferrer"><img src={m.media_url} alt="Poster" className="mb-1.5 max-h-72 rounded-lg" /></a>
                            : <video src={m.media_url} controls playsInline preload="metadata" className="mb-1.5 max-h-72 rounded-lg bg-black" />)}
                          <div className="whitespace-pre-wrap break-words">{m.text}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={threadEnd} />
                  </div>
                  <div className="border-t border-[#eef0ee] p-3">
                    {file && <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#f3f4f6] px-3 py-1.5 text-sm">🎬 <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-[#7d8794]">✕</button></div>}
                    <div className="flex items-end gap-2">
                      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                      <button onClick={() => fileRef.current?.click()} title="Attach a video" className="rounded-lg border border-[#d9dce1] px-2.5 py-2">📎</button>
                      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={`Reply to ${u?.name ?? "them"} as ${me}…`}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                        className="min-w-0 flex-1 resize-none rounded-lg border border-[#d9dce1] px-3 py-2 text-sm outline-none focus:border-[#0a9b4a]" />
                      <button disabled={!!sendState || (!reply.trim() && !file)} onClick={sendReply} className="rounded-lg bg-[#0a9b4a] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Send</button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-[#5b6573]">
                      <span>The bot answers. Ask for a poster and it makes one; otherwise, with a video in progress, your message is an edit to it.</span>
                      <span>{sendState}</span>
                    </div>
                  </div>
                </>;
              })()}
            </div>
          </div>
        ) : tab === "people" ? (
          <div className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="border-b border-[#eef0ee] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[#5b6573]">Admins: can see every chat, reply and approve</div>
            {admins.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#eef0ee] px-4 py-3 text-sm">
                <span className="min-w-32 flex-1 font-semibold">{a.name}{a.name === me ? " (you)" : ""}</span>
                <span className="w-32 text-[#5b6573]">+{a.phone}</span>
                <span className="w-24 text-xs text-[#7d8794]">{a.last_seen ? `seen ${ago(a.last_seen)}` : "never seen"}</span>
                {a.name !== me && <button onClick={() => removeAdmin(a)} className="rounded-lg border px-2.5 py-1 font-semibold text-[#c62828]">Remove</button>}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <input value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} placeholder="Name" className="w-36 rounded-lg border border-[#d9dce1] px-2.5 py-1.5" />
              <input value={newAdmin.phone} onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })} placeholder="Phone" className="w-36 rounded-lg border border-[#d9dce1] px-2.5 py-1.5" />
              <input value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} placeholder="Password (8+)" type="password" autoComplete="new-password" className="w-36 rounded-lg border border-[#d9dce1] px-2.5 py-1.5" />
              <button onClick={addAdmin} className="rounded-lg border border-[#0a9b4a] px-2.5 py-1.5 font-semibold text-[#0a7a3a]">Add admin</button>
            </div>
          </div>
          <div className="border-b-0 px-1 text-xs font-bold uppercase tracking-wide text-[#5b6573]">Depot staff</div>
          {users.length === 0 ? <div className="rounded-xl bg-white p-10 text-center text-[#5b6573] shadow-sm">Nobody has registered yet.</div> :
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            {users.map((u) => (
              <div key={u.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#eef0ee] px-4 py-3 text-sm last:border-0 ${u.disabled ? "opacity-50" : ""}`}>
                <b className="w-12">{u.depot}</b><span className="min-w-32 flex-1 font-semibold">{u.name}</span>
                <span className="w-32 text-[#5b6573]">+{u.phone}</span>
                <span className="w-20 text-[#5b6573]">{u.videos} video{u.videos === 1 ? "" : "s"}</span>
                <span className="w-24 text-xs text-[#7d8794]">{u.last_seen ? `seen ${ago(u.last_seen)}` : "never seen"}</span>
                <button onClick={() => { setMsgs([]); setChatUser(u.id); setTab("chats"); }} className="rounded-lg border px-2.5 py-1 font-semibold">View chat</button>
                <button onClick={() => userAct(u, "user_reset")} className="rounded-lg border px-2.5 py-1 font-semibold">Reset password</button>
                <button onClick={() => userAct(u, u.disabled ? "user_on" : "user_off")} className={`rounded-lg border px-2.5 py-1 font-semibold ${u.disabled ? "" : "text-[#c62828]"}`}>{u.disabled ? "Turn on" : "Turn off"}</button>
              </div>
            ))}
          </div>}
          </div>
        ) : tab === "links" ? (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#eef0ee] bg-[#e8f5ee] px-4 py-3 text-sm">
              <b className="w-12">ALL</b><span className="w-56 font-semibold">Shared link (give this one out)</span>
              <code className="min-w-0 flex-1 truncate">{origin}/depot</code>
              <button onClick={() => navigator.clipboard.writeText(`${origin}/depot`)} className="rounded-lg border bg-white px-2.5 py-1 font-semibold">Copy</button>
            </div>
            {sites.map((s) => (
              <div key={s.code} className="flex items-center gap-3 border-b border-[#eef0ee] px-4 py-3 text-sm last:border-0">
                <b className="w-12">{s.code}</b><span className="w-56 text-[#5b6573]">{s.name}</span>
                <code className="min-w-0 flex-1 truncate">{origin}/depot/{s.token}</code>
                <button onClick={() => navigator.clipboard.writeText(`${origin}/depot/${s.token}`)} className="rounded-lg border px-2.5 py-1 font-semibold">Copy</button>
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center text-[#5b6573] shadow-sm">Nothing waiting for you 🎉</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((j) => (
              <div key={j.id} className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm">
                {j.previewUrl && isImage(j.previewUrl) ? <a href={j.previewUrl} target="_blank" rel="noreferrer"><img src={j.previewUrl} alt="Poster" className="w-full bg-[#eee] object-contain" /></a>
                  : j.previewUrl ? <video src={j.previewUrl} controls playsInline preload="metadata" className="aspect-[9/16] max-h-[460px] w-full bg-black" />
                  : <div className="flex aspect-[9/16] max-h-[460px] items-center justify-center bg-[#222] text-sm text-white/60">{LABEL[j.status]}</div>}
                <div className="flex flex-1 flex-col gap-2 p-3.5 text-sm">
                  <div className="flex items-center gap-2"><b>{j.depot}</b><span className="text-[#5b6573]">{j.manager}</span>
                    <span className="ml-auto rounded-full bg-[#eef0ee] px-2 py-0.5 text-xs font-semibold">{LABEL[j.status] ?? j.status}</span></div>
                  <div className="text-xs text-[#5b6573]">{j.instructions.map((i) => `${i.by ? i.by + ": " : ""}"${i.text}"`).join(" → ")}</div>
                  {j.capcutName && <div className="text-xs">CapCut project: <b>{j.capcutName}</b></div>}
                  {j.driveUrl && <a href={j.driveUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#0a6fb5] underline">Open in Google Drive</a>}
                  <div className="text-[11px] text-[#9aa3ae]">{ago(j.updatedAt)}</div>
                  {["pending", "preview", "rejected"].includes(j.status) && (
                    <div className="mt-auto flex flex-col gap-1.5 pt-1">
                      <button disabled={busy === j.id} onClick={() => act(j.id, "approve")} className="rounded-lg bg-[#0a9b4a] py-2 font-bold text-white disabled:opacity-50">✅ Approve → Google Drive</button>
                      <div className="flex gap-1.5">
                        <input value={notes[j.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [j.id]: e.target.value }))} placeholder="Ask for a change…"
                          className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5" />
                        <button disabled={busy === j.id || !notes[j.id]?.trim()} onClick={() => act(j.id, "change")} className="rounded-lg border px-2.5 font-semibold disabled:opacity-40">Send</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
