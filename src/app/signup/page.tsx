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

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <img src="/logo-motionboards.jpg" alt="MotionBoards" className="h-16 w-auto rounded-lg" />
        </div>

        <h1 className="text-2xl font-bold text-[#0d1117] text-center mb-1">
          {step === "details" ? "Create your account" : "Choose your plan"}
        </h1>
        <p className="text-sm text-gray-400 text-center mb-6">
          {step === "details"
            ? "Sign up to start generating AI videos"
            : "Select a top-up amount to get started"}
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

        {/* Step 1: Account Details */}
        {step === "details" && (
          <form onSubmit={handleDetailsNext} className="space-y-4">
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
              className="w-full py-3 bg-[#f26522] text-white text-sm font-semibold rounded-xl hover:bg-[#d9541a] transition-colors flex items-center justify-center gap-2"
            >
              Continue
            </button>

            <p className="text-[10px] text-gray-400 text-center mt-2">
              By continuing, you agree to our{" "}
              <a href="/terms" className="text-[#f26522] hover:underline">Terms of Service</a>
              {" & "}
              <a href="/privacy" className="text-[#f26522] hover:underline">Privacy Policy</a>
            </p>
          </form>
        )}

        {/* Step 2: Plan Selection */}
        {step === "plan" && (
          <>
            <button
              type="button"
              onClick={() => setStep("details")}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#f26522] mb-4 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to details
            </button>

            {/* Account summary */}
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5">
              <div className="h-9 w-9 rounded-full bg-[#f26522]/10 flex items-center justify-center text-[#f26522] font-bold text-sm">
                {name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0d1117]">{name}</p>
                <p className="text-[10px] text-gray-400">{email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative text-left rounded-xl border-2 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                    selectedPlan === plan.id
                      ? "border-[#f26522] bg-[#f26522]/5 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 right-3 bg-[#f26522] text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Popular
                    </span>
                  )}

                  {selectedPlan === plan.id && (
                    <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-[#f26522] flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}

                  <p className="text-lg font-bold text-[#0d1117]">{plan.price}</p>
                  <p className="text-xs font-semibold text-[#f26522] mt-0.5">{plan.name}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5 text-[#f26522]" />
                      {plan.credits}
                    </p>
                    <p className="text-[10px] text-gray-400">{plan.gens}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3 bg-[#f26522] text-white text-sm font-semibold rounded-xl hover:bg-[#d9541a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to payment...
                </>
              ) : (
                `Pay ${PLANS.find((p) => p.id === selectedPlan)?.price} & Create Account`
              )}
            </button>

            <p className="text-[10px] text-gray-400 text-center mt-3">
              Secure payment powered by Stripe. Your card details never touch our servers.
            </p>
          </>
        )}

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
