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
  TrendingDown,
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

interface FunnelSignup {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  subscriptionActive: boolean;
  loggedIn: boolean;
  generationCount: number;
  completedCount: number;
}

interface EventCount {
  eventName: string;
  count: number;
  uniqueAnons: number;
  uniqueUsers: number;
}

interface PathImpression {
  pathname: string;
  count: number;
  uniqueVisitors: number;
}

interface FunnelMetrics {
  rangeDays: number | null;
  signedUp: number;
  loggedIn: number;
  subscriptionActive: number;
  madeGeneration: number;
  completedGeneration: number;
  stillSubscribed: number;
  medianMinutesToFirstGen: number | null;
  avgGenerationsPerActive: number | null;
  totalGenerations: number;
  totalCompletedGenerations: number;
  totalFailedGenerations: number;
  signups: FunnelSignup[];
  events: EventCount[];
  topPaths: PathImpression[];
}

type Tab = "generations" | "users" | "funnel";
type FunnelRange = "1" | "7" | "30" | "all";

export default function LogsClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("generations");
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<FunnelMetrics | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [funnelRange, setFunnelRange] = useState<FunnelRange>("30");

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

  const fetchFunnel = async (range: FunnelRange) => {
    setFunnelLoading(true);
    try {
      const res = await fetch(`/api/admin/funnel?days=${range}`);
      const data = await res.json();
      if (data && typeof data.signedUp === "number") setFunnel(data);
    } catch (err) {
      console.error("Failed to fetch funnel:", err);
    } finally {
      setFunnelLoading(false);
    }
  };

  useEffect(() => {
    fetchGenerations();
    fetchUsers();
    fetchFunnel(funnelRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch funnel when range changes
  useEffect(() => {
    fetchFunnel(funnelRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelRange]);

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
                ) : tab === "users" ? (
                  <>{users.length} registered user{users.length === 1 ? "" : "s"}</>
                ) : (
                  <>Registration funnel — {funnelRange === "all" ? "all time" : `last ${funnelRange}d`}</>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (tab === "generations") fetchGenerations();
              else if (tab === "users") fetchUsers();
              else fetchFunnel(funnelRange);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${(tab === "generations" ? loading : tab === "users" ? usersLoading : funnelLoading) ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {/* Tabs */}
        <div className="mx-auto max-w-5xl flex items-center gap-1 px-6 pb-2">
          {(["generations", "users", "funnel"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-xs transition-colors ${tab === t ? "bg-[#f26522]/15 text-[#f26522]" : "text-neutral-400 hover:bg-neutral-800 hover:text-white"}`}
            >
              {t === "generations" ? "Generations" : t === "users" ? "Users" : "Funnel"}
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
        ) : tab === "users" ? (
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
        ) : (
          // Funnel tab
          <FunnelView
            funnel={funnel}
            loading={funnelLoading}
            range={funnelRange}
            onRangeChange={setFunnelRange}
          />
        )}
      </div>
    </div>
  );
}

// ---- Funnel view ----------------------------------------------------------

interface FunnelStage {
  key: string;
  label: string;
  description: string;
  value: number;
}

function FunnelView({
  funnel,
  loading,
  range,
  onRangeChange,
}: {
  funnel: FunnelMetrics | null;
  loading: boolean;
  range: FunnelRange;
  onRangeChange: (r: FunnelRange) => void;
}) {
  if (loading && !funnel) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }
  if (!funnel) {
    return <p className="text-center py-20 text-sm text-neutral-500">No funnel data.</p>;
  }

  const stages: FunnelStage[] = [
    { key: "signedUp", label: "Signed up", description: "Created an account", value: funnel.signedUp },
    { key: "loggedIn", label: "Logged in at least once", description: "Has an active or expired session", value: funnel.loggedIn },
    { key: "subscriptionActive", label: "Started a subscription", description: "Stripe subscription created (paid)", value: funnel.subscriptionActive },
    { key: "madeGeneration", label: "Made a generation", description: "Submitted any prompt to a model", value: funnel.madeGeneration },
    { key: "completedGeneration", label: "Got a successful output", description: "At least one generation completed", value: funnel.completedGeneration },
    { key: "stillSubscribed", label: "Still subscribed today", description: "subscription_active and not expired", value: funnel.stillSubscribed },
  ];

  const top = stages[0].value || 1; // avoid div/0
  const ranges: { value: FunnelRange; label: string }[] = [
    { value: "1", label: "Today" },
    { value: "7", label: "7 days" },
    { value: "30", label: "30 days" },
    { value: "all", label: "All time" },
  ];

  // Conversion to first generation, paid signup, retention
  const convToFirstGen = funnel.signedUp > 0 ? (funnel.madeGeneration / funnel.signedUp) * 100 : 0;
  const convToPaid = funnel.signedUp > 0 ? (funnel.subscriptionActive / funnel.signedUp) * 100 : 0;
  const retention = funnel.subscriptionActive > 0 ? (funnel.stillSubscribed / funnel.subscriptionActive) * 100 : 0;

  // Impressions block — extracted from in-house event log
  const events = funnel.events ?? [];
  const topPaths = funnel.topPaths ?? [];
  const pageViewEvent = events.find((e) => e.eventName === "page_view");
  const impressions = pageViewEvent?.count || 0;
  const uniqueVisitors = pageViewEvent ? Math.max(pageViewEvent.uniqueAnons, pageViewEvent.uniqueUsers, pageViewEvent.uniqueAnons + pageViewEvent.uniqueUsers) : 0;
  // Drop page_view from the per-event chip list since we surface it separately.
  const otherEvents = events.filter((e) => e.eventName !== "page_view");
  const visitorToSignup = uniqueVisitors > 0 ? (funnel.signedUp / uniqueVisitors) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center gap-1 flex-wrap">
        {ranges.map((r) => (
          <button
            key={r.value}
            onClick={() => onRangeChange(r.value)}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${range === r.value ? "bg-[#f26522]/15 text-[#f26522]" : "bg-[#0d1f30]/80 text-neutral-400 hover:text-white border border-neutral-800"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Impressions / traffic */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Impressions" value={impressions.toString()} sublabel="page views" />
        <KpiCard label="Unique visitors" value={uniqueVisitors.toString()} sublabel="anon + signed-in" />
        <KpiCard
          label="Visitor → signup"
          value={uniqueVisitors > 0 ? `${visitorToSignup.toFixed(1)}%` : "—"}
          sublabel={`${funnel.signedUp} of ${uniqueVisitors}`}
        />
        <KpiCard
          label="Total events"
          value={events.reduce((sum, e) => sum + e.count, 0).toString()}
          sublabel="all tracked actions"
        />
      </div>

      {/* Top paths + per-event chips */}
      {(topPaths.length > 0 || otherEvents.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-neutral-800 bg-[#0d1f30]/80 p-4">
            <h2 className="text-sm font-semibold mb-3">Top pages</h2>
            {topPaths.length === 0 ? (
              <p className="text-xs text-neutral-500">No page views yet.</p>
            ) : (
              <div className="space-y-1.5">
                {topPaths.map((p) => (
                  <div key={p.pathname} className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-neutral-300 truncate flex-1 mr-2">{p.pathname}</span>
                    <div className="flex items-center gap-3 shrink-0 text-neutral-500">
                      <span className="tabular-nums">{p.uniqueVisitors} uniq</span>
                      <span className="tabular-nums font-bold text-white w-12 text-right">{p.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-neutral-800 bg-[#0d1f30]/80 p-4">
            <h2 className="text-sm font-semibold mb-3">Conversion events</h2>
            {otherEvents.length === 0 ? (
              <p className="text-xs text-neutral-500">No conversion events yet.</p>
            ) : (
              <div className="space-y-1.5">
                {otherEvents.map((e) => (
                  <div key={e.eventName} className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-neutral-300 truncate flex-1 mr-2">{e.eventName}</span>
                    <div className="flex items-center gap-3 shrink-0 text-neutral-500">
                      <span className="tabular-nums">{e.uniqueAnons + e.uniqueUsers} uniq</span>
                      <span className="tabular-nums font-bold text-white w-12 text-right">{e.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Signups" value={funnel.signedUp.toString()} />
        <KpiCard
          label="→ First generation"
          value={`${convToFirstGen.toFixed(0)}%`}
          sublabel={`${funnel.madeGeneration} of ${funnel.signedUp}`}
        />
        <KpiCard
          label="→ Paid"
          value={`${convToPaid.toFixed(0)}%`}
          sublabel={`${funnel.subscriptionActive} subscribed`}
        />
        <KpiCard
          label="Retention"
          value={`${retention.toFixed(0)}%`}
          sublabel="still active today"
        />
      </div>

      {/* Funnel bars */}
      <div className="rounded-lg border border-neutral-800 bg-[#0d1f30]/80 p-4">
        <h2 className="text-sm font-semibold mb-1">Registration funnel</h2>
        <p className="text-[11px] text-neutral-500 mb-4">
          Each row counts users (signed up in the selected period) who reached that stage.
        </p>
        <div className="space-y-2.5">
          {stages.map((stage, i) => {
            const prev = i > 0 ? stages[i - 1].value : null;
            const pctOfTop = (stage.value / top) * 100;
            const conversion = prev !== null && prev > 0 ? (stage.value / prev) * 100 : null;
            const dropoff = prev !== null && prev > 0 ? prev - stage.value : null;
            return (
              <div key={stage.key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-neutral-500 w-4 text-right">{i + 1}.</span>
                    <span className="font-semibold text-white truncate">{stage.label}</span>
                    <span className="text-neutral-500 truncate hidden md:inline">{stage.description}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {conversion !== null && (
                      <span className="text-neutral-500">
                        {conversion.toFixed(0)}% of prev
                      </span>
                    )}
                    {dropoff !== null && dropoff > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-red-400/70">
                        <TrendingDown className="h-3 w-3" />
                        {dropoff} drop
                      </span>
                    )}
                    <span className="font-mono font-bold text-white tabular-nums w-12 text-right">
                      {stage.value}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-[#f26522] transition-all"
                    style={{ width: `${Math.max(pctOfTop, stage.value > 0 ? 1 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard
          label="Median time to first gen"
          value={
            funnel.medianMinutesToFirstGen === null
              ? "—"
              : funnel.medianMinutesToFirstGen < 60
                ? `${funnel.medianMinutesToFirstGen}m`
                : `${(funnel.medianMinutesToFirstGen / 60).toFixed(1)}h`
          }
          sublabel="signup → first generation"
        />
        <KpiCard
          label="Avg gens / active user"
          value={funnel.avgGenerationsPerActive === null ? "—" : funnel.avgGenerationsPerActive.toString()}
          sublabel="across the cohort"
        />
        <KpiCard
          label="Generation success"
          value={
            funnel.totalGenerations > 0
              ? `${((funnel.totalCompletedGenerations / funnel.totalGenerations) * 100).toFixed(0)}%`
              : "—"
          }
          sublabel={`${funnel.totalCompletedGenerations} ok · ${funnel.totalFailedGenerations} failed`}
        />
      </div>

      {/* Signup list — one row per user who signed up in the period.
          Length must equal the 'Signed up' count above. */}
      <div className="rounded-lg border border-neutral-800 bg-[#0d1f30]/80">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div>
            <h2 className="text-sm font-semibold">Signups in this period</h2>
            <p className="text-[11px] text-neutral-500">
              Showing {funnel.signups.length} of {funnel.signedUp}
              {funnel.signups.length < funnel.signedUp && " (capped at 500)"}
            </p>
          </div>
        </div>
        {funnel.signups.length === 0 ? (
          <p className="text-center py-10 text-sm text-neutral-500">No signups in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-900/50 text-left text-[10px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Joined</th>
                  <th className="px-4 py-2 font-medium text-center">Logged in</th>
                  <th className="px-4 py-2 font-medium text-center">Paid</th>
                  <th className="px-4 py-2 font-medium text-right">Gens</th>
                  <th className="px-4 py-2 font-medium text-right">OK</th>
                </tr>
              </thead>
              <tbody>
                {funnel.signups.map((s) => (
                  <tr key={s.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                    <td className="px-4 py-2 font-mono text-neutral-200">{s.email}</td>
                    <td className="px-4 py-2 text-neutral-300">{s.name || "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">
                      {new Date(s.createdAt).toLocaleDateString("en-MY", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {s.loggedIn
                        ? <CheckCircle className="h-3.5 w-3.5 text-green-400 inline" />
                        : <span className="text-neutral-700">—</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {s.subscriptionActive
                        ? <span className="rounded bg-[#f26522]/15 text-[#f26522] px-1.5 py-0.5 text-[10px] font-semibold">PAID</span>
                        : <span className="text-neutral-700">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-neutral-300 tabular-nums">
                      {s.generationCount}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={s.completedCount > 0 ? "text-green-400" : "text-neutral-600"}>
                        {s.completedCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-[#0d1f30]/80 p-3">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
      {sublabel && <p className="text-[10px] text-neutral-500 mt-0.5">{sublabel}</p>}
    </div>
  );
}
