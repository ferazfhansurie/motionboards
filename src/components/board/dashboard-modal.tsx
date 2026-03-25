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

const TOPUP_PACKAGES = [
  { credits: 1000, price: "RM10", label: "Starter", description: "~10 video gens" },
  { credits: 5000, price: "RM50", label: "Creator", description: "~50 video gens", popular: true },
  { credits: 10000, price: "RM100", label: "Pro", description: "~100 video gens" },
  { credits: 25000, price: "RM250", label: "Studio", description: "~250 video gens" },
];

// ============ PROFILE PANEL ============
export function ProfilePanel() {
  const { isProfileOpen, setProfileOpen } = useAppStore();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleTopup = (pkg: (typeof TOPUP_PACKAGES)[number]) => {
    const msg = `Hi, I'd like to top up my MotionBoards account.\n\nPackage: ${pkg.label} (${pkg.price})\nEmail: ${user?.email}\n\nPlease process my payment.`;
    window.open(`https://wa.me/60112167672?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="absolute right-2 bottom-10 z-50 w-[340px]">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#f26522] text-white">
              <Zap className="h-3 w-3" />
            </div>
            <h3 className="text-xs font-bold text-[#0d1117]">Profile</h3>
          </div>
          <button
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
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
                  <p className="text-sm font-semibold text-[#0d1117]">{user.name}</p>
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
                <p className="text-[11px] font-bold text-[#0d1117] mb-2">Top Up via WhatsApp</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TOPUP_PACKAGES.map((pkg) => (
                    <button
                      key={pkg.credits}
                      onClick={() => handleTopup(pkg)}
                      className={`relative text-left rounded-lg border p-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                        pkg.popular ? "border-[#f26522] bg-[#f26522]/5" : "border-gray-200 bg-white"
                      }`}
                    >
                      {pkg.popular && (
                        <span className="absolute -top-2 right-2 bg-[#f26522] text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full">
                          POPULAR
                        </span>
                      )}
                      <p className="text-sm font-bold text-[#0d1117]">{pkg.price}</p>
                      <p className="text-[9px] text-gray-400">{pkg.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors py-2 border border-gray-100 rounded-lg hover:border-red-200"
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
  const { isHistoryOpen, setHistoryOpen } = useAppStore();
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
    <div className="absolute right-2 bottom-10 z-50 w-[380px]">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#f26522] text-white">
              <History className="h-3 w-3" />
            </div>
            <h3 className="text-xs font-bold text-[#0d1117]">Recent Generations</h3>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {generations.length}
            </span>
          </div>
          <button
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
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
            <div className="divide-y divide-gray-50">
              {generations.map((gen) => (
                <div key={gen.id as string} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  {/* Thumbnail */}
                  {gen.outputUrl ? (
                    <img
                      src={gen.outputUrl as string}
                      alt=""
                      className="h-9 w-9 rounded-md object-cover border border-gray-100 shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                      <Clock className="h-3.5 w-3.5 text-gray-300" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[#0d1117] truncate">
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
