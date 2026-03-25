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

const TOPUP_PACKAGES = [
  { credits: 1000, price: "RM10", label: "Starter", description: "RM10 balance · ~10 video gens" },
  { credits: 5000, price: "RM50", label: "Creator", description: "RM50 balance · ~50 video gens", popular: true },
  { credits: 10000, price: "RM100", label: "Pro", description: "RM100 balance · ~100 video gens" },
  { credits: 25000, price: "RM250", label: "Studio", description: "RM250 balance · ~250 video gens" },
];

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generations, setGenerations] = useState<Array<Record<string, unknown>>>([]);

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

  const handleTopup = (pkg: (typeof TOPUP_PACKAGES)[number]) => {
    const msg = `Hi, I'd like to top up my MotionBoards account.\n\nPackage: ${pkg.label} (${pkg.price})\nCredits: ${pkg.credits}\nEmail: ${user?.email}\n\nPlease process my payment.`;
    window.open(`https://wa.me/60112167672?text=${encodeURIComponent(msg)}`, "_blank");
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
          <p className="text-xs text-gray-400 mb-4">Select a package and pay via WhatsApp. Credits added within minutes.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TOPUP_PACKAGES.map((pkg) => (
              <button
                key={pkg.credits}
                onClick={() => handleTopup(pkg)}
                className={`relative text-left rounded-xl border-2 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                  pkg.popular ? "border-[#f26522] bg-[#f26522]/5 shadow-md" : "border-gray-200 bg-white hover:border-[#f26522]/40"
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-2.5 left-3 bg-[#f26522] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                    POPULAR
                  </span>
                )}
                <p className="text-lg font-bold text-[#0d1117]">{pkg.price}</p>
                <p className="text-xs font-semibold text-[#f26522] mt-1">RM{(pkg.credits / 100).toFixed(0)} balance</p>
                <p className="text-[10px] text-gray-400 mt-1">{pkg.description}</p>
              </button>
            ))}
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
