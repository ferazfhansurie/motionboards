"use client";

import { useEffect, useState } from "react";
import { X, Zap, History, LogOut, Loader2, CreditCard, Clock } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface UserData {
  id: string;
  name: string;
  email: string;
  credits: number;
  role: string;
}

// ============ PROFILE PANEL ============
export function ProfilePanel() {
  const { isProfileOpen, setProfileOpen, theme } = useAppStore();
  const isDark = theme === "dark";
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState("10");

  useEffect(() => {
    if (!isProfileOpen) return;
    setLoading(true);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => { if (data.user) setUser(data.user); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isProfileOpen]);

  if (!isProfileOpen) return null;

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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="absolute right-2 bottom-12 z-[60] w-[340px]">
      <div className={`rounded-2xl border shadow-2xl overflow-hidden ${isDark ? "border-gray-700 bg-[#161b22]" : "border-gray-200 bg-white"}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? "border-gray-700" : "border-gray-100"}`}>
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#f26522] text-white">
              <Zap className="h-3 w-3" />
            </div>
            <h3 className={`text-xs font-bold ${isDark ? "text-white" : "text-[#0d1117]"}`}>Profile</h3>
          </div>
          <button
            className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={() => setProfileOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[#f26522]" />
            </div>
          ) : user ? (
            <>
              {/* User info */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#f26522]/10 flex items-center justify-center text-[#f26522] font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#0d1117]"}`}>{user.name}</p>
                  <p className="text-[10px] text-gray-400">{user.email}</p>
                </div>
              </div>

              {/* Balance */}
              <div className="bg-gradient-to-br from-[#f26522] to-[#d9541a] rounded-xl p-3.5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-white/70">Balance</p>
                    <p className="text-2xl font-bold">RM{(user.credits / 100).toFixed(2)}</p>
                  </div>
                  <CreditCard className="h-6 w-6 text-white/30" />
                </div>
              </div>

              {/* Top Up */}
              <div>
                <p className={`text-[11px] font-bold mb-2 ${isDark ? "text-white" : "text-[#0d1117]"}`}>Top Up</p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${isDark ? "text-gray-400" : "text-gray-500"}`}>RM</span>
                    <input
                      type="number"
                      min="10"
                      step="1"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleTopup(); }}
                      className={`w-full pl-10 pr-3 py-2.5 text-sm font-bold rounded-xl border transition-all focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 ${
                        isDark ? "bg-[#0d1117] text-white border-gray-700" : "bg-gray-50 text-[#0d1117] border-gray-200"
                      }`}
                      placeholder="10"
                    />
                  </div>
                  <button
                    onClick={handleTopup}
                    disabled={topupLoading}
                    className="px-4 py-2.5 bg-[#f26522] text-white text-xs font-bold rounded-xl hover:bg-[#d9541a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                  >
                    {topupLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    Top Up
                  </button>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5">Minimum RM10. Enter any amount.</p>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className={`w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors py-2 border rounded-lg hover:border-red-200 ${isDark ? "border-gray-700" : "border-gray-100"}`}
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">Not logged in</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ HISTORY PANEL ============
export function HistoryPanel() {
  const { isHistoryOpen, setHistoryOpen, theme } = useAppStore();
  const isDark = theme === "dark";
  const [generations, setGenerations] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHistoryOpen) return;
    setLoading(true);
    fetch("/api/generations")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setGenerations(data.slice(0, 20)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isHistoryOpen]);

  if (!isHistoryOpen) return null;

  return (
    <div className="absolute right-2 bottom-12 z-[60] w-[380px]">
      <div className={`rounded-2xl border shadow-2xl overflow-hidden ${isDark ? "border-gray-700 bg-[#161b22]" : "border-gray-200 bg-white"}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? "border-gray-700" : "border-gray-100"}`}>
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#f26522] text-white">
              <History className="h-3 w-3" />
            </div>
            <h3 className={`text-xs font-bold ${isDark ? "text-white" : "text-[#0d1117]"}`}>Recent Generations</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? "text-gray-400 bg-gray-800" : "text-gray-400 bg-gray-100"}`}>
              {generations.length}
            </span>
          </div>
          <button
            className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={() => setHistoryOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#f26522]" />
            </div>
          ) : generations.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="h-6 w-6 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No generations yet</p>
            </div>
          ) : (
            <div className={`divide-y ${isDark ? "divide-gray-800" : "divide-gray-50"}`}>
              {generations.map((gen) => (
                <div key={gen.id as string} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
                  {/* Thumbnail */}
                  {gen.outputUrl ? (
                    <img
                      src={gen.outputUrl as string}
                      alt=""
                      className={`h-9 w-9 rounded-md object-cover border shrink-0 ${isDark ? "border-gray-700" : "border-gray-100"}`}
                    />
                  ) : (
                    <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${isDark ? "bg-gray-800" : "bg-gray-100"}`}>
                      <Clock className="h-3.5 w-3.5 text-gray-300" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-medium truncate ${isDark ? "text-white" : "text-[#0d1117]"}`}>
                      {(gen.model as string)?.split("/").pop()}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{gen.prompt as string || "No prompt"}</p>
                  </div>

                  {/* Status + Cost */}
                  <div className="text-right shrink-0">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                      gen.status === "completed" ? "bg-green-50 text-green-600"
                        : gen.status === "failed" ? "bg-red-50 text-red-500"
                        : "bg-yellow-50 text-yellow-600"
                    }`}>
                      {gen.status as string}
                    </span>
                    <p className="text-[9px] text-[#f26522] font-medium mt-0.5">
                      {(gen.creditCost as number) ? `RM${((gen.creditCost as number) / 100).toFixed(2)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Keep old DashboardModal for backward compat (unused now)
export function DashboardModal() {
  return null;
}
