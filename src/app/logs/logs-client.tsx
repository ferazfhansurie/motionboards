"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Generation {
  id: string;
  prompt: string;
  model: string;
  provider: string;
  mode: string;
  status: string;
  inputImage?: string | null;
  outputUrl?: string | null;
  duration?: number | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  credits: number;
  role: "user" | "admin";
  createdAt: string;
}

type Tab = "generations" | "users";

export default function LogsClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("generations");
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchGenerations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generations");
      const data = await res.json();
      setGenerations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch generations:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchGenerations();
    fetchUsers();
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/generations?id=${id}`, { method: "DELETE" });
      setGenerations((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-neutral-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-400 bg-green-500/10";
      case "failed":
        return "text-red-400 bg-red-500/10";
      case "processing":
        return "text-yellow-400 bg-yellow-500/10";
      default:
        return "text-neutral-400 bg-neutral-500/10";
    }
  };

  const failedCount = generations.filter((g) => g.status === "failed").length;
  const completedCount = generations.filter((g) => g.status === "completed").length;

  return (
    <div className="min-h-screen bg-[#08131f] text-white">
      {/* Header */}
      <div className="border-b border-neutral-800 bg-[#0d1f30]/80">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/generate")}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-base font-semibold">Admin Logs</h1>
              <p className="text-[11px] text-neutral-500">
                {tab === "generations" ? (
                  <>
                    {generations.length} total &middot;{" "}
                    <span className="text-green-400">{completedCount} completed</span> &middot;{" "}
                    <span className="text-red-400">{failedCount} failed</span>
                  </>
                ) : (
                  <>{users.length} registered user{users.length === 1 ? "" : "s"}</>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={tab === "generations" ? fetchGenerations : fetchUsers}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${(tab === "generations" ? loading : usersLoading) ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {/* Tabs */}
        <div className="mx-auto max-w-5xl flex items-center gap-1 px-6 pb-2">
          {(["generations", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-xs transition-colors ${tab === t ? "bg-[#f26522]/15 text-[#f26522]" : "text-neutral-400 hover:bg-neutral-800 hover:text-white"}`}
            >
              {t === "generations" ? "Generations" : "Users"}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner if latest generation failed */}
      {generations.length > 0 && generations[0].status === "failed" && (
        <div className="mx-auto max-w-5xl px-6 pt-4">
          <div className="flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">Latest generation failed</p>
              <p className="text-xs text-red-400/70 mt-1">
                <span className="font-mono">{generations[0].error}</span>
              </p>
              {generations[0].error?.includes("Forbidden") && (
                <p className="text-xs text-neutral-400 mt-2">
                  This usually means your API key has no credits. Top up at the relevant provider dashboard.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-6">
        {tab === "generations" ? (
          loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
          </div>
        ) : generations.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-neutral-500">No generations yet. Go create something.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {generations.map((gen) => (
              <div
                key={gen.id}
                className="group flex items-start gap-4 rounded-lg border border-neutral-800 bg-[#0d1f30]/80 p-4 hover:border-neutral-700 transition-colors"
              >
                {/* Status */}
                <div className="mt-0.5">{getStatusIcon(gen.status)}</div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${getStatusColor(gen.status)}`}
                    >
                      {gen.status.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-medium text-[#f26522] bg-[#f26522]/10 rounded-md px-1.5 py-0.5">
                      {gen.model.split("/").pop()}
                    </span>
                    <span className="text-[10px] text-neutral-600 bg-neutral-800 rounded-md px-1.5 py-0.5">
                      {gen.provider}
                    </span>
                    <span className="text-[10px] text-neutral-600 bg-neutral-800 rounded-md px-1.5 py-0.5">
                      {gen.mode}
                    </span>
                  </div>

                  {/* Prompt */}
                  {gen.prompt && (
                    <p className="mt-1.5 text-xs text-neutral-300 line-clamp-2">
                      {gen.prompt}
                    </p>
                  )}

                  {/* Error message */}
                  {gen.error && (
                    <p className="mt-1.5 text-xs text-red-400/80 font-mono bg-red-500/5 rounded px-2 py-1">
                      {gen.error}
                    </p>
                  )}

                  {/* Output URL */}
                  {gen.outputUrl && (
                    <a
                      href={gen.outputUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#f26522] hover:underline"
                    >
                      View output <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {/* Meta */}
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-neutral-600">
                    <span>{formatDate(gen.createdAt)}</span>
                    {gen.duration != null && (
                      <span>{gen.duration.toFixed(1)}s</span>
                    )}
                    <span className="font-mono text-neutral-700">{gen.id}</span>
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(gen.id)}
                  disabled={deleting === gen.id}
                  className="rounded p-1.5 text-neutral-600 hover:bg-neutral-800 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  {deleting === gen.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )
        ) : (
          // Users tab
          usersLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm text-neutral-500">No registered users yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-800 bg-[#0d1f30]/80">
              <table className="w-full text-xs">
                <thead className="bg-neutral-900/50 text-left text-[10px] uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Role</th>
                    <th className="px-4 py-2 font-medium text-right">Credits (RM)</th>
                    <th className="px-4 py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                      <td className="px-4 py-2 font-mono text-neutral-200">{u.email}</td>
                      <td className="px-4 py-2 text-neutral-300">{u.name}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${u.role === "admin" ? "bg-[#f26522]/15 text-[#f26522]" : "bg-neutral-800 text-neutral-400"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-neutral-300">{(u.credits / 100).toFixed(2)}</td>
                      <td className="px-4 py-2 text-neutral-500">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
