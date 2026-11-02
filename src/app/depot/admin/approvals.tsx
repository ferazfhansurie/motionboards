"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const isImage = (u: string) => /\.(png|jpe?g|webp)(\?|$)/i.test(u);

type Job = { id: string; depot: string; manager: string | null; status: string; videoUrl: string | null; previewUrl: string | null; driveUrl: string | null;
  instructions: { text: string; at: string; by?: string }[]; capcutName: string | null; note: string | null; updatedAt: string };
type Site = { code: string; name: string; token: string; daily_limit: number };
type User = { id: number; depot: string; name: string; phone: string; disabled: boolean; created_at: string; last_seen: string | null; videos: number;
  last_msg: string | null; last_text: string | null };
type Template = { id: number; name: string; note: string | null; file_url: string; filename: string | null; content_type: string | null; size: number | null; created_by: string | null; created_at: string };
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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tpl, setTpl] = useState<{ name: string; note: string; file: File | null }>({ name: "", note: "", file: null });
  const [tplState, setTplState] = useState("");
  const tplRef = useRef<HTMLInputElement>(null);
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sendState, setSendState] = useState("");
  const [newAdmin, setNewAdmin] = useState({ name: "", phone: "", password: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const threadEnd = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"pending" | "all" | "chats" | "people" | "templates" | "links">("pending");
  const [chatUser, setChatUser] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/depot/admin", { cache: "no-store" });
    if (r.status === 401) { location.replace("/depot/admin"); return; }
    if (r.ok) { const j = await r.json(); setJobs(j.jobs); setSites(j.sites); setUsers(j.users ?? []); setAdmins(j.admins ?? []); setTemplates(j.templates ?? []); }
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

  async function uploadTemplate() {
    const f = tpl.file;
    if (!f) return;
    try {
      setTplState("Uploading… 0%");
      const type = f.type || "application/octet-stream";
      const p = await fetch("/api/depot/admin/presign", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "template", filename: f.name, contentType: type, size: f.size }) });
      const pj = await p.json();
      if (!p.ok) throw new Error(pj.error || "Upload failed");
      await new Promise<void>((res, rej) => {
        const x = new XMLHttpRequest();
        x.open("PUT", pj.uploadUrl);
        x.setRequestHeader("Content-Type", type);
        x.upload.onprogress = (e) => e.lengthComputable && setTplState(`Uploading… ${Math.round((e.loaded / e.total) * 100)}%`);
        x.onload = () => (x.status < 300 ? res() : rej(new Error("Upload failed")));
        x.onerror = () => rej(new Error("Upload failed"));
        x.send(f);
      });
      await post({ action: "template_add", url: pj.publicUrl, name: tpl.name || f.name.replace(/\.[^.]+$/, ""), note: tpl.note, filename: f.name, contentType: type, size: f.size });
      setTpl({ name: "", note: "", file: null }); if (tplRef.current) tplRef.current.value = "";
      load();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    setTplState("");
  }
  async function deleteTemplate(t: Template) {
    if (!confirm(`Delete the template "${t.name}"? The bot won't use it any more.`)) return;
    try { await post({ action: "template_del", id: t.id }); load(); } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
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
          {(["pending", "all", "chats", "people", "templates", "links"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 text-sm font-semibold ${tab === t ? "bg-white text-[#0a7a3a]" : "bg-white/15"}`}>
              {t === "pending" ? `To approve (${jobs.filter((j) => j.status === "pending").length})` : t === "all" ? "All videos" : t === "chats" ? "Chats" : t === "people" ? `People (${users.length})` : t === "templates" ? `Templates (${templates.length})` : "Depot links"}
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
                  <div className="flex-1 overflow-y-auto px-5 py-5" style={{ maxHeight: "75vh" }}>
                    <div className="mx-auto flex max-w-2xl flex-col gap-[14px]">
                    {msgs.length === 0 && <div className="text-center text-sm text-[#9a9da2]">No messages yet.</div>}
                    {msgs.map((m) => {
                      const media = m.media_url && (isImage(m.media_url) ? <a href={m.media_url} target="_blank" rel="noreferrer"><img src={m.media_url} alt="Poster" className="mb-2 w-full max-w-[320px] rounded-xl" /></a>
                        : <video src={m.media_url} controls playsInline preload="metadata" className="mb-2 max-h-[60vh] w-full max-w-[320px] rounded-xl bg-black" />);
                      if (m.role === "bot") return (
                        <div key={m.id} className="flex items-start gap-2.5">
                          <img src="/depot/avatar.png" alt="" className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
                          <div className="min-w-0 flex-1 text-[15px] leading-[1.55] text-[#202225]">
                            {media}<div className="whitespace-pre-wrap break-words">{m.text}</div>
                            <div className="mt-1 text-[11px] text-[#9a9da2]">Video Bot · {when(m.created_at)}</div>
                          </div>
                        </div>);
                      const mine = m.role === "admin";
                      return (
                        <div key={m.id} className={`flex flex-col ${mine ? "items-end pl-11" : "items-start pr-11"}`}>
                          <div className="mb-1 text-[11px] text-[#9a9da2]">{mine ? `${m.author || "Admin"} · FatHopes` : (m.author || u?.name)}</div>
                          <div className={`max-w-full rounded-[22px] px-4 py-2.5 text-[15px] leading-[1.5] text-[#202225] ${mine ? "bg-[#f3f4f6]" : "border border-[#e8e9ec] bg-white"}`}>
                            {media}<div className="whitespace-pre-wrap break-words">{m.text}</div>
                          </div>
                          <div className="mt-1 text-[11px] text-[#9a9da2]">{when(m.created_at)}</div>
                        </div>);
                    })}
                    <div ref={threadEnd} />
                    </div>
                  </div>
                  <div className="px-4 pb-4 pt-1">
                    <div className="mx-auto max-w-2xl">
                    <div className="rounded-[22px] border border-[#d9dce1] bg-white px-3 pb-2 pt-2.5 shadow-[0_1px_6px_rgba(0,0,0,.06)]">
                      {file && <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#f3f4f6] px-3 py-2 text-sm">🎬 <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                        <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="px-1 text-[#7d8794]" aria-label="Remove video">✕</button></div>}
                      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={1} placeholder={`Reply to ${u?.name ?? "them"} as ${me}`}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                        className="block w-full resize-none bg-transparent px-1 text-[15px] leading-[1.45] outline-none placeholder:text-[#9a9da2]" />
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                        <button onClick={() => fileRef.current?.click()} disabled={!!sendState} aria-label="Attach video"
                          className="flex h-9 items-center gap-1.5 rounded-full bg-[#f3f4f6] px-3 text-[13px] font-medium text-[#202225]"><span className="text-base">📎</span> Video</button>
                        <span className="min-w-0 flex-1 truncate text-right text-xs text-[#7d8794]">{sendState}</span>
                        <button disabled={!!sendState || (!reply.trim() && !file)} onClick={sendReply} aria-label="Send"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0a9b4a] text-white disabled:opacity-30">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 px-2 text-center text-[11px] text-[#9a9da2]">The bot answers. Ask for a poster and it makes one; otherwise, with a video in progress, your message is an edit to it.</div>
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
        ) : tab === "templates" ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-1 font-bold">Add a poster template</div>
              <div className="mb-3 text-sm text-[#5b6573]">Only admins see these. Every poster the bot makes starts from one of these images: it keeps the logo, colours and characters and changes the event details. Upload images (PNG/JPG); PDFs and other files are kept here but the bot can't use them.</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input ref={tplRef} type="file" accept="image/*,application/pdf,.psd,.ai,.zip,.pptx,.key" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0] ?? null; setTpl((t) => ({ ...t, file: f, name: t.name || (f ? f.name.replace(/\.[^.]+$/, "") : "") })); }} />
                <button onClick={() => tplRef.current?.click()} className="rounded-lg border border-[#d9dce1] px-3 py-1.5 font-semibold">📎 {tpl.file ? tpl.file.name : "Choose file"}</button>
                <input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} placeholder="Name, e.g. Hari Kutipan (BM)" className="w-60 rounded-lg border border-[#d9dce1] px-2.5 py-1.5" />
                <input value={tpl.note} onChange={(e) => setTpl({ ...tpl, note: e.target.value })} placeholder="Note (optional): when to use it" className="min-w-0 flex-1 rounded-lg border border-[#d9dce1] px-2.5 py-1.5" />
                <button disabled={!tpl.file || !!tplState} onClick={uploadTemplate} className="rounded-lg bg-[#0a9b4a] px-4 py-1.5 font-bold text-white disabled:opacity-40">{tplState || "Upload"}</button>
              </div>
            </div>
            {templates.length === 0 ? <div className="rounded-xl bg-white p-10 text-center text-[#5b6573] shadow-sm">No templates yet. Upload the first one above.</div> :
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <div key={t.id} className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm">
                  {t.content_type?.startsWith("image/") ? <a href={t.file_url} target="_blank" rel="noreferrer"><img src={t.file_url} alt={t.name} className="aspect-[4/5] w-full bg-[#eef0ee] object-cover" /></a>
                    : <div className="flex aspect-[4/5] items-center justify-center bg-[#eef0ee] text-4xl">📄<span className="ml-2 text-sm font-bold text-[#5b6573]">{(t.filename?.match(/\.([a-z0-9]+)$/i)?.[1] ?? "file").toUpperCase()}</span></div>}
                  <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
                    <div className="font-semibold">{t.name}</div>
                    {t.note && <div className="text-[#5b6573]">{t.note}</div>}
                    <div className="text-xs text-[#9aa3ae]">{t.created_by ?? "Admin"} · {when(t.created_at)}{t.size ? ` · ${(t.size / 1048576).toFixed(1)} MB` : ""}</div>
                    <div className="mt-auto flex gap-2 pt-2">
                      <a href={`/api/depot/templates/${t.id}`} className="flex-1 rounded-lg bg-[#0a9b4a] py-1.5 text-center font-bold text-white">⬇ Download</a>
                      <button onClick={() => deleteTemplate(t)} className="rounded-lg border px-3 py-1.5 font-semibold text-[#c62828]">Delete</button>
                    </div>
                  </div>
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
