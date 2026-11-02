"use client";

import { useState } from "react";

const GREEN = "#0a9b4a";
const INK = "#202225";
const MUTED = "#6b7078";
const PEARL = "#f3f4f6";
const FONT = 'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

// The one shared link for every depot: register (pick your depot) or log in, then go to your depot's chat.
export default function Join({ sites, returning }: { sites: { code: string; name: string }[]; returning: boolean }) {
  const [mode, setMode] = useState<"login" | "register">(returning ? "login" : "register");
  const [depot, setDepot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await fetch("/api/depot/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, depot, name, phone, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); setErr(j.error || "Something went wrong"); if (r.status === 409) setMode("login"); return; }
    document.cookie = "depot_reg=1; path=/; max-age=31536000; samesite=lax"; // next visit opens on Log in
    location.replace(`/depot/${j.token}`);
  }

  const input = "mt-1.5 w-full rounded-xl border px-3.5 py-3 text-[16px] outline-none focus:border-[#0a9b4a]";
  return (
    <div style={{ minHeight: "100dvh", background: "#fff", color: INK, fontFamily: FONT }} className="flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <img src="/depot/avatar.png" alt="" className="h-12 w-12 rounded-full" />
        <h1 className="mt-4 text-[24px] font-semibold tracking-tight">FatHopes Video Bot</h1>
        <p className="mt-1 text-[14px]" style={{ color: MUTED }}>Send a video, say what to add, and I&apos;ll edit it for you.</p>

        <div className="mt-6 grid grid-cols-2 rounded-xl p-1 text-[14px] font-medium" style={{ background: PEARL }}>
          {(["register", "login"] as const).map((m) => (
            <button type="button" key={m} onClick={() => { setMode(m); setErr(""); }} className="rounded-lg py-2"
              style={mode === m ? { background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.1)" } : { color: MUTED }}>
              {m === "register" ? "Register" : "Log in"}
            </button>
          ))}
        </div>

        {mode === "register" && <>
          <label className="mt-4 block text-[13px] font-medium">Your depot
            <select value={depot} onChange={(e) => setDepot(e.target.value)} className={input + " bg-white"} style={{ borderColor: "#d9dce1", color: depot ? INK : MUTED }}>
              <option value="">Pick your depot</option>
              {sites.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </label>
          <label className="mt-4 block text-[13px] font-medium">Your name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmad" autoComplete="name" className={input} style={{ borderColor: "#d9dce1" }} />
          </label>
        </>}
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
