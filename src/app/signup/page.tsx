"use client";

import { useState } from "react";
import { Loader2, Check, Zap, ArrowLeft } from "lucide-react";

const PLANS = [
  { id: "starter", name: "Starter", price: "RM10", credits: "RM10 balance", gens: "Pay-per-use" },
  { id: "creator", name: "Creator", price: "RM50", credits: "RM50 balance", gens: "Pay-per-use", popular: true },
  { id: "pro", name: "Pro", price: "RM100", credits: "RM100 balance", gens: "Pay-per-use" },
  { id: "studio", name: "Studio", price: "RM250", credits: "RM250 balance", gens: "Pay-per-use" },
];

export default function SignupPage() {
  const [step, setStep] = useState<"details" | "plan">("details");
  const [selectedPlan, setSelectedPlan] = useState("creator");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cancelled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cancelled");

  const handleDetailsNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setStep("plan");
  };

  const handleCheckout = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Checkout failed");
        return;
      }
      window.location.href = data.url;
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
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10" style={{ background: paper, color: ink }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "4px 4px",
          opacity: 0.6,
        }}
      />

      <div className="relative w-full max-w-lg">
        <div
          className="relative rounded-3xl border-[2.5px] p-6"
          style={{
            background: paperDeep,
            borderColor: ink,
            boxShadow: `8px 8px 0 0 ${ink}`,
            transform: "rotate(-0.5deg)",
          }}
        >
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
            New member
          </div>

          <div className="flex justify-center mb-5">
            <img
              src="/logo.jpg"
              alt="MotionBoards"
              className="h-16 rounded-xl border-[2.5px]"
              style={{ borderColor: ink, boxShadow: `3px 3px 0 0 ${ink}` }}
            />
          </div>

          <span className="mb-serif-italic block text-center text-[13px] opacity-70">
            — {step === "details" ? "chapter one" : "pick a tier"} —
          </span>
          <h1 className="mb-serif-display text-center leading-none mt-1" style={{ fontSize: "2rem" }}>
            {step === "details" ? "Make an account." : "Pick your vibe."}
          </h1>
          <p className="text-[13px] text-center mt-2" style={{ opacity: 0.75 }}>
            {step === "details" ? "Sign up and start generating." : "Top up your balance to begin."}
          </p>

          {cancelled && (
            <div
              className="mt-4 rounded-xl border-[2.5px] px-3 py-2 text-[12px] font-bold text-center"
              style={{ background: "#fff", color: "#a16207", borderColor: "#f59e0b", boxShadow: `3px 3px 0 0 ${ink}` }}
            >
              Payment was cancelled. You can try again.
            </div>
          )}

          {error && (
            <div
              className="mt-4 rounded-xl border-[2.5px] px-3 py-2 text-[12px] font-bold text-center"
              style={{ background: "#fff", color: "#dc2626", borderColor: "#dc2626", boxShadow: `3px 3px 0 0 ${ink}` }}
            >
              {error}
            </div>
          )}

          {step === "details" && (
            <form onSubmit={handleDetailsNext} className="mt-5 space-y-4">
              <div>
                <label className="block text-[10.5px] font-black uppercase tracking-wider mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border-[2.5px] px-3 py-2.5 text-sm outline-none"
                  style={inputStyle}
                  placeholder="Your name"
                  autoFocus
                />
              </div>

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
                  minLength={6}
                  className="w-full rounded-xl border-[2.5px] px-3 py-2.5 text-sm outline-none"
                  style={inputStyle}
                  placeholder="Min 6 characters"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border-[2.5px] px-4 py-3 text-[13px] font-black uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: "#f26522", borderColor: ink, boxShadow: `4px 4px 0 0 ${ink}`, transform: "rotate(-1deg)" }}
              >
                Continue
              </button>

              <p className="text-[10.5px] text-center" style={{ opacity: 0.6 }}>
                By continuing, you agree to our{" "}
                <a href="/terms" className="font-black" style={{ color: "#f26522", textDecoration: "underline" }}>Terms</a>
                {" & "}
                <a href="/privacy" className="font-black" style={{ color: "#f26522", textDecoration: "underline" }}>Privacy Policy</a>
              </p>
            </form>
          )}

          {step === "plan" && (
            <>
              <button
                type="button"
                onClick={() => setStep("details")}
                className="mt-4 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
                style={{ color: ink, opacity: 0.7 }}
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>

              <div
                className="mt-3 flex items-center gap-3 rounded-2xl border-[2.5px] px-4 py-3"
                style={{ background: "#fff", borderColor: ink, boxShadow: `3px 3px 0 0 ${ink}` }}
              >
                <div
                  className="h-9 w-9 rounded-full border-2 flex items-center justify-center font-black text-white"
                  style={{ background: "#f26522", borderColor: ink }}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-black">{name}</p>
                  <p className="text-[10.5px]" style={{ opacity: 0.7 }}>{email}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {PLANS.map((plan, i) => {
                  const selected = selectedPlan === plan.id;
                  const tilt = i % 2 === 0 ? -1 : 1;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className="relative rounded-2xl border-[2.5px] p-4 text-left transition-transform hover:-translate-y-0.5"
                      style={{
                        background: selected ? "#f26522" : "#fff",
                        color: selected ? "#fff" : ink,
                        borderColor: ink,
                        boxShadow: selected ? `4px 4px 0 0 ${ink}` : `2px 2px 0 0 ${ink}`,
                        transform: `rotate(${tilt}deg)`,
                      }}
                    >
                      {plan.popular && (
                        <span
                          className="absolute -top-3 right-3 rounded-md border-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                          style={{ background: "#fff", color: "#f26522", borderColor: ink, transform: "rotate(3deg)", boxShadow: `2px 2px 0 0 ${ink}` }}
                        >
                          Popular
                        </span>
                      )}

                      {selected && (
                        <div
                          className="absolute top-3 right-3 h-6 w-6 rounded-full border-2 flex items-center justify-center"
                          style={{ background: "#fff", borderColor: ink }}
                        >
                          <Check className="h-3.5 w-3.5" style={{ color: "#f26522" }} />
                        </div>
                      )}

                      <p className="mb-serif-display text-[1.4rem] leading-none" style={{ color: selected ? "#fff" : ink }}>
                        {plan.price}
                      </p>
                      <p className="text-xs font-black mt-1">{plan.name}</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] font-bold flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5" /> {plan.credits}
                        </p>
                        <p className="text-[10px] font-bold" style={{ opacity: 0.8 }}>{plan.gens}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full border-[2.5px] px-4 py-3 text-[13px] font-black uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
                style={{ background: "#f26522", borderColor: ink, boxShadow: `4px 4px 0 0 ${ink}`, transform: "rotate(-1deg)" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting to payment…
                  </>
                ) : (
                  `Pay ${PLANS.find((p) => p.id === selectedPlan)?.price} & Start`
                )}
              </button>

              <p className="mt-3 text-[10.5px] text-center" style={{ opacity: 0.6 }}>
                Secure payment via Stripe. Your card never touches our servers.
              </p>
            </>
          )}

          <p className="text-[12px] text-center mt-6" style={{ opacity: 0.75 }}>
            Already have one?{" "}
            <a href="/login" className="font-black" style={{ color: "#f26522", textDecoration: "underline" }}>Sign in</a>
          </p>
        </div>

        <p className="text-[10px] text-center mt-8 flex items-center justify-center gap-1" style={{ opacity: 0.5 }}>
          Developed by <img src="/adletic-logo.jpg" alt="Adletic" className="h-4 w-4 rounded-sm inline-block" />{" "}
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
