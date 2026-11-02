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

  const input = "w-full rounded-xl border border-[#d9dce1] px-3.5 py-3 text-[16px] outline-none focus:border-[#0a9b4a]";
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3f5f3] p-5 text-[#14181f]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-1 text-xl font-bold">{setupKey ? "Create your admin account" : "Admin log in"}</div>
        <div className="mb-5 text-sm text-[#5b6573]">{setupKey ? "Use your phone number (01121677672). You can add more admins after." : "Depot video bot: approvals and all chats."}</div>
        <div className="flex flex-col gap-3">
          {setupKey && <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
          <input className={input} placeholder="Phone number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          <input className={input} placeholder={setupKey ? "Password (8+ characters)" : "Password"} type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete={setupKey ? "new-password" : "current-password"} />
          {err && <div className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#c62828]">{err}</div>}
          <button disabled={busy} className="rounded-xl bg-[#0a9b4a] py-3 font-bold text-white disabled:opacity-50">{setupKey ? "Create admin account" : "Log in"}</button>
        </div>
      </form>
    </div>
  );
}
