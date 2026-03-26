"use client";

import { useEffect, useState } from "react";
import { Loader2, Zap, History, LogOut, ArrowLeft, Plus } from "lucide-react";

interface UserData {
  id: string;
  name: string;
  email: string;
  credits: number;
  role: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generations, setGenerations] = useState<Array<Record<string, unknown>>>([]);
  const [topupAmount, setTopupAmount] = useState("10");
  const [topupLoading, setTopupLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) { window.location.href = "/login"; return; }
        setUser(data.user);
      })
      .catch(() => (window.location.href = "/login"))
      .finally(() => setLoading(false));

    fetch("/api/generations")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setGenerations(data.slice(0, 20)); })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const handleTopup = async () => {
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount < 10) {
      alert("Minimum top-up is RM10");
      return;
    }
    setTopupLoading(true);
    try {
      const res = await fetch("/api/stripe/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to create checkout session");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setTopupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#f26522]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/generate" className="text-gray-400 hover:text-[#0d1117] transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </a>
            <img src="/logo.jpg" alt="MotionBoards" className="h-8 rounded" />
            <div>
              <h1 className="text-sm font-bold text-[#0d1117]">Dashboard</h1>
              <p className="text-[10px] text-gray-400">Welcome, {user.name}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Credits Card */}
        <div className="bg-gradient-to-br from-[#f26522] to-[#d9541a] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white/70">Your Balance</p>
              <p className="text-4xl font-bold mt-1">RM{(user.credits / 100).toFixed(2)}</p>
              <p className="text-xs text-white/60 mt-1">
                ≈ {Math.floor(user.credits / 100)} generations (avg RM1/gen)
              </p>
            </div>
            <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Zap className="h-8 w-8" />
            </div>
          </div>
        </div>

        {/* Top Up */}
        <div>
          <h2 className="text-sm font-bold text-[#0d1117] mb-1">Top Up Credits</h2>
          <p className="text-xs text-gray-400 mb-4">Enter any amount (minimum RM10). Pay securely via Stripe.</p>
          <div className="flex items-center gap-3 max-w-md">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">RM</span>
              <input
                type="number"
                min="10"
                step="1"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleTopup(); }}
                className="w-full pl-14 pr-4 py-3 text-lg font-bold text-[#0d1117] bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all"
                placeholder="10"
              />
            </div>
            <button
              onClick={handleTopup}
              disabled={topupLoading}
              className="px-6 py-3 bg-[#f26522] text-white text-sm font-bold rounded-xl hover:bg-[#d9541a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
            >
              {topupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Top Up
            </button>
          </div>
        </div>

        {/* Recent Generations */}
        <div>
          <h2 className="text-sm font-bold text-[#0d1117] mb-4 flex items-center gap-2">
            <History className="h-4 w-4 text-gray-400" />
            Recent Generations
          </h2>
          {generations.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">No generations yet. Go create something!</p>
              <a href="/generate" className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-[#f26522] text-white text-xs font-semibold rounded-lg hover:bg-[#d9541a] transition-colors">
                <Plus className="h-3.5 w-3.5" />
                Start Creating
              </a>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Model</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Prompt</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Credits</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {generations.map((gen) => (
                    <tr key={gen.id as string} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-[#0d1117]">{(gen.model as string)?.split("/").pop()}</td>
                      <td className="px-4 py-2.5 text-gray-500 truncate max-w-[200px]">{gen.prompt as string || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          gen.status === "completed" ? "bg-green-50 text-green-600"
                            : gen.status === "failed" ? "bg-red-50 text-red-500"
                            : "bg-yellow-50 text-yellow-600"
                        }`}>
                          {gen.status as string}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#f26522] font-medium">{(gen.creditCost as number) ? `RM${((gen.creditCost as number) / 100).toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {gen.createdAt ? new Date(gen.createdAt as string).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[10px] text-gray-300 text-center pb-4">
          Powered by Adletic Digital Marketing Agency &copy; 2026
        </p>
      </div>
    </div>
  );
}
