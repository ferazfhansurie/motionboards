"use client";

import { useEffect, useState } from "react";
import { X, Zap, History, LogOut, Loader2, CreditCard, Clock, AlertTriangle, RotateCcw, Trash2, Save, Lock, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useAppStore, saveBoardSnapshotWithLabel } from "@/lib/store";

interface VersionSummary {
  id: string;
  label: string;
  itemCount: number;
  boardCount: number;
  createdAt: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  credits: number;
  role: string;
}

interface ExportJob {
  id: string;
  boardName: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  total: number;
  fileId: string | null;
  fileName: string | null;
  error: string | null;
  createdAt: string;
}

// ============ PROFILE PANEL ============
export function ProfilePanel() {
  const { isProfileOpen, setProfileOpen, theme, autoConnectGenerations, setAutoConnectGenerations, restoreBoardsSnapshot } = useAppStore();
  const isDark = theme === "dark";
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  // Version history
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [savingVersion, setSavingVersion] = useState(false);
  const [versionStatus, setVersionStatus] = useState<string | null>(null);

  const loadVersions = async () => {
    setVersionsLoading(true);
    try {
      const res = await fetch("/api/board-versions");
      const data = await res.json();
      if (Array.isArray(data.versions)) setVersions(data.versions);
    } catch {
      // noop
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRestore = async (id: string, label: string) => {
    if (!confirm(`Restore snapshot "${label}"? Your current canvas will be replaced.`)) return;
    setRestoringId(id);
    try {
      const res = await fetch(`/api/board-versions/${id}`);
      const data = await res.json();
      if (res.ok && data.version?.data) {
        restoreBoardsSnapshot(data.version.data);
        setVersionStatus("Restored — canvas has been replaced with the snapshot.");
      } else {
        setVersionStatus(data.error || "Restore failed");
      }
    } catch {
      setVersionStatus("Restore failed");
    } finally {
      setRestoringId(null);
      setTimeout(() => setVersionStatus(null), 4000);
    }
  };

  const handleDeleteVersion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this snapshot?")) return;
    try {
      await fetch(`/api/board-versions/${id}`, { method: "DELETE" });
      setVersions((prev) => prev.filter((v) => v.id !== id));
    } catch {
      // noop
    }
  };

  const handleSaveNow = async () => {
    setSavingVersion(true);
    setVersionStatus(null);
    const { ok, error } = await saveBoardSnapshotWithLabel(useAppStore.getState(), "Manual checkpoint");
    if (ok) {
      setVersionStatus("Checkpoint saved");
      loadVersions();
    } else {
      setVersionStatus(error || "Save failed");
    }
    setSavingVersion(false);
    setTimeout(() => setVersionStatus(null), 3000);
  };

  useEffect(() => {
    if (showVersions) loadVersions();
  }, [showVersions]);

  // Recent exports (background board exports run via after())
  const [showExports, setShowExports] = useState(false);
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [exportsLoading, setExportsLoading] = useState(false);

  const loadExports = async () => {
    setExportsLoading(true);
    try {
      const res = await fetch("/api/board-exports");
      const data = await res.json();
      if (Array.isArray(data.jobs)) setExports(data.jobs);
    } catch {
      // noop
    } finally {
      setExportsLoading(false);
    }
  };

  const handleDeleteExport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remove this export from your history?")) return;
    try {
      await fetch(`/api/board-exports/${id}`, { method: "DELETE" });
      setExports((prev) => prev.filter((j) => j.id !== id));
    } catch {
      // noop
    }
  };

  // Load on open + poll while any job is pending/processing
  useEffect(() => {
    if (!showExports) return;
    loadExports();
    const interval = setInterval(() => {
      setExports((prev) => {
        if (prev.some((j) => j.status === "pending" || j.status === "processing")) {
          loadExports();
        }
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [showExports]);

  // Change password
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwStatus, setPwStatus] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setPwStatus(null);
    if (!currentPw) { setPwStatus("Enter your current password"); return; }
    if (newPw.length < 8) { setPwStatus("New password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { setPwStatus("Passwords don't match"); return; }
    setChangingPw(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPwStatus("Password updated");
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
        setTimeout(() => { setShowChangePw(false); setPwStatus(null); }, 1500);
      } else {
        setPwStatus(data.error || "Failed to change password");
      }
    } catch {
      setPwStatus("Failed to change password");
    } finally {
      setChangingPw(false);
    }
  };
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

              {/* Storage notice */}
              <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${isDark ? "border-amber-500/20 bg-amber-500/5" : "border-amber-200 bg-amber-50"}`}>
                <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                <div>
                  <p className={`text-[10px] font-semibold ${isDark ? "text-amber-300" : "text-amber-800"}`}>Files auto-delete after 14 days</p>
                  <p className={`text-[9px] mt-0.5 ${isDark ? "text-amber-300/70" : "text-amber-700"}`}>
                    Uploaded images, videos, audio, and AI-generated outputs are stored temporarily. Download anything you want to keep before it expires.
                  </p>
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-2">
                <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? "text-gray-500" : "text-gray-400"}`}>Settings</p>
                <label className={`flex items-center justify-between gap-3 cursor-pointer px-2.5 py-2 rounded-lg border transition-colors ${isDark ? "border-gray-700 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"}`}>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-semibold ${isDark ? "text-white" : "text-[#0d1117]"}`}>Auto-link generations</p>
                    <p className={`text-[9px] mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      Draw lines from input refs / start &amp; end frames into each new generation card.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoConnectGenerations}
                    onChange={(e) => setAutoConnectGenerations(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-[#f26522] shrink-0"
                  />
                </label>
              </div>

              {/* Version history */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? "text-gray-500" : "text-gray-400"}`}>Version history</p>
                  <button
                    type="button"
                    onClick={() => setShowVersions(!showVersions)}
                    className={`text-[10px] transition-colors ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-[#0d1117]"}`}
                  >
                    {showVersions ? "Hide" : "Show"}
                  </button>
                </div>
                <p className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  Snapshots of your canvas. Auto-saved every 15 min of activity, kept for 14 days.
                </p>

                <button
                  type="button"
                  onClick={handleSaveNow}
                  disabled={savingVersion}
                  className={`w-full flex items-center justify-center gap-1.5 text-[11px] px-2.5 py-2 rounded-lg border font-semibold transition-colors ${
                    savingVersion
                      ? isDark ? "border-gray-700 text-gray-500" : "border-gray-200 text-gray-400"
                      : isDark ? "border-gray-700 text-white hover:bg-white/5" : "border-gray-200 text-[#0d1117] hover:bg-gray-50"
                  }`}
                >
                  {savingVersion ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save checkpoint now
                </button>

                {versionStatus && (
                  <p className={`text-[9px] ${versionStatus.toLowerCase().includes("fail") || versionStatus.toLowerCase().includes("error") ? "text-red-500" : "text-emerald-500"}`}>
                    {versionStatus}
                  </p>
                )}

                {showVersions && (
                  <div className={`rounded-lg border max-h-[200px] overflow-y-auto ${isDark ? "border-gray-700 bg-[#0d1117]" : "border-gray-200 bg-gray-50"}`}>
                    {versionsLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-[#f26522]" />
                      </div>
                    ) : versions.length === 0 ? (
                      <p className={`text-center py-4 text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        No snapshots yet — keep editing and they&rsquo;ll appear here.
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {versions.map((v) => (
                          <div key={v.id} className="flex items-center gap-1.5 px-2 py-1.5 group">
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] font-medium truncate ${isDark ? "text-white" : "text-[#0d1117]"}`}>
                                {v.label}
                              </p>
                              <p className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                {v.boardCount} board{v.boardCount === 1 ? "" : "s"} · {v.itemCount} item{v.itemCount === 1 ? "" : "s"} · {new Date(v.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={restoringId === v.id}
                              onClick={() => handleRestore(v.id, v.label)}
                              className={`rounded p-1 transition-colors ${restoringId === v.id ? "text-gray-400" : "text-[#f26522] hover:bg-[#f26522]/10"}`}
                              title="Restore this snapshot"
                            >
                              {restoringId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteVersion(v.id, e)}
                              className="opacity-0 group-hover:opacity-100 rounded p-1 text-gray-400 hover:text-red-500 transition-all"
                              title="Delete snapshot"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recent exports (background export jobs) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? "text-gray-500" : "text-gray-400"}`}>Recent exports</p>
                  <button
                    type="button"
                    onClick={() => setShowExports(!showExports)}
                    className={`text-[10px] transition-colors ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-[#0d1117]"}`}
                  >
                    {showExports ? "Hide" : "Show"}
                  </button>
                </div>
                <p className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  Background board exports — keep running if you close the tab. Files auto-delete after 14 days.
                </p>
                {showExports && (
                  <div className={`rounded-lg border max-h-[200px] overflow-y-auto ${isDark ? "border-gray-700 bg-[#0d1117]" : "border-gray-200 bg-gray-50"}`}>
                    {exportsLoading && exports.length === 0 ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-[#f26522]" />
                      </div>
                    ) : exports.length === 0 ? (
                      <p className={`text-center py-4 text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        No exports yet. Kick one off from the board menu.
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {exports.map((job) => (
                          <div key={job.id} className="flex items-center gap-1.5 px-2 py-1.5 group">
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] font-medium truncate ${isDark ? "text-white" : "text-[#0d1117]"}`}>
                                {job.boardName}
                              </p>
                              <p className={`text-[9px] ${
                                job.status === "failed" ? "text-red-500"
                                : job.status === "completed" ? "text-emerald-500"
                                : "text-[#f26522]"
                              }`}>
                                {job.status === "pending" && "Queued..."}
                                {job.status === "processing" && `Processing ${job.progress}/${job.total}...`}
                                {job.status === "completed" && `Ready · ${new Date(job.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                                {job.status === "failed" && `Failed: ${job.error || "unknown"}`}
                              </p>
                            </div>
                            {job.status === "completed" && job.fileId && (
                              <a
                                href={`/api/files/${job.fileId}`}
                                download={job.fileName || `${job.boardName}.mbboard.json`}
                                className="rounded p-1 text-[#f26522] hover:bg-[#f26522]/10 transition-colors"
                                title="Download"
                              >
                                <Save className="h-3 w-3" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteExport(job.id, e)}
                              className="opacity-0 group-hover:opacity-100 rounded p-1 text-gray-400 hover:text-red-500 transition-all"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Change password */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowChangePw(!showChangePw)}
                  className={`w-full flex items-center justify-center gap-1.5 text-[11px] px-2.5 py-2 rounded-lg border font-semibold transition-colors ${
                    isDark ? "border-gray-700 text-white hover:bg-white/5" : "border-gray-200 text-[#0d1117] hover:bg-gray-50"
                  }`}
                >
                  <Lock className="h-3 w-3" />
                  {showChangePw ? "Cancel" : "Change password"}
                </button>
                {showChangePw && (
                  <div className={`rounded-lg border p-3 space-y-2 ${isDark ? "border-gray-700 bg-[#0d1117]" : "border-gray-200 bg-gray-50"}`}>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        placeholder="Current password"
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        className={`w-full rounded-md border text-[11px] px-2.5 py-1.5 pr-7 focus:outline-none focus:border-[#f26522] focus:ring-1 focus:ring-[#f26522]/20 ${
                          isDark ? "bg-[#161b22] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-200 text-[#0d1117] placeholder-gray-400"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        placeholder="New password (min 8 chars)"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className={`w-full rounded-md border text-[11px] px-2.5 py-1.5 pr-7 focus:outline-none focus:border-[#f26522] focus:ring-1 focus:ring-[#f26522]/20 ${
                          isDark ? "bg-[#161b22] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-200 text-[#0d1117] placeholder-gray-400"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </div>
                    <input
                      type={showNewPw ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword(); }}
                      className={`w-full rounded-md border text-[11px] px-2.5 py-1.5 focus:outline-none focus:border-[#f26522] focus:ring-1 focus:ring-[#f26522]/20 ${
                        isDark ? "bg-[#161b22] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-200 text-[#0d1117] placeholder-gray-400"
                      }`}
                    />
                    {pwStatus && (
                      <p className={`text-[10px] ${pwStatus.toLowerCase().includes("updated") ? "text-emerald-500" : "text-red-500"}`}>
                        {pwStatus}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={changingPw}
                      className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-[#f26522] hover:bg-[#d9541a] transition-colors disabled:opacity-50"
                    >
                      {changingPw ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Update password
                    </button>
                  </div>
                )}
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
            <div className="py-3 flex flex-col gap-2 items-stretch">
              <div className="flex flex-col items-center gap-1 pb-2">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
                  <LogIn className={`h-5 w-5 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
                </div>
                <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-[#0d1117]"}`}>You're not signed in</p>
                <p className={`text-[11px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  Sign in to save work, buy credits, and share generations.
                </p>
              </div>
              <a
                href="/login"
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-[#f26522] hover:bg-[#d9541a] rounded-lg py-2 transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                Login
              </a>
              <a
                href="/signup"
                className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-2 border transition-colors ${
                  isDark
                    ? "border-gray-700 text-gray-200 hover:border-[#f26522] hover:text-[#f26522]"
                    : "border-gray-200 text-[#0d1117] hover:border-[#f26522] hover:text-[#f26522]"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Create account
              </a>
            </div>
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
