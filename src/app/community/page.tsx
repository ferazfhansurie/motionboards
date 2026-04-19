"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, Flag, Eye, EyeOff, Trash2, Loader2, X } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface Post {
  id: string;
  userId: string;
  authorName: string;
  fileId: string;
  mediaType: "image" | "video";
  caption: string;
  hidden: boolean;
  likeCount: number;
  likedByMe: boolean;
  flaggedByMe: boolean;
  createdAt: string;
}

interface Me {
  id: string;
  name: string;
  role: string;
}

export default function CommunityPage() {
  const { theme } = useAppStore();
  const isDark = theme === "dark";
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [active, setActive] = useState<Post | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [meRes, postsRes] = await Promise.all([
        fetch("/api/auth/me").then((r) => r.json()).catch(() => ({ user: null })),
        fetch("/api/community/posts").then((r) => r.json()),
      ]);
      setMe(meRes?.user || null);
      setPosts(Array.isArray(postsRes?.posts) ? postsRes.posts : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const isAdmin = me?.role === "admin";

  const bg = isDark ? "#0d1117" : "#fafafa";
  const card = isDark ? "bg-[#161b22] border-gray-800" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <div style={{ background: bg, minHeight: "100vh" }} className={text}>
      {/* Top bar */}
      <header className={`sticky top-0 z-20 border-b ${isDark ? "border-gray-800 bg-[#0d1117]" : "border-gray-200 bg-white"}`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/generate"
            className={`flex items-center gap-2 text-sm font-semibold ${isDark ? "text-gray-300 hover:text-white" : "text-gray-700 hover:text-black"}`}
          >
            <ArrowLeft className="h-4 w-4" /> Back to canvas
          </Link>
          <h1 className="text-lg font-black tracking-tight">Community</h1>
          <div className={`text-xs ${sub}`}>
            {me ? me.name : "Sign in to post"}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className={`h-6 w-6 animate-spin ${sub}`} />
          </div>
        ) : posts.length === 0 ? (
          <div className={`rounded-2xl border p-10 text-center ${card}`}>
            <p className={`text-sm ${sub}`}>No posts yet. Share one from your canvas to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {posts.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p)}
                className={`group relative aspect-square overflow-hidden rounded-xl border ${card} ${p.hidden ? "opacity-40" : ""}`}
              >
                {p.mediaType === "video" ? (
                  <video
                    src={`/api/files/${p.fileId}`}
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                    onMouseLeave={(e) => {
                      const v = e.currentTarget as HTMLVideoElement;
                      v.pause();
                      v.currentTime = 0;
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img src={`/api/files/${p.fileId}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-[11px] text-white">
                  <span className="truncate">{p.authorName}</span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {p.likeCount}
                  </span>
                </div>
                {p.hidden && (
                  <span className="absolute left-2 top-2 rounded-md bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white">Hidden</span>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {active && (
        <PostModal
          post={active}
          me={me}
          isAdmin={!!isAdmin}
          isDark={isDark}
          onClose={() => setActive(null)}
          onMutate={(updater) => {
            setPosts((prev) => prev.map((p) => (p.id === active.id ? updater(p) : p)));
            setActive((prev) => (prev ? updater(prev) : prev));
          }}
          onRemove={(id) => {
            setPosts((prev) => prev.filter((p) => p.id !== id));
            setActive(null);
          }}
        />
      )}
    </div>
  );
}

function PostModal({
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
  const [busy, setBusy] = useState<string | null>(null);
  const panel = isDark ? "bg-[#161b22] border-gray-800 text-white" : "bg-white border-gray-200 text-[#0d1117]";

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(post.createdAt).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }, [post.createdAt]);

  async function like() {
    if (!me) return alert("Sign in to like posts");
    setBusy("like");
    try {
      const res = await fetch(`/api/community/posts/${post.id}/like`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        onMutate((p) => ({ ...p, likedByMe: data.liked, likeCount: data.likeCount }));
      }
    } finally {
      setBusy(null);
    }
  }

  async function flag() {
    if (!me) return alert("Sign in to report posts");
    if (post.flaggedByMe) return;
    if (!confirm("Report this post to moderators?")) return;
    setBusy("flag");
    try {
      const res = await fetch(`/api/community/posts/${post.id}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      });
      if (res.ok) onMutate((p) => ({ ...p, flaggedByMe: true }));
    } finally {
      setBusy(null);
    }
  }

  async function hide(next: boolean) {
    setBusy("hide");
    try {
      const res = await fetch(`/api/community/posts/${post.id}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: next }),
      });
      if (res.ok) onMutate((p) => ({ ...p, hidden: next }));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this post permanently?")) return;
    setBusy("del");
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) onRemove(post.id);
    } finally {
      setBusy(null);
    }
  }

  const canDelete = !!me && (me.id === post.userId || isAdmin);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border md:flex-row ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-[300px] flex-1 items-center justify-center bg-black md:min-h-[500px]">
          {post.mediaType === "video" ? (
            <video src={`/api/files/${post.fileId}`} controls autoPlay loop className="max-h-[80vh] w-full object-contain" />
          ) : (
            <img src={`/api/files/${post.fileId}`} alt="" className="max-h-[80vh] w-full object-contain" />
          )}
        </div>
        <div className="flex w-full flex-col md:w-80">
          <div className={`flex items-center justify-between border-b px-4 py-3 ${isDark ? "border-gray-800" : "border-gray-200"}`}>
            <div>
              <div className="text-sm font-bold">{post.authorName}</div>
              <div className={`text-[11px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>{timeAgo}</div>
            </div>
            <button
              onClick={onClose}
              className={`rounded-lg p-1.5 ${isDark ? "hover:bg-white/5" : "hover:bg-gray-100"}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
            {post.caption ? (
              <p className="whitespace-pre-wrap leading-relaxed">{post.caption}</p>
            ) : (
              <p className={isDark ? "text-gray-500" : "text-gray-400"}>No caption.</p>
            )}
          </div>
          <div className={`flex items-center gap-2 border-t px-4 py-3 ${isDark ? "border-gray-800" : "border-gray-200"}`}>
            <button
              onClick={like}
              disabled={busy === "like"}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                post.likedByMe
                  ? "bg-[#f26522] text-white"
                  : isDark
                    ? "bg-white/5 text-gray-300 hover:bg-white/10"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-current" : ""}`} />
              {post.likeCount}
            </button>
            <button
              onClick={flag}
              disabled={busy === "flag" || post.flaggedByMe}
              title={post.flaggedByMe ? "You already reported this post" : "Report to moderators"}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                post.flaggedByMe
                  ? "bg-yellow-500/20 text-yellow-600"
                  : isDark
                    ? "bg-white/5 text-gray-300 hover:bg-white/10"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Flag className="h-4 w-4" />
            </button>
            {isAdmin && (
              <button
                onClick={() => hide(!post.hidden)}
                disabled={busy === "hide"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  post.hidden
                    ? "bg-red-500/20 text-red-500"
                    : isDark
                      ? "bg-white/5 text-gray-300 hover:bg-white/10"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                title={post.hidden ? "Unhide" : "Hide (admin)"}
              >
                {post.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
            {canDelete && (
              <button
                onClick={remove}
                disabled={busy === "del"}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
