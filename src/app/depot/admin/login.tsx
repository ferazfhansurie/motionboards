"use client";

import { useState } from "react";

export default function AdminLogin({ setupKey }: { setupKey: string | null }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const body = setupKey ? { action: "setup", k: setupKey, name, phone, password } : { action: "login", phone, password };
    const r = await fetch("/api/depot/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { location.replace("/depot/admin"); return; }
    setErr((await r.json().catch(() => ({}))).error || "Something went wrong"); setBusy(false);
  }

  const input = "w-full rounded-2xl border border-white/10 bg-[#141416] px-4 py-3 text-[16px] text-white outline-none placeholder:text-white/40 focus:border-[#22c55e]";
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black p-5 text-[#ececec] [color-scheme:dark]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[24px] bg-[#1c1c1e] p-6">
        <img src="/depot/fathopes-logo-white.png" alt="FatHopes" className="mb-5 h-7" />
        <div className="mb-1 text-xl font-bold">{setupKey ? "Create your admin account" : "Admin log in"}</div>
        <div className="mb-5 text-sm text-white/55">{setupKey ? "Use your phone number (01121677672). You can add more admins after." : "Depot video bot: approvals and all chats."}</div>
        <div className="flex flex-col gap-3">
          {setupKey && <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
          <input className={input} placeholder="Phone number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          <input className={input} placeholder={setupKey ? "Password (8+ characters)" : "Password"} type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete={setupKey ? "new-password" : "current-password"} />
          {err && <div className="rounded-xl bg-[#3b1414] px-3 py-2 text-sm text-[#f87171]">{err}</div>}
          <button disabled={busy} className="rounded-full bg-[#22c55e] py-3 font-bold text-black disabled:opacity-50">{setupKey ? "Create admin account" : "Log in"}</button>
        </div>
      </form>
    </div>
  );
}
