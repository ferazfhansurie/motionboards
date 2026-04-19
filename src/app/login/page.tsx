"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      window.location.href = "/generate";
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const ink = "#0d1117";
  const paper = "#fdf6ec";
  const paperDeep = "#fff8ec";
  const inputStyle: React.CSSProperties = {
    background: "#fff",
    color: ink,
    borderColor: ink,
    boxShadow: `3px 3px 0 0 ${ink}`,
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4" style={{ background: paper, color: ink }}>
      {/* Dot paper texture */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "4px 4px",
          opacity: 0.6,
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Sticker card */}
        <div
          className="relative rounded-3xl border-[2.5px] p-6"
          style={{
            background: paperDeep,
            borderColor: ink,
            boxShadow: `8px 8px 0 0 ${ink}`,
            transform: "rotate(-0.5deg)",
          }}
        >
          {/* Taped orange label */}
          <div
            className="absolute -top-3 right-8 inline-flex items-center gap-1 rounded-md border-2 px-3 py-1 text-[10.5px] font-black uppercase tracking-wider"
            style={{
              background: "#f26522",
              color: "#fff",
              borderColor: ink,
              transform: "rotate(-3deg)",
              boxShadow: `2px 2px 0 0 ${ink}`,
            }}
          >
            Members only
          </div>

          <div className="flex justify-center mb-5">
            <img
              src="/logo.jpg"
              alt="MotionBoards"
              className="h-16 rounded-xl border-[2.5px]"
              style={{ borderColor: ink, boxShadow: `3px 3px 0 0 ${ink}` }}
            />
          </div>

          <span className="mb-serif-italic block text-center text-[13px] opacity-70">— welcome back —</span>
          <h1 className="mb-serif-display text-center leading-none mt-1" style={{ fontSize: "2rem" }}>
            Sign in.
          </h1>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {error && (
              <div
                className="rounded-xl border-[2.5px] px-3 py-2 text-[12px] font-bold"
                style={{ background: "#fff", color: "#dc2626", borderColor: "#dc2626", boxShadow: `3px 3px 0 0 ${ink}` }}
              >
                {error}
              </div>
            )}

            <div>
              <label className="block text-[10.5px] font-black uppercase tracking-wider mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border-[2.5px] px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
                placeholder="you@email.com"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-black uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border-[2.5px] px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border-[2.5px] px-4 py-3 text-[13px] font-black uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
              style={{
                background: "#f26522",
                borderColor: ink,
                boxShadow: `4px 4px 0 0 ${ink}`,
                transform: "rotate(-1deg)",
              }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </button>
          </form>

          <p className="text-[12px] text-center mt-6" style={{ opacity: 0.75 }}>
            New here?{" "}
            <a href="/signup" className="font-black" style={{ color: "#f26522", textDecoration: "underline" }}>
              Make an account
            </a>
          </p>
        </div>

        <p className="text-[10px] text-center mt-8 flex items-center justify-center gap-1" style={{ opacity: 0.5 }}>
          Developed by{" "}
          <img src="/adletic-logo.jpg" alt="Adletic" className="h-4 w-4 rounded-sm inline-block" />{" "}
          <span className="font-black">Adletic</span> &copy; 2026
        </p>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,800;1,600;1,700&display=swap');
        .mb-serif-italic { font-style: italic; font-family: 'Fraunces', 'Georgia', 'Times New Roman', serif; font-weight: 600; letter-spacing: -0.01em; }
        .mb-serif-display { font-family: 'Fraunces', 'Georgia', serif; font-weight: 800; font-style: italic; letter-spacing: -0.03em; }
      `}</style>
    </div>
  );
}
