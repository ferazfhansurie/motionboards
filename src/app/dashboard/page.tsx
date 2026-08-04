"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  FolderKanban,
  ImageIcon,
  Loader2,
  LogOut,
  Plus,
  Sparkles,
  TimerReset,
  WalletCards,
  Zap,
} from "lucide-react";

interface UserData {
  id: string;
  name: string;
  email: string;
  credits: number;
  role: string;
}

interface Generation {
  id: string;
  model: string;
  prompt: string;
  status: "pending" | "processing" | "completed" | "failed";
  creditCost?: number;
  createdAt: string;
}

interface Asset {
  id: string;
  name: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}

const quickActions = [
  { href: "/generate", label: "Create on canvas", description: "Start an image, video, or storyboard", icon: Sparkles, accent: "bg-[#f26522]" },
  { href: "/media", label: "Browse media", description: "Review your generated library", icon: ImageIcon, accent: "bg-[#1966ff]" },
  { href: "/fathopes", label: "Open campaign studio", description: "Plan and produce campaign content", icon: Clapperboard, accent: "bg-[#10a37f]" },
];

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusClasses(status: Generation["status"] | Asset["status"]) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
  if (status === "failed") return "bg-red-50 text-red-700 ring-red-600/10";
  return "bg-amber-50 text-amber-700 ring-amber-600/10";
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const userResponse = await fetch("/api/auth/me");
        const userData = await userResponse.json();
        if (!userData.user) {
          window.location.href = "/login";
          return;
        }
        setUser(userData.user);

        const [generationResponse, assetResponse] = await Promise.all([
          fetch("/api/generations/recent?limit=20"),
          fetch("/api/assets"),
        ]);
        const generationData = await generationResponse.json().catch(() => ({}));
        const assetData = await assetResponse.json().catch(() => ({}));
        if (Array.isArray(generationData.generations)) setGenerations(generationData.generations);
        if (Array.isArray(assetData.assets)) setAssets(assetData.assets);
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: generations.length,
      thisWeek: generations.filter((generation) => new Date(generation.createdAt).getTime() >= weekAgo).length,
      readyAssets: assets.filter((asset) => asset.status === "completed").length,
      pendingAssets: assets.filter((asset) => asset.status === "pending").length,
    };
  }, [assets, generations]);

  const recentItems = useMemo(() => [
    ...generations.map((generation) => ({
      id: `generation-${generation.id}`,
      title: generation.prompt || generation.model?.split("/").pop() || "Generation",
      detail: `Generation · ${generation.model?.split("/").pop() || "AI model"}`,
      status: generation.status,
      createdAt: generation.createdAt,
    })),
    ...assets.map((asset) => ({
      id: `asset-${asset.id}`,
      title: asset.name,
      detail: "Character asset request",
      status: asset.status,
      createdAt: asset.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6), [assets, generations]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  if (loading) {
    return <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#f26522]" /></div>;
  }
  if (!user) return null;

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#141414]">
      <header className="border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/generate" className="flex items-center gap-2.5 font-black tracking-[-0.04em]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#161616] text-sm text-white">M</span>
            <span>MotionBoards</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="hidden text-sm font-medium text-black/55 hover:text-black sm:block">Settings</Link>
            <button onClick={handleLogout} className="rounded-lg p-2 text-black/45 hover:bg-black/5 hover:text-red-600" aria-label="Log out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-11">
        <section className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold text-[#f26522]">AIOS COMMAND CENTER</p>
            <h1 className="text-3xl font-black tracking-[-0.055em] sm:text-4xl">{greeting}, {user.name.split(" ")[0]}.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-black/55">Your creative production, assets, and next actions in one place.</p>
          </div>
          <Link href="/generate" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#161616] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#f26522]">
            <Plus className="h-4 w-4" /> New creation
          </Link>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Available balance", value: `RM${(user.credits / 100).toFixed(2)}`, note: "Ready for your next run", icon: WalletCards, color: "text-[#f26522]" },
            { label: "Recent generations", value: stats.total, note: `${stats.thisWeek} created this week`, icon: Sparkles, color: "text-[#1966ff]" },
            { label: "Ready assets", value: stats.readyAssets, note: stats.readyAssets ? "Available to use" : "No approved assets yet", icon: CheckCircle2, color: "text-[#10a37f]" },
            { label: "Needs attention", value: stats.pendingAssets, note: stats.pendingAssets ? "Asset requests in review" : "All clear", icon: TimerReset, color: "text-[#b45309]" },
          ].map(({ label, value, note, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <Icon className={`mb-8 h-5 w-5 ${color}`} />
              <p className="text-2xl font-black tracking-[-0.04em]">{value}</p>
              <p className="mt-1 text-sm font-semibold">{label}</p>
              <p className="mt-1 text-xs text-black/45">{note}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-8">
            <div>
              <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black tracking-[-0.035em]">Start here</h2><span className="text-xs font-medium text-black/40">Quick actions</span></div>
              <div className="grid gap-3 sm:grid-cols-3">
                {quickActions.map(({ href, label, description, icon: Icon, accent }) => (
                  <Link key={href} href={href} className="group rounded-2xl border border-black/[0.07] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                    <span className={`mb-8 grid h-9 w-9 place-items-center rounded-xl text-white ${accent}`}><Icon className="h-4 w-4" /></span>
                    <p className="text-sm font-bold">{label}</p><p className="mt-1 text-xs leading-5 text-black/45">{description}</p>
                    <ArrowRight className="mt-4 h-4 w-4 text-black/30 transition group-hover:translate-x-1 group-hover:text-black" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-black/[0.07] bg-white">
              <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4"><div className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-[#f26522]" /><h2 className="text-sm font-black">Recent activity</h2></div><Link href="/media" className="text-xs font-bold text-[#f26522] hover:underline">View library</Link></div>
              {recentItems.length ? <div className="divide-y divide-black/[0.06]">{recentItems.map((item) => <div key={item.id} className="flex items-center gap-3 px-5 py-3.5"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/[0.04]"><Sparkles className="h-3.5 w-3.5 text-black/45" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="text-xs text-black/45">{item.detail} · {relativeTime(item.createdAt)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold capitalize ring-1 ring-inset ${statusClasses(item.status)}`}>{item.status}</span></div>)}</div> : <div className="px-5 py-12 text-center"><p className="text-sm font-semibold">Nothing has been created yet.</p><p className="mt-1 text-xs text-black/45">Start a new canvas creation and it will appear here.</p></div>}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-[#161616] p-5 text-white"><p className="text-xs font-bold tracking-[0.12em] text-white/50">TODAY’S FOCUS</p><h2 className="mt-3 text-xl font-black tracking-[-0.04em]">Turn an idea into an asset.</h2><p className="mt-3 text-sm leading-6 text-white/60">Use the canvas to generate, refine, and collect your campaign material in one board.</p><Link href="/generate" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white hover:text-[#ff9a6a]">Open canvas <ArrowRight className="h-4 w-4" /></Link></div>
            <div className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-[#f26522]" /><h2 className="text-sm font-black">Automation</h2></div><div className="mt-4 rounded-xl bg-[#f7f7f5] p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Threads discovery reply</p><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Daily</span></div><p className="mt-1 text-xs leading-5 text-black/45">Scheduled workflow. Configure its production credentials before publishing is enabled.</p></div></div>
          </aside>
        </section>
      </div>
    </main>
  );
}
