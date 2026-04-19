"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Flag,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  X,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Image as ImageIcon,
  Film,
  Paperclip,
  Send,
  Crown,
  Flame,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { askConfirm, showToast, updateToast } from "@/lib/ui-store";
import { UILayer } from "@/components/ui/ui-layer";

// Category config — each one has a distinct color, emoji, and vibe. Drives the
// sidebar, feed card accent bars, and the New Post chip picker so the whole UI
// reads as one color system instead of "orange on everything".
const CATEGORY_META = {
  All: { emoji: "✨", color: "#f26522", grad: "linear-gradient(135deg,#f26522,#ff8a3d)" },
  General: { emoji: "💬", color: "#3b82f6", grad: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
  Showcase: { emoji: "🎨", color: "#a855f7", grad: "linear-gradient(135deg,#a855f7,#d946ef)" },
  Help: { emoji: "🆘", color: "#f59e0b", grad: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
  Wins: { emoji: "🏆", color: "#22c55e", grad: "linear-gradient(135deg,#22c55e,#4ade80)" },
  Feedback: { emoji: "💡", color: "#ec4899", grad: "linear-gradient(135deg,#ec4899,#f472b6)" },
} as const;
type Category = keyof typeof CATEGORY_META;
const CATEGORIES = Object.keys(CATEGORY_META) as Category[];
const POST_CATEGORIES = CATEGORIES.filter((c) => c !== "All");

interface Post {
  id: string;
  userId: string;
  authorName: string;
  fileId: string | null;
  mediaType: "image" | "video" | null;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  hidden: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  flaggedByMe: boolean;
  createdAt: string;
}

interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  userId: string;
  authorName: string;
  body: string;
  hidden: boolean;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
}

interface LeaderEntry {
  userId: string;
  authorName: string;
  points: number;
  postCount: number;
  commentCount: number;
  level: number;
}

interface Me {
  id: string;
  name: string;
  role: string;
}

function getCat(name: string): Category {
  return (name in CATEGORY_META ? (name as Category) : "General");
}

export default function CommunityPage() {
  const { theme } = useAppStore();
  const isDark = theme === "dark";
  const [posts, setPosts] = useState<Post[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);

  async function loadPosts(cat: Category) {
    setLoading(true);
    try {
      const qs = cat === "All" ? "" : `?category=${encodeURIComponent(cat)}`;
      const res = await fetch(`/api/community/posts${qs}`).then((r) => r.json());
      setPosts(Array.isArray(res?.posts) ? res.posts : []);
    } finally {
      setLoading(false);
    }
  }

  async function loadMe() {
    try {
      const r = await fetch("/api/auth/me").then((r) => r.json());
      setMe(r?.user || null);
    } catch {
      setMe(null);
    }
  }

  async function loadLeaderboard() {
    try {
      const r = await fetch("/api/community/leaderboard").then((r) => r.json());
      setLeaderboard(Array.isArray(r?.entries) ? r.entries : []);
    } catch {
      setLeaderboard([]);
    }
  }

  useEffect(() => {
    loadMe();
    loadLeaderboard();
  }, []);

  useEffect(() => {
    loadPosts(activeCategory);
  }, [activeCategory]);

  const isAdmin = me?.role === "admin";

  const openPost = posts.find((p) => p.id === openPostId) || null;
  const updatePost = (id: string, updater: (p: Post) => Post) =>
    setPosts((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  const removePostFromList = (id: string) =>
    setPosts((prev) => prev.filter((p) => p.id !== id));

  return (
    <div className={`relative min-h-screen ${isDark ? "text-white" : "text-[#0d1117]"}`}>
      <BackgroundFX isDark={isDark} />

      {/* Top bar */}
      <header className={`sticky top-0 z-20 border-b backdrop-blur-md ${isDark ? "border-white/5 bg-[#0d1117]/70" : "border-black/5 bg-white/60"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/generate"
            className={`flex items-center gap-2 text-[13px] font-bold ${isDark ? "text-gray-300 hover:text-white" : "text-gray-700 hover:text-black"}`}
          >
            <ArrowLeft className="h-4 w-4" /> Back to canvas
          </Link>
          <div className="flex items-center gap-2 text-[13px] font-black uppercase tracking-wider">
            <Sparkles className="h-4 w-4 text-[#f26522]" />
            <span>Community</span>
          </div>
          <div className="flex items-center gap-2">
            {me ? (
              <>
                <Avatar name={me.name} size="sm" />
                <span className="text-[12px] font-bold">{me.name}</span>
              </>
            ) : (
              <span className="text-[12px] font-semibold text-gray-400">Sign in to post</span>
            )}
          </div>
        </div>
      </header>

      {/* Hero header */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-6">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f26522]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.15em] text-[#f26522]">
              <Flame className="h-3 w-3" /> Where creators show up
            </div>
            <h1 className="mt-3 font-black leading-[0.92] tracking-tighter" style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)" }}>
              The <span style={{ background: "linear-gradient(135deg,#f26522,#ec4899,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>feed.</span>
            </h1>
            <p className={`mt-1 text-[14px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Drop your wins, grab feedback, flex what you made.
            </p>
          </div>
          <button
            onClick={() => {
              if (!me) return showToast("Sign in to post", { kind: "info" });
              setShowComposer(true);
            }}
            className="group relative inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-black text-white shadow-[0_14px_36px_-10px_rgba(242,101,34,0.6)] transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg,#f26522,#ff8a3d)" }}
          >
            <Plus className="h-4 w-4" /> New Post
            <span className="absolute -inset-1 -z-10 rounded-full opacity-60 blur-xl" style={{ background: "linear-gradient(135deg,#f26522,#ec4899)" }} />
          </button>
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 md:grid-cols-[220px_1fr_280px]">
        {/* Left: category chips */}
        <aside className="md:sticky md:top-24 md:self-start">
          <div className="space-y-1.5">
            {CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c];
              const active = activeCategory === c;
              return (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all ${
                    active
                      ? "border-transparent shadow-lg"
                      : isDark
                        ? "border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]"
                        : "border-black/5 bg-white hover:border-black/10 hover:shadow-sm"
                  }`}
                  style={
                    active
                      ? { background: meta.grad, boxShadow: `0 10px 30px -8px ${meta.color}55` }
                      : undefined
                  }
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[16px]"
                    style={
                      active
                        ? { background: "rgba(255,255,255,0.22)" }
                        : { background: `${meta.color}15`, color: meta.color }
                    }
                  >
                    {meta.emoji}
                  </span>
                  <span className={`text-[13px] font-black tracking-tight ${active ? "text-white" : ""}`}>{c}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center: feed */}
        <section className="min-w-0">
          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-[#f26522]" />
            </div>
          ) : posts.length === 0 ? (
            <EmptyFeed isDark={isDark} onNew={() => me ? setShowComposer(true) : showToast("Sign in to post", { kind: "info" })} />
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <FeedCard
                  key={p.id}
                  post={p}
                  isDark={isDark}
                  onOpen={() => setOpenPostId(p.id)}
                  onToggleLike={async () => {
                    if (!me) return showToast("Sign in to like", { kind: "info" });
                    const res = await fetch(`/api/community/posts/${p.id}/like`, { method: "POST" });
                    const data = await res.json();
                    if (res.ok) updatePost(p.id, (x) => ({ ...x, likedByMe: data.liked, likeCount: data.likeCount }));
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* Right: leaderboard */}
        <aside className="md:sticky md:top-24 md:self-start">
          <Leaderboard entries={leaderboard} isDark={isDark} />
        </aside>
      </main>

      {openPost && (
        <PostDetailModal
          post={openPost}
          me={me}
          isAdmin={!!isAdmin}
          isDark={isDark}
          onClose={() => setOpenPostId(null)}
          onMutate={(updater) => updatePost(openPost.id, updater)}
          onRemove={(id) => {
            removePostFromList(id);
            setOpenPostId(null);
          }}
        />
      )}

      {showComposer && (
        <NewPostModal
          isDark={isDark}
          onClose={() => setShowComposer(false)}
          onCreated={(post) => {
            setPosts((prev) => [post, ...prev]);
            setShowComposer(false);
            loadLeaderboard();
          }}
        />
      )}

      <UILayer />

      <style jsx global>{`
        @keyframes mb-float {
          0%,100% { transform: translateY(0) rotate(var(--r,0deg)); }
          50% { transform: translateY(-8px) rotate(var(--r,0deg)); }
        }
        @keyframes mb-pulse-glow {
          0%,100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.06); }
        }
        @keyframes mb-card-in {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .mb-card-enter { animation: mb-card-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
      `}</style>
    </div>
  );
}

// --- Background FX ---------------------------------------------------------

function BackgroundFX({ isDark }: { isDark: boolean }) {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: isDark
            ? "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(242,101,34,0.10), transparent 60%), radial-gradient(ellipse 60% 50% at 15% 40%, rgba(168,85,247,0.08), transparent 60%), radial-gradient(ellipse 60% 50% at 85% 70%, rgba(236,72,153,0.08), transparent 60%), #0a0e14"
            : "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(242,101,34,0.14), transparent 60%), radial-gradient(ellipse 60% 50% at 15% 40%, rgba(168,85,247,0.08), transparent 60%), radial-gradient(ellipse 60% 50% at 85% 70%, rgba(236,72,153,0.08), transparent 60%), #fafaf7",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage: isDark
            ? "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)"
            : "radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
    </>
  );
}

// --- Empty state -----------------------------------------------------------

function EmptyFeed({ isDark, onNew }: { isDark: boolean; onNew: () => void }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border p-10 text-center ${isDark ? "border-white/5 bg-white/[0.02]" : "border-black/5 bg-white/70"}`}>
      <div
        className="absolute -top-16 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full blur-3xl"
        style={{ background: "linear-gradient(135deg,#f26522,#ec4899)", opacity: 0.25, animation: "mb-pulse-glow 3s ease-in-out infinite" }}
      />
      <div className="relative">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg" style={{ background: "linear-gradient(135deg,#f26522,#ff8a3d)" }}>
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h3 className="text-2xl font-black tracking-tight">Nothing here… yet.</h3>
        <p className={`mx-auto mt-1 max-w-sm text-[13px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          Be the one to start it. Drop a win, a WIP, or a weird question — this feed loves it all.
        </p>
        <button
          onClick={onNew}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#f26522] px-5 py-2.5 text-[13px] font-black text-white shadow-md hover:bg-[#d9541a]"
        >
          <Plus className="h-4 w-4" /> Make the first post
        </button>
      </div>
    </div>
  );
}

// --- Feed card -------------------------------------------------------------

function FeedCard({
  post,
  isDark,
  onOpen,
  onToggleLike,
}: {
  post: Post;
  isDark: boolean;
  onOpen: () => void;
  onToggleLike: () => void;
}) {
  const cat = getCat(post.category);
  const meta = CATEGORY_META[cat];
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <article
      className={`mb-card-enter relative overflow-hidden rounded-3xl border p-5 transition-all duration-200 hover:-translate-y-0.5 ${
        isDark ? "border-white/5 bg-white/[0.03] hover:bg-white/[0.05]" : "border-black/5 bg-white hover:shadow-xl"
      } ${post.hidden ? "opacity-50" : ""}`}
      style={{
        boxShadow: !isDark ? `0 1px 0 rgba(0,0,0,0.02), 0 20px 40px -24px ${meta.color}33` : undefined,
      }}
    >
      {/* Left accent bar */}
      <span className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full" style={{ background: meta.grad }} />

      <div className="flex items-center gap-3">
        <Avatar name={post.authorName} ring />
        <div className="flex-1 min-w-0">
          <p className={`text-[14px] font-black truncate ${text}`}>{post.authorName}</p>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={sub}>{relativeTime(post.createdAt)}</span>
            <CategoryChip cat={cat} />
          </div>
        </div>
        {post.pinned && (
          <span className="flex items-center gap-1 rounded-full bg-[#f26522] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        )}
      </div>

      <button onClick={onOpen} className="mt-3 block w-full text-left">
        <h3 className={`text-[18px] font-black leading-tight tracking-tight ${text}`}>{post.title || "(untitled)"}</h3>
        {post.body && (
          <p className={`mt-1.5 text-[13.5px] leading-relaxed line-clamp-3 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            {post.body}
          </p>
        )}
      </button>

      {post.fileId && (
        <button onClick={onOpen} className={`mt-3 block w-full overflow-hidden rounded-2xl border ${isDark ? "border-white/5" : "border-black/5"}`}>
          {post.mediaType === "video" ? (
            <video
              src={`/api/files/${post.fileId}`}
              muted
              loop
              playsInline
              onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
              onMouseLeave={(e) => {
                const v = e.currentTarget as HTMLVideoElement;
                v.pause();
                v.currentTime = 0;
              }}
              className="max-h-[460px] w-full object-cover"
            />
          ) : (
            <img src={`/api/files/${post.fileId}`} alt="" className="max-h-[460px] w-full object-cover" loading="lazy" />
          )}
        </button>
      )}

      <div className={`mt-4 flex items-center gap-2 pt-3 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
        <button
          onClick={onToggleLike}
          className={`group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-black transition-all ${
            post.likedByMe
              ? "bg-[#f26522] text-white shadow-md"
              : isDark
                ? "text-gray-300 hover:bg-white/5"
                : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Heart className={`h-4 w-4 transition-transform ${post.likedByMe ? "fill-current scale-110" : "group-hover:scale-110"}`} />
          {post.likeCount}
        </button>
        <button
          onClick={onOpen}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-black transition-colors ${
            isDark ? "text-gray-300 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentCount}
        </button>
      </div>
    </article>
  );
}

function CategoryChip({ cat }: { cat: Category }) {
  const meta = CATEGORY_META[cat];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
      style={{ background: `${meta.color}18`, color: meta.color }}
    >
      <span className="text-[11px] leading-none">{meta.emoji}</span>
      {cat}
    </span>
  );
}

// --- Leaderboard ------------------------------------------------------------

function Leaderboard({ entries, isDark }: { entries: LeaderEntry[]; isDark: boolean }) {
  const card = isDark ? "border-white/5 bg-white/[0.03]" : "border-black/5 bg-white/80";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  return (
    <div className={`rounded-3xl border p-4 ${card}`}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg,#f26522,#f59e0b)" }}>
          <Crown className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-[13px] font-black uppercase tracking-wider">Top creators</h3>
      </div>
      {entries.length === 0 ? (
        <p className={`text-[11px] ${sub}`}>No activity yet. Post something and claim #1 ✨</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e, i) => {
            const top = i === 0;
            return (
              <div
                key={e.userId}
                className={`flex items-center gap-2.5 rounded-2xl px-2.5 py-2 transition-colors ${
                  top ? "" : isDark ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.02]"
                }`}
                style={top ? { background: "linear-gradient(135deg,rgba(242,101,34,0.15),rgba(245,158,11,0.10))" } : undefined}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                    top ? "text-white" : isDark ? "bg-white/5 text-gray-300" : "bg-black/5 text-gray-600"
                  }`}
                  style={top ? { background: "linear-gradient(135deg,#f26522,#f59e0b)" } : undefined}
                >
                  {i + 1}
                </span>
                <Avatar name={e.authorName} size="sm" ring={top} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[12.5px] font-black">{e.authorName}</p>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9px] font-black text-white"
                      style={{ background: "linear-gradient(135deg,#f26522,#ec4899)" }}
                    >
                      <Zap className="h-2.5 w-2.5" />
                      {e.points}
                    </span>
                    <span className={`text-[9.5px] font-bold ${sub}`}>Lv {e.level}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- New post modal ---------------------------------------------------------

function NewPostModal({
  isDark,
  onClose,
  onCreated,
}: {
  isDark: boolean;
  onClose: () => void;
  onCreated: (post: Post) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("General");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const panel = isDark ? "bg-[#0f1520] border-white/10 text-white" : "bg-white border-black/5 text-[#0d1117]";
  const input = isDark
    ? "border-white/10 bg-white/[0.03] text-white placeholder-gray-500 focus:border-[#f26522]"
    : "border-black/5 bg-gray-50 text-[#0d1117] placeholder-gray-400 focus:border-[#f26522] focus:bg-white";

  async function submit() {
    if (!title.trim()) {
      showToast("Give it a title first", { kind: "error" });
      return;
    }
    setBusy(true);
    const toastId = showToast("Publishing…", { kind: "loading" });
    try {
      let mediaUrl: string | null = null;
      let mediaType: "image" | "video" | null = null;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const upRes = await fetch("/api/upload", { method: "POST", body: form });
        const upData = await upRes.json();
        if (!upRes.ok) {
          updateToast(toastId, { kind: "error", message: upData.error || "Upload failed" });
          setBusy(false);
          return;
        }
        mediaUrl = upData.url;
        mediaType = file.type.startsWith("video/") ? "video" : "image";
      }
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, category, mediaUrl, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateToast(toastId, { kind: "error", message: data.error || "Failed to post" });
        setBusy(false);
        return;
      }
      updateToast(toastId, { kind: "success", message: "Posted! ✨" });
      const created: Post = {
        ...data.post,
        likedByMe: false,
        flaggedByMe: false,
        commentCount: data.post.commentCount ?? 0,
      };
      onCreated(created);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute -top-16 -left-16 h-48 w-48 rounded-full blur-3xl"
          style={{ background: "linear-gradient(135deg,#f26522,#ec4899)", opacity: 0.35 }}
        />
        <div className={`relative flex items-center justify-between border-b px-6 py-4 ${isDark ? "border-white/10" : "border-black/5"}`}>
          <div>
            <h3 className="text-[15px] font-black tracking-tight">Write a post</h3>
            <p className={`text-[11px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>Share a win, a WIP, a question. Whatever.</p>
          </div>
          <button onClick={onClose} className={`rounded-lg p-1.5 ${isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative flex flex-col gap-4 px-6 py-5">
          <input
            type="text"
            placeholder="Title. Make it catchy."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`w-full rounded-xl border px-4 py-3 text-[16px] font-bold outline-none transition-colors ${input}`}
          />
          <div className="flex flex-wrap gap-1.5">
            {POST_CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c];
              const active = category === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-black uppercase tracking-wider transition-all hover:-translate-y-0.5"
                  style={
                    active
                      ? { background: meta.grad, color: "#fff", borderColor: "transparent", boxShadow: `0 8px 20px -6px ${meta.color}66` }
                      : {
                          background: isDark ? "rgba(255,255,255,0.03)" : `${meta.color}10`,
                          color: meta.color,
                          borderColor: isDark ? "rgba(255,255,255,0.08)" : `${meta.color}30`,
                        }
                  }
                >
                  <span className="text-[12px] leading-none">{meta.emoji}</span>
                  {c}
                </button>
              );
            })}
          </div>
          <textarea
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className={`w-full resize-none rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed outline-none transition-colors ${input}`}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black transition-all hover:-translate-y-0.5 ${
                isDark ? "border-white/10 text-gray-300 hover:border-[#f26522] hover:text-[#f26522]" : "border-black/10 text-gray-600 hover:border-[#f26522] hover:text-[#f26522]"
              }`}
            >
              <Paperclip className="h-3.5 w-3.5" />
              {file ? "Change attachment" : "Attach image / video"}
            </button>
            {file && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#f26522]">
                {file.type.startsWith("video/") ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                <span className="truncate max-w-[180px]">{file.name}</span>
                <button onClick={() => setFile(null)} className="ml-1 text-gray-400 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <div className={`relative flex items-center justify-end gap-2 border-t px-6 py-4 ${isDark ? "border-white/10" : "border-black/5"}`}>
          <button
            onClick={onClose}
            disabled={busy}
            className={`rounded-full px-5 py-2 text-[12px] font-black transition-colors ${isDark ? "bg-white/5 text-gray-200 hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !title.trim()}
            className="rounded-full px-6 py-2 text-[12px] font-black text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#f26522,#ff8a3d)", boxShadow: "0 10px 24px -10px rgba(242,101,34,0.6)" }}
          >
            {busy ? "Publishing…" : "Publish ✨"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Post detail modal ------------------------------------------------------

function PostDetailModal({
  post,
  me,
  isAdmin,
  isDark,
  onClose,
  onMutate,
  onRemove,
}: {
  post: Post;
  me: Me | null;
  isAdmin: boolean;
  isDark: boolean;
  onClose: () => void;
  onMutate: (updater: (p: Post) => Post) => void;
  onRemove: (id: string) => void;
}) {
  const panel = isDark ? "bg-[#0f1520] border-white/10 text-white" : "bg-white border-black/5 text-[#0d1117]";
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const cat = getCat(post.category);
  const meta = CATEGORY_META[cat];

  async function loadComments() {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/comments`).then((r) => r.json());
      setComments(Array.isArray(res?.comments) ? res.comments : []);
    } finally {
      setLoadingComments(false);
    }
  }
  useEffect(() => {
    loadComments();
  }, [post.id]);

  async function togglePostLike() {
    if (!me) return showToast("Sign in to like", { kind: "info" });
    const res = await fetch(`/api/community/posts/${post.id}/like`, { method: "POST" });
    const data = await res.json();
    if (res.ok) onMutate((p) => ({ ...p, likedByMe: data.liked, likeCount: data.likeCount }));
  }

  async function submitComment() {
    if (!me) return showToast("Sign in to comment", { kind: "info" });
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment }),
      });
      const data = await res.json();
      if (res.ok && data.comment) {
        const c: Comment = { ...data.comment, likedByMe: false };
        setComments((prev) => [...prev, c]);
        onMutate((p) => ({ ...p, commentCount: p.commentCount + 1 }));
        setNewComment("");
      } else {
        showToast(data.error || "Failed to comment", { kind: "error" });
      }
    } finally {
      setPosting(false);
    }
  }

  async function toggleCommentLike(c: Comment) {
    if (!me) return showToast("Sign in to like", { kind: "info" });
    const res = await fetch(`/api/community/posts/${post.id}/comments/${c.id}/like`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setComments((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, likedByMe: data.liked, likeCount: data.likeCount } : x))
      );
    }
  }

  async function deleteComment(c: Comment) {
    const ok = await askConfirm({
      title: "Delete comment?",
      message: "This removes the comment permanently.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const toastId = showToast("Deleting…", { kind: "loading" });
    const res = await fetch(`/api/community/posts/${post.id}/comments/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      onMutate((p) => ({ ...p, commentCount: Math.max(p.commentCount - 1, 0) }));
      updateToast(toastId, { kind: "success", message: "Deleted." });
    } else {
      updateToast(toastId, { kind: "error", message: "Failed." });
    }
  }

  async function togglePin() {
    const res = await fetch(`/api/community/posts/${post.id}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !post.pinned }),
    });
    if (res.ok) onMutate((p) => ({ ...p, pinned: !p.pinned }));
  }

  async function toggleHide() {
    const next = !post.hidden;
    const res = await fetch(`/api/community/posts/${post.id}/hide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: next }),
    });
    if (res.ok) onMutate((p) => ({ ...p, hidden: next }));
  }

  async function remove() {
    const ok = await askConfirm({
      title: "Delete this post?",
      message: "The post and all its comments will be permanently removed.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const toastId = showToast("Deleting…", { kind: "loading" });
    const res = await fetch(`/api/community/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) {
      onRemove(post.id);
      updateToast(toastId, { kind: "success", message: "Deleted." });
    } else {
      updateToast(toastId, { kind: "error", message: "Failed." });
    }
  }

  async function flagPost() {
    if (!me) return showToast("Sign in to report", { kind: "info" });
    if (post.flaggedByMe) return;
    const ok = await askConfirm({
      title: "Report this post?",
      message: "Moderators will review it.",
      confirmLabel: "Report",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/community/posts/${post.id}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "" }),
    });
    if (res.ok) {
      onMutate((p) => ({ ...p, flaggedByMe: true }));
      showToast("Reported.", { kind: "success" });
    }
  }

  const canDeletePost = !!me && (me.id === post.userId || isAdmin);

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm md:items-center">
      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-3xl border shadow-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute -top-20 right-0 h-48 w-48 rounded-full blur-3xl"
          style={{ background: meta.grad, opacity: 0.2 }}
        />
        <button
          onClick={onClose}
          className={`absolute right-3 top-3 z-10 rounded-lg p-1.5 ${isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"}`}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6">
          <div className="flex items-center gap-3">
            <Avatar name={post.authorName} ring />
            <div className="flex-1 min-w-0">
              <p className={`font-black truncate ${text}`}>{post.authorName}</p>
              <div className="flex items-center gap-2 text-[11px]">
                <span className={sub}>{relativeTime(post.createdAt)}</span>
                <CategoryChip cat={cat} />
                {post.pinned && (
                  <span className="rounded-full bg-[#f26522] px-2 py-[1px] text-[9px] font-black uppercase tracking-wider text-white">
                    Pinned
                  </span>
                )}
              </div>
            </div>
          </div>

          <h2 className={`mt-4 text-2xl font-black leading-tight tracking-tight ${text}`}>{post.title}</h2>
          {post.body && (
            <p className={`mt-2 whitespace-pre-wrap text-[14px] leading-relaxed ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              {post.body}
            </p>
          )}

          {post.fileId && (
            <div className={`mt-4 overflow-hidden rounded-2xl border ${isDark ? "border-white/5" : "border-black/5"}`}>
              {post.mediaType === "video" ? (
                <video src={`/api/files/${post.fileId}`} controls className="max-h-[60vh] w-full" />
              ) : (
                <img src={`/api/files/${post.fileId}`} alt="" className="max-h-[60vh] w-full object-contain" />
              )}
            </div>
          )}

          <div className={`mt-4 flex items-center gap-2 border-y py-3 ${isDark ? "border-white/5" : "border-black/5"}`}>
            <button
              onClick={togglePostLike}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-black transition-all ${
                post.likedByMe
                  ? "text-white shadow-md"
                  : isDark
                    ? "bg-white/5 text-gray-300 hover:bg-white/10"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              style={post.likedByMe ? { background: "linear-gradient(135deg,#f26522,#ec4899)" } : undefined}
            >
              <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-current" : ""}`} />
              {post.likeCount}
            </button>
            <span className={`flex items-center gap-1.5 text-[12px] font-black ${sub}`}>
              <MessageCircle className="h-4 w-4" />
              {post.commentCount}
            </span>
            <div className="flex-1" />
            <button
              onClick={flagPost}
              disabled={post.flaggedByMe}
              title={post.flaggedByMe ? "Already reported" : "Report to moderators"}
              className={`rounded-lg p-1.5 ${post.flaggedByMe ? "text-yellow-500" : isDark ? "text-gray-400 hover:bg-white/5 hover:text-yellow-400" : "text-gray-400 hover:bg-gray-100 hover:text-yellow-600"}`}
            >
              <Flag className="h-4 w-4" />
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={togglePin}
                  title={post.pinned ? "Unpin" : "Pin"}
                  className={`rounded-lg p-1.5 ${post.pinned ? "text-[#f26522]" : isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"}`}
                >
                  {post.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
                <button
                  onClick={toggleHide}
                  title={post.hidden ? "Unhide" : "Hide"}
                  className={`rounded-lg p-1.5 ${post.hidden ? "text-red-500" : isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"}`}
                >
                  {post.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </>
            )}
            {canDeletePost && (
              <button onClick={remove} className="rounded-lg bg-red-500/10 p-1.5 text-red-500 hover:bg-red-500/20">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4">
            <h4 className={`text-[11px] font-black uppercase tracking-[0.15em] ${sub}`}>
              {post.commentCount} Comment{post.commentCount === 1 ? "" : "s"}
            </h4>
            <div className="mt-2 space-y-2">
              {loadingComments ? (
                <div className="flex justify-center py-6">
                  <Loader2 className={`h-4 w-4 animate-spin ${sub}`} />
                </div>
              ) : comments.length === 0 ? (
                <p className={`text-[12px] ${sub}`}>No replies yet. Be the one with something to say.</p>
              ) : (
                comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    me={me}
                    isAdmin={isAdmin}
                    isDark={isDark}
                    onLike={() => toggleCommentLike(c)}
                    onDelete={() => deleteComment(c)}
                  />
                ))
              )}
            </div>

            <div className="mt-3 flex items-start gap-2">
              <Avatar name={me?.name || "?"} size="sm" />
              <div className="flex-1">
                <textarea
                  placeholder={me ? "Drop a comment…" : "Sign in to comment"}
                  value={newComment}
                  disabled={!me || posting}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment();
                  }}
                  rows={2}
                  className={`w-full resize-none rounded-xl border px-3 py-2 text-[13px] outline-none ${
                    isDark
                      ? "border-white/10 bg-white/[0.03] text-white placeholder-gray-500 focus:border-[#f26522]"
                      : "border-black/5 bg-gray-50 text-[#0d1117] placeholder-gray-400 focus:border-[#f26522] focus:bg-white"
                  }`}
                />
                <div className="mt-1.5 flex justify-end">
                  <button
                    onClick={submitComment}
                    disabled={!me || !newComment.trim() || posting}
                    className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#f26522,#ff8a3d)" }}
                  >
                    <Send className="h-3 w-3" />
                    {posting ? "Posting…" : "Comment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  me,
  isAdmin,
  isDark,
  onLike,
  onDelete,
}: {
  comment: Comment;
  me: Me | null;
  isAdmin: boolean;
  isDark: boolean;
  onLike: () => void;
  onDelete: () => void;
}) {
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-500" : "text-gray-500";
  const canDelete = !!me && (me.id === comment.userId || isAdmin);

  return (
    <div className={`flex items-start gap-2 rounded-2xl px-3 py-2.5 ${isDark ? "bg-white/[0.03]" : "bg-gray-50"} ${comment.hidden ? "opacity-50" : ""}`}>
      <Avatar name={comment.authorName} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-[12px] font-black ${text}`}>{comment.authorName}</p>
          <span className={`text-[10px] ${sub}`}>{relativeTime(comment.createdAt)}</span>
        </div>
        <p className={`mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed ${isDark ? "text-gray-300" : "text-gray-700"}`}>
          {comment.body}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <button
            onClick={onLike}
            className={`flex items-center gap-1 text-[11px] font-black transition-colors ${
              comment.likedByMe ? "text-[#f26522]" : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-[#0d1117]"
            }`}
          >
            <Heart className={`h-3 w-3 ${comment.likedByMe ? "fill-current" : ""}`} />
            {comment.likeCount}
          </button>
          {canDelete && (
            <button onClick={onDelete} className="text-[11px] font-black text-red-500 hover:underline">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Avatar with optional gradient ring ------------------------------------

function Avatar({ name, size = "md", ring = false }: { name: string; size?: "sm" | "md"; ring?: boolean }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const dim = size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-[13px]";
  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [12, 28, 160, 200, 260, 340];
  const hue = hues[hash % hues.length];
  const inner = (
    <div
      className={`flex items-center justify-center rounded-full font-black text-white shrink-0 ${dim}`}
      style={{ background: `hsl(${hue}, 70%, 48%)` }}
    >
      {initial}
    </div>
  );
  if (!ring) return inner;
  const pad = size === "sm" ? "p-[1.5px]" : "p-[2px]";
  return (
    <div className={`rounded-full shrink-0 ${pad}`} style={{ background: "linear-gradient(135deg,#f26522,#ec4899,#a855f7)" }}>
      {inner}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}
