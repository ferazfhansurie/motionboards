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
  const [navOpen, setNavOpen] = useState(false);
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
  const pendingCount = jobs.filter((j) => j.status === "pending").length;
  const NAV = [
    { k: "pending", label: "To approve", n: pendingCount },
    { k: "all", label: "All videos" },
    { k: "people", label: "People", n: users.length },
    { k: "templates", label: "Templates", n: templates.length },
    { k: "links", label: "Depot links" },
  ] as const;
  const cu = users.find((x) => x.id === chatUser);
  const title = tab === "chats" ? (cu ? cu.name : "Chats") : NAV.find((n) => n.k === tab)?.label;
  const go = (t: typeof tab) => { setTab(t); setNavOpen(false); };
  return (
    <div className="flex h-dvh gap-2 bg-black p-2 text-[#ececec] [color-scheme:dark]">
      {navOpen && <div onClick={() => setNavOpen(false)} className="fixed inset-0 z-20 bg-black/60 md:hidden" />}
      <aside className={`fixed inset-y-2 left-2 z-30 flex w-[272px] flex-col overflow-hidden rounded-[22px] bg-[#1c1c1e] transition-transform md:static md:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-[110%]"}`}>
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
          <img src="/depot/fathopes-logo-white.png" alt="FatHopes" className="h-6" />
          <span className="ml-auto rounded-full bg-white/[.07] px-2.5 py-1 text-[11px] font-medium text-white/60">Depot bot</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {NAV.map((n) => (
            <button key={n.k} onClick={() => go(n.k)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[15px] ${tab === n.k ? "bg-[#1f3a2a] text-white" : "text-white/80 hover:bg-white/[.05]"}`}>
              <span className="flex-1">{n.label}</span>
              {"n" in n && n.n > 0 && <span className={`rounded-full px-2 text-xs font-semibold ${n.k === "pending" ? "bg-[#22c55e] text-black" : "text-white/40"}`}>{n.n}</span>}
            </button>
          ))}
          <div className="mt-4 flex items-center px-3 pb-1.5 text-[13px] text-white/45">Chats<span className="ml-auto">{users.length}</span></div>
          {users.length === 0 && <div className="px-3 py-2 text-[13px] text-white/35">Nobody has registered yet.</div>}
          {users.map((u) => (
            <button key={u.id} onClick={() => { setMsgs([]); setChatUser(u.id); go("chats"); }}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${tab === "chats" && chatUser === u.id ? "bg-[#1f3a2a]" : "hover:bg-white/[.05]"}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[.08] text-[11px] font-bold text-[#4ade80]">{u.depot}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="flex-1 truncate text-[14px] font-medium text-white/90">{u.name}</span>
                  <span className="text-[11px] text-white/35">{u.last_msg ? ago(u.last_msg) : ""}</span></span>
                <span className="block truncate text-[12.5px] text-white/45">{u.last_text ?? "No messages yet"}</span>
              </span>
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t border-white/[.06] px-4 py-3">
          <img src="/depot/avatar.png" alt="" className="h-9 w-9 rounded-full" />
          <span className="min-w-0 flex-1 truncate text-sm text-white/80">{me}</span>
          <button onClick={logout} className="rounded-full bg-white/[.07] px-3 py-1.5 text-[13px] text-white/70 hover:bg-white/[.12]">Log out</button>
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-[#0b0b0b]">
        <div className="relative flex h-16 shrink-0 items-center justify-center px-4">
          <button onClick={() => setNavOpen(true)} aria-label="Menu" className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/[.06] md:hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="flex max-w-[70%] items-center gap-2 rounded-full border border-white/10 bg-[#1c1c1e] px-4 py-1.5 text-[15px] font-medium">
            <span className="truncate">{title}</span>
            {tab === "chats" && cu && <span className="truncate text-[13px] text-white/45">{cu.depot} · +{cu.phone}</span>}
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" />
          </div>
        </div>
      <main className={`min-h-0 flex-1 ${tab === "chats" ? "flex flex-col" : "overflow-y-auto px-4 pb-6 md:px-8"}`}>
        <div className={tab === "chats" ? "contents" : "mx-auto max-w-5xl"}>
        {tab === "chats" ? (
          chatUser === null ? <div className="m-auto text-sm text-white/45">Pick a chat on the left.</div> : <>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <div className="mx-auto flex max-w-3xl flex-col gap-5">
                    {msgs.length === 0 && <div className="text-center text-sm text-white/40">No messages yet.</div>}
                    {msgs.map((m) => {
                      const media = m.media_url && (isImage(m.media_url) ? <a href={m.media_url} target="_blank" rel="noreferrer"><img src={m.media_url} alt="Poster" className="mb-2 w-full max-w-[340px] rounded-2xl" /></a>
                        : <video src={m.media_url} controls playsInline preload="metadata" className="mb-2 max-h-[60vh] w-full max-w-[340px] rounded-2xl bg-black" />);
                      if (m.role === "bot") return (
                        <div key={m.id} className="flex items-start gap-3">
                          <img src="/depot/avatar.png" alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
                          <div className="min-w-0 flex-1 text-[16px] leading-[1.6] text-white/90">
                            {media}<div className="whitespace-pre-wrap break-words">{m.text}</div>
                            <div className="mt-1 text-[11px] text-white/35">Video Bot · {when(m.created_at)}</div>
                          </div>
                        </div>);
                      const mine = m.role === "admin";
                      return (
                        <div key={m.id} className={`flex flex-col ${mine ? "items-end pl-12" : "items-start pr-12"}`}>
                          <div className="mb-1 text-[11px] text-white/40">{mine ? `${m.author || "Admin"} · FatHopes` : (m.author || cu?.name)}</div>
                          <div className={`max-w-full rounded-[22px] px-4 py-2.5 text-[16px] leading-[1.5] ${mine ? "bg-[#2a2a2c] text-white" : "border border-white/10 bg-[#141416] text-white/90"}`}>
                            {media}<div className="whitespace-pre-wrap break-words">{m.text}</div>
                          </div>
                          <div className="mt-1 text-[11px] text-white/35">{when(m.created_at)}</div>
                        </div>);
                    })}
                    <div ref={threadEnd} />
                    </div>
                  </div>
                  <div className="px-4 pb-4 pt-1">
                    <div className="mx-auto max-w-3xl">
                    <div className="rounded-[26px] border border-white/10 bg-[#1c1c1e] px-3 pb-2.5 pt-3">
                      {file && <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/[.06] px-3 py-2 text-sm">🎬 <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                        <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="px-1 text-white/50" aria-label="Remove video">✕</button></div>}
                      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={1} placeholder={`Reply to ${cu?.name ?? "them"} as ${me}`}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                        className="block w-full resize-none bg-transparent px-2 text-[16px] leading-[1.45] text-white outline-none placeholder:text-white/40" />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                        <button onClick={() => fileRef.current?.click()} disabled={!!sendState} aria-label="Attach video"
                          className="flex h-9 items-center gap-1.5 rounded-full px-2 text-[14px] text-white/60 hover:bg-white/[.06]">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg> Video</button>
                        <span className="min-w-0 flex-1 truncate text-right text-xs text-white/45">{sendState}</span>
                        <button disabled={!!sendState || (!reply.trim() && !file)} onClick={sendReply} aria-label="Send"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:opacity-25">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 px-2 text-center text-[11px] text-white/35">The bot answers. Ask for a poster and it makes one; otherwise, with a video in progress, your message is an edit to it.</div>
                    </div>
                  </div>
          </>
        ) : tab === "people" ? (
          <div className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-[20px] bg-[#1c1c1e]">
            <div className="border-b border-white/[.06] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white/55">Admins: can see every chat, reply and approve</div>
            {admins.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[.06] px-4 py-3 text-sm">
                <span className="min-w-32 flex-1 font-semibold">{a.name}{a.name === me ? " (you)" : ""}</span>
                <span className="w-32 text-white/55">+{a.phone}</span>
                <span className="w-24 text-xs text-white/45">{a.last_seen ? `seen ${ago(a.last_seen)}` : "never seen"}</span>
                {a.name !== me && <button onClick={() => removeAdmin(a)} className="rounded-full border border-white/15 px-2.5 py-1 font-semibold text-[#f87171]">Remove</button>}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <input value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} placeholder="Name" className="w-36 rounded-full border border-white/10 bg-[#141416] px-3 py-1.5" />
              <input value={newAdmin.phone} onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })} placeholder="Phone" className="w-36 rounded-full border border-white/10 bg-[#141416] px-3 py-1.5" />
              <input value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} placeholder="Password (8+)" type="password" autoComplete="new-password" className="w-36 rounded-full border border-white/10 bg-[#141416] px-3 py-1.5" />
              <button onClick={addAdmin} className="rounded-full border border-[#22c55e] px-2.5 py-1.5 font-semibold text-[#4ade80]">Add admin</button>
            </div>
          </div>
          <div className="border-b-0 px-1 text-xs font-bold uppercase tracking-wide text-white/55">Depot staff</div>
          {users.length === 0 ? <div className="rounded-[20px] bg-[#1c1c1e] p-10 text-center text-white/55">Nobody has registered yet.</div> :
          <div className="overflow-hidden rounded-[20px] bg-[#1c1c1e]">
            {users.map((u) => (
              <div key={u.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[.06] px-4 py-3 text-sm last:border-0 ${u.disabled ? "opacity-50" : ""}`}>
                <b className="w-12">{u.depot}</b><span className="min-w-32 flex-1 font-semibold">{u.name}</span>
                <span className="w-32 text-white/55">+{u.phone}</span>
                <span className="w-20 text-white/55">{u.videos} video{u.videos === 1 ? "" : "s"}</span>
                <span className="w-24 text-xs text-white/45">{u.last_seen ? `seen ${ago(u.last_seen)}` : "never seen"}</span>
                <button onClick={() => { setMsgs([]); setChatUser(u.id); setTab("chats"); }} className="rounded-full border border-white/15 px-2.5 py-1 font-semibold">View chat</button>
                <button onClick={() => userAct(u, "user_reset")} className="rounded-full border border-white/15 px-2.5 py-1 font-semibold">Reset password</button>
                <button onClick={() => userAct(u, u.disabled ? "user_on" : "user_off")} className={`rounded-full border border-white/15 px-2.5 py-1 font-semibold ${u.disabled ? "" : "text-[#f87171]"}`}>{u.disabled ? "Turn on" : "Turn off"}</button>
              </div>
            ))}
          </div>}
          </div>
        ) : tab === "templates" ? (
          <div className="space-y-4">
            <div className="rounded-[20px] bg-[#1c1c1e] p-5">
              <div className="mb-1 font-bold">Add a poster template</div>
              <div className="mb-3 text-sm text-white/55">Only admins see these. Every poster the bot makes starts from one of these images: it keeps the logo, colours and characters and changes the event details. Upload images (PNG/JPG); PDFs and other files are kept here but the bot can&apos;t use them.</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input ref={tplRef} type="file" accept="image/*,application/pdf,.psd,.ai,.zip,.pptx,.key" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0] ?? null; setTpl((t) => ({ ...t, file: f, name: t.name || (f ? f.name.replace(/\.[^.]+$/, "") : "") })); }} />
                <button onClick={() => tplRef.current?.click()} className="rounded-full border border-white/10 bg-[#141416] px-3 py-1.5 font-semibold">📎 {tpl.file ? tpl.file.name : "Choose file"}</button>
                <input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} placeholder="Name, e.g. Hari Kutipan (BM)" className="w-60 rounded-full border border-white/10 bg-[#141416] px-3 py-1.5" />
                <input value={tpl.note} onChange={(e) => setTpl({ ...tpl, note: e.target.value })} placeholder="Note (optional): when to use it" className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#141416] px-3 py-1.5" />
                <button disabled={!tpl.file || !!tplState} onClick={uploadTemplate} className="rounded-full bg-[#22c55e] text-black px-4 py-1.5 font-bold disabled:opacity-40">{tplState || "Upload"}</button>
              </div>
            </div>
            {templates.length === 0 ? <div className="rounded-[20px] bg-[#1c1c1e] p-10 text-center text-white/55">No templates yet. Upload the first one above.</div> :
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <div key={t.id} className="flex flex-col overflow-hidden rounded-[20px] bg-[#1c1c1e]">
                  {t.content_type?.startsWith("image/") ? <a href={t.file_url} target="_blank" rel="noreferrer"><img src={t.file_url} alt={t.name} className="aspect-[4/5] w-full bg-white/[.06] object-cover" /></a>
                    : <div className="flex aspect-[4/5] items-center justify-center bg-white/[.06] text-4xl">📄<span className="ml-2 text-sm font-bold text-white/55">{(t.filename?.match(/\.([a-z0-9]+)$/i)?.[1] ?? "file").toUpperCase()}</span></div>}
                  <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
                    <div className="font-semibold">{t.name}</div>
                    {t.note && <div className="text-white/55">{t.note}</div>}
                    <div className="text-xs text-white/35">{t.created_by ?? "Admin"} · {when(t.created_at)}{t.size ? ` · ${(t.size / 1048576).toFixed(1)} MB` : ""}</div>
                    <div className="mt-auto flex gap-2 pt-2">
                      <a href={`/api/depot/templates/${t.id}`} className="flex-1 rounded-full bg-[#22c55e] text-black py-1.5 text-center font-bold">⬇ Download</a>
                      <button onClick={() => deleteTemplate(t)} className="rounded-full border border-white/15 px-3 py-1.5 font-semibold text-[#f87171]">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>}
          </div>
        ) : tab === "links" ? (
          <div className="overflow-hidden rounded-[20px] bg-[#1c1c1e]">
            <div className="flex items-center gap-3 border-b border-white/[.06] bg-[#1f3a2a] px-4 py-3 text-sm">
              <b className="w-12">ALL</b><span className="w-56 font-semibold">Shared link (give this one out)</span>
              <code className="min-w-0 flex-1 truncate">{origin}/depot</code>
              <button onClick={() => navigator.clipboard.writeText(`${origin}/depot`)} className="rounded-full border border-white/15 px-3 py-1 font-semibold">Copy</button>
            </div>
            {sites.map((s) => (
              <div key={s.code} className="flex items-center gap-3 border-b border-white/[.06] px-4 py-3 text-sm last:border-0">
                <b className="w-12">{s.code}</b><span className="w-56 text-white/55">{s.name}</span>
                <code className="min-w-0 flex-1 truncate">{origin}/depot/{s.token}</code>
                <button onClick={() => navigator.clipboard.writeText(`${origin}/depot/${s.token}`)} className="rounded-full border border-white/15 px-2.5 py-1 font-semibold">Copy</button>
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-[20px] bg-[#1c1c1e] p-10 text-center text-white/55">Nothing waiting for you 🎉</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((j) => (
              <div key={j.id} className="flex flex-col overflow-hidden rounded-[20px] bg-[#1c1c1e]">
                {j.previewUrl && isImage(j.previewUrl) ? <a href={j.previewUrl} target="_blank" rel="noreferrer"><img src={j.previewUrl} alt="Poster" className="w-full bg-black object-contain" /></a>
                  : j.previewUrl ? <video src={j.previewUrl} controls playsInline preload="metadata" className="aspect-[9/16] max-h-[460px] w-full bg-black" />
                  : <div className="flex aspect-[9/16] max-h-[460px] items-center justify-center bg-[#222] text-sm text-white/60">{LABEL[j.status]}</div>}
                <div className="flex flex-1 flex-col gap-2 p-3.5 text-sm">
                  <div className="flex items-center gap-2"><b>{j.depot}</b><span className="text-white/55">{j.manager}</span>
                    <span className="ml-auto rounded-full bg-white/[.06] px-2 py-0.5 text-xs font-semibold">{LABEL[j.status] ?? j.status}</span></div>
                  <div className="text-xs text-white/55">{j.instructions.map((i) => `${i.by ? i.by + ": " : ""}"${i.text}"`).join(" → ")}</div>
                  {j.capcutName && <div className="text-xs">CapCut project: <b>{j.capcutName}</b></div>}
                  {j.driveUrl && <a href={j.driveUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#60a5fa] underline">Open in Google Drive</a>}
                  <div className="text-[11px] text-white/35">{ago(j.updatedAt)}</div>
                  {["pending", "preview", "rejected"].includes(j.status) && (
                    <div className="mt-auto flex flex-col gap-1.5 pt-1">
                      <button disabled={busy === j.id} onClick={() => act(j.id, "approve")} className="rounded-full bg-[#22c55e] text-black py-2 font-bold disabled:opacity-50">✅ Approve → Google Drive</button>
                      <div className="flex gap-1.5">
                        <input value={notes[j.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [j.id]: e.target.value }))} placeholder="Ask for a change…"
                          className="min-w-0 flex-1 rounded-full border border-white/15 px-2.5 py-1.5" />
                        <button disabled={busy === j.id || !notes[j.id]?.trim()} onClick={() => act(j.id, "change")} className="rounded-full border border-white/15 px-2.5 font-semibold disabled:opacity-40">Send</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </main>
      </section>
    </div>
  );
}
