"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, Zap } from "lucide-react";
import { track } from "@/lib/track";

// RM100/month subscription — recorded as event properties so the funnel
// page can show revenue alongside conversion counts.
const SUBSCRIPTION_VALUE_MYR = 100;

const PLAN_FEATURES = [
  "RM100 of credits refreshed every month",
  "Access to every AI model on the canvas",
  "ADletic AI prompt assistant built in",
  "Cancel anytime — no long commitment",
];

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cancelled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cancelled");

  // Track signup form view. If they got here from the Stripe-cancel URL,
  // log a different event so we can spot drop-off at the checkout step.
  useEffect(() => {
    track(cancelled ? "signup_payment_cancelled" : "signup_form_viewed");
  }, [cancelled]);

  const handleSubscribe = async (e: React.FormEvent) => {
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
    setLoading(true);
    // High-intent action: user clicked Subscribe and we're about to send
    // them to Stripe Checkout.
    track("subscribe_clicked", {
      value: SUBSCRIPTION_VALUE_MYR,
      currency: "MYR",
      plan: "MotionBoards Monthly",
      email,
    });
    try {
      const res = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
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

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <img src="/logo.jpg" alt="MotionBoards" className="h-16 w-auto rounded-lg" />
        </div>

        <h1 className="text-2xl font-bold text-[#0d1117] text-center mb-1">
          Subscribe to MotionBoards
        </h1>
        <p className="text-sm text-gray-400 text-center mb-6">
          RM100/month — every AI model, every workflow, one subscription
        </p>

        {cancelled && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs rounded-lg px-3 py-2 mb-4 text-center">
            Payment was cancelled. You can try again.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2 mb-4 text-center">
            {error}
          </div>
        )}

        {/* Plan summary card */}
        <div className="rounded-2xl border-2 border-[#f26522] bg-[#f26522]/5 p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#f26522] mb-1">
                Monthly Subscription
              </p>
              <h2 className="text-lg font-bold text-[#0d1117]">MotionBoards Monthly</h2>
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-black text-[#0d1117] leading-none">RM100</p>
              <p className="text-[10px] text-gray-500 mt-0.5">/ month</p>
            </div>
          </div>
          <ul className="space-y-2">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                <Check className="h-3.5 w-3.5 text-[#f26522] mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubscribe} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm text-[#0d1117] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all"
              placeholder="Your name"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm text-[#0d1117] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all"
              placeholder="you@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2.5 text-sm text-[#0d1117] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all"
              placeholder="Min 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#f26522] text-white text-sm font-semibold rounded-xl hover:bg-[#d9541a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting to payment...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Subscribe RM100/month
              </>
            )}
          </button>

          <p className="text-[10px] text-gray-400 text-center mt-2">
            By continuing, you agree to our{" "}
            <a href="/terms" className="text-[#f26522] hover:underline">Terms of Service</a>
            {" & "}
            <a href="/privacy" className="text-[#f26522] hover:underline">Privacy Policy</a>
            . Secure payment via Stripe. Cancel anytime from your profile.
          </p>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-[#f26522] font-medium hover:underline">Sign in</a>
        </p>

        <p className="text-[10px] text-gray-300 text-center mt-8 flex items-center justify-center gap-1">
          Developed by <img src="/adletic-logo.jpg" alt="Adletic" className="h-4 w-4 rounded-sm inline-block" /> <span className="font-semibold text-gray-400">Adletic</span> &copy; 2026
        </p>
      </div>
    </div>
  );
}
