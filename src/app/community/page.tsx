"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Trophy,
  Image as ImageIcon,
  Film,
  Paperclip,
  Send,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { askConfirm, showToast, updateToast } from "@/lib/ui-store";
import { UILayer } from "@/components/ui/ui-layer";

const CATEGORIES = ["All", "General", "Showcase", "Help", "Wins", "Feedback"] as const;
type Category = (typeof CATEGORIES)[number];

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
  const bg = isDark ? "#0d1117" : "#fafafa";
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-500" : "text-gray-500";
  const card = isDark ? "bg-[#161b22] border-gray-800" : "bg-white border-gray-200";

  const openPost = posts.find((p) => p.id === openPostId) || null;

  const updatePost = (id: string, updater: (p: Post) => Post) =>
    setPosts((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));

  const removePostFromList = (id: string) =>
    setPosts((prev) => prev.filter((p) => p.id !== id));

  return (
    <div style={{ background: bg, minHeight: "100vh" }} className={text}>
      {/* Top bar */}
      <header className={`sticky top-0 z-20 border-b ${isDark ? "border-gray-800 bg-[#0d1117]/95" : "border-gray-200 bg-white/95"} backdrop-blur`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/generate"
            className={`flex items-center gap-2 text-sm font-semibold ${isDark ? "text-gray-300 hover:text-white" : "text-gray-700 hover:text-black"}`}
          >
            <ArrowLeft className="h-4 w-4" /> Back to canvas
          </Link>
          <h1 className="text-base font-black tracking-tight">Community</h1>
          <div className={`text-xs ${sub}`}>{me ? me.name : "Sign in to post"}</div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[200px_1fr_260px]">
        {/* Left: category filter */}
        <aside className="md:sticky md:top-20 md:self-start">
          <div className={`rounded-2xl border p-2 ${card}`}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                  activeCategory === c
                    ? "bg-[#f26522]/10 text-[#f26522]"
                    : isDark
                      ? "text-gray-300 hover:bg-white/5"
                      : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{c}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (!me) {
                showToast("Sign in to post", { kind: "info" });
                return;
              }
              setShowComposer(true);
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f26522] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#f26522]/20 transition-colors hover:bg-[#d9541a]"
          >
            <Plus className="h-4 w-4" /> New Post
          </button>
        </aside>

        {/* Center: feed */}
        <section className="min-w-0">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className={`h-6 w-6 animate-spin ${sub}`} />
            </div>
          ) : posts.length === 0 ? (
            <div className={`rounded-2xl border p-10 text-center ${card}`}>
              <p className={`text-sm ${sub}`}>
                Nothing here yet. Hit “New Post” to get the conversation going.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
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
        <aside className="md:sticky md:top-20 md:self-start">
          <div className={`rounded-2xl border p-4 ${card}`}>
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#f26522]" />
              <h3 className="text-sm font-bold">Leaderboard</h3>
            </div>
            {leaderboard.length === 0 ? (
              <p className={`text-[11px] ${sub}`}>No activity yet. Post something and claim #1.</p>
            ) : (
              <div className="space-y-1.5">
                {leaderboard.map((e, i) => (
                  <div key={e.userId} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${i === 0 ? "bg-[#f26522]/10" : ""}`}>
                    <span className={`w-5 shrink-0 text-center text-[11px] font-bold ${i === 0 ? "text-[#f26522]" : sub}`}>{i + 1}</span>
                    <Avatar name={e.authorName} />
                    <div className="flex-1 min-w-0">
                      <p className={`truncate text-[12px] font-semibold ${text}`}>{e.authorName}</p>
                      <p className={`text-[10px] ${sub}`}>Lv {e.level} · {e.points} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
    </div>
  );
}

// --- Feed card --------------------------------------------------------------

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
  const card = isDark ? "bg-[#161b22] border-gray-800" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-500" : "text-gray-500";

  return (
    <article
      className={`rounded-2xl border p-4 transition-colors ${card} ${post.hidden ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={post.authorName} />
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold truncate ${text}`}>{post.authorName}</p>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className={sub}>{relativeTime(post.createdAt)}</span>
            <span className={sub}>·</span>
            <span className="rounded-md bg-[#f26522]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#f26522]">
              {post.category}
            </span>
          </div>
        </div>
        {post.pinned && (
          <span className="flex items-center gap-1 rounded-md bg-[#f26522]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#f26522]">
            <Pin className="h-2.5 w-2.5" /> Pinned
          </span>
        )}
      </div>

      <button onClick={onOpen} className="mt-3 block w-full text-left">
        <h3 className={`text-[15px] font-bold leading-tight ${text}`}>{post.title || "(untitled)"}</h3>
        {post.body && (
          <p className={`mt-1.5 text-[13px] leading-relaxed line-clamp-3 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {post.body}
          </p>
        )}
      </button>

      {post.fileId && (
        <button onClick={onOpen} className={`mt-3 block w-full overflow-hidden rounded-xl border ${isDark ? "border-gray-800" : "border-gray-200"}`}>
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
              className="max-h-[420px] w-full object-cover"
            />
          ) : (
            <img src={`/api/files/${post.fileId}`} alt="" className="max-h-[420px] w-full object-cover" loading="lazy" />
          )}
        </button>
      )}

      <div className={`mt-3 flex items-center gap-4 pt-3 border-t ${isDark ? "border-gray-800" : "border-gray-100"}`}>
        <button
          onClick={onToggleLike}
          className={`flex items-center gap-1.5 text-[12px] font-semibold transition-colors ${
            post.likedByMe ? "text-[#f26522]" : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-[#0d1117]"
          }`}
        >
          <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-current" : ""}`} />
          {post.likeCount}
        </button>
        <button
          onClick={onOpen}
          className={`flex items-center gap-1.5 text-[12px] font-semibold transition-colors ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-[#0d1117]"}`}
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentCount}
        </button>
      </div>
    </article>
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

  const panel = isDark ? "bg-[#0d1117] border-gray-800 text-white" : "bg-white border-gray-200 text-[#0d1117]";
  const input = isDark
    ? "border-gray-700 bg-[#161b22] text-white placeholder-gray-500 focus:border-[#f26522]"
    : "border-gray-200 bg-white text-[#0d1117] placeholder-gray-400 focus:border-[#f26522]";

  async function submit() {
    if (!title.trim()) {
      showToast("Title is required", { kind: "error" });
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
      updateToast(toastId, { kind: "success", message: "Posted!" });
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
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? "border-gray-800" : "border-gray-100"}`}>
          <h3 className="text-sm font-bold">New post</h3>
          <button onClick={onClose} className={`rounded-lg p-1.5 ${isDark ? "text-gray-500 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2.5 text-[14px] font-semibold outline-none ${input}`}
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.filter((c) => c !== "All").map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c as Category)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  category === c
                    ? "bg-[#f26522] text-white"
                    : isDark
                      ? "bg-white/5 text-gray-300 hover:bg-white/10"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Share what's on your mind…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className={`w-full resize-none rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed outline-none ${input}`}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${isDark ? "border-gray-700 text-gray-300 hover:border-[#f26522] hover:text-[#f26522]" : "border-gray-200 text-gray-600 hover:border-[#f26522] hover:text-[#f26522]"}`}
            >
              <Paperclip className="h-3.5 w-3.5" />
              {file ? "Change attachment" : "Attach image / video"}
            </button>
            {file && (
              <span className="flex items-center gap-1 text-[11px] text-[#f26522]">
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
        <div className={`flex items-center justify-end gap-2 border-t px-5 py-3 ${isDark ? "border-gray-800" : "border-gray-100"}`}>
          <button
            onClick={onClose}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors ${isDark ? "bg-white/5 text-gray-300 hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !title.trim()}
            className="rounded-lg bg-[#f26522] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#d9541a] disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Publish"}
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
  const panel = isDark ? "bg-[#0d1117] border-gray-800 text-white" : "bg-white border-gray-200 text-[#0d1117]";
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

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
    <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:items-center">
      <div
        className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className={`absolute right-3 top-3 rounded-lg p-1.5 ${isDark ? "text-gray-500 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"}`}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3">
            <Avatar name={post.authorName} />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold truncate ${text}`}>{post.authorName}</p>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={sub}>{relativeTime(post.createdAt)}</span>
                <span className={sub}>·</span>
                <span className="rounded-md bg-[#f26522]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#f26522]">
                  {post.category}
                </span>
                {post.pinned && (
                  <span className="rounded-md bg-[#f26522]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#f26522]">
                    Pinned
                  </span>
                )}
              </div>
            </div>
          </div>

          <h2 className={`mt-4 text-xl font-black leading-tight ${text}`}>{post.title}</h2>
          {post.body && (
            <p className={`mt-2 whitespace-pre-wrap text-[14px] leading-relaxed ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              {post.body}
            </p>
          )}

          {post.fileId && (
            <div className={`mt-4 overflow-hidden rounded-xl border ${isDark ? "border-gray-800" : "border-gray-200"}`}>
              {post.mediaType === "video" ? (
                <video src={`/api/files/${post.fileId}`} controls className="max-h-[60vh] w-full" />
              ) : (
                <img src={`/api/files/${post.fileId}`} alt="" className="max-h-[60vh] w-full object-contain" />
              )}
            </div>
          )}

          <div className={`mt-4 flex items-center gap-3 border-y py-3 ${isDark ? "border-gray-800" : "border-gray-100"}`}>
            <button
              onClick={togglePostLike}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
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
            <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${sub}`}>
              <MessageCircle className="h-4 w-4" />
              {post.commentCount}
            </span>
            <div className="flex-1" />
            <button
              onClick={flagPost}
              disabled={post.flaggedByMe}
              title={post.flaggedByMe ? "Already reported" : "Report to moderators"}
              className={`rounded-lg p-1.5 ${post.flaggedByMe ? "text-yellow-600" : isDark ? "text-gray-400 hover:bg-white/5 hover:text-yellow-400" : "text-gray-400 hover:bg-gray-100 hover:text-yellow-600"}`}
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

          {/* Comments */}
          <div className="mt-4">
            <h4 className={`text-[12px] font-bold uppercase tracking-wider ${sub}`}>
              {post.commentCount} Comment{post.commentCount === 1 ? "" : "s"}
            </h4>
            <div className="mt-2 space-y-2">
              {loadingComments ? (
                <div className="flex justify-center py-6">
                  <Loader2 className={`h-4 w-4 animate-spin ${sub}`} />
                </div>
              ) : comments.length === 0 ? (
                <p className={`text-[12px] ${sub}`}>Be the first to comment.</p>
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

            {/* Composer */}
            <div className="mt-3 flex items-start gap-2">
              <Avatar name={me?.name || "?"} />
              <div className="flex-1">
                <textarea
                  placeholder={me ? "Write a comment…" : "Sign in to comment"}
                  value={newComment}
                  disabled={!me || posting}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment();
                  }}
                  rows={2}
                  className={`w-full resize-none rounded-lg border px-3 py-2 text-[13px] outline-none ${
                    isDark
                      ? "border-gray-700 bg-[#161b22] text-white placeholder-gray-500 focus:border-[#f26522]"
                      : "border-gray-200 bg-white text-[#0d1117] placeholder-gray-400 focus:border-[#f26522]"
                  }`}
                />
                <div className="mt-1.5 flex justify-end">
                  <button
                    onClick={submitComment}
                    disabled={!me || !newComment.trim() || posting}
                    className="flex items-center gap-1.5 rounded-lg bg-[#f26522] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#d9541a] disabled:opacity-50"
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
    <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 ${isDark ? "bg-white/[0.03]" : "bg-gray-50"} ${comment.hidden ? "opacity-50" : ""}`}>
      <Avatar name={comment.authorName} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-[12px] font-semibold ${text}`}>{comment.authorName}</p>
          <span className={`text-[10px] ${sub}`}>{relativeTime(comment.createdAt)}</span>
        </div>
        <p className={`mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed ${isDark ? "text-gray-300" : "text-gray-700"}`}>
          {comment.body}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <button
            onClick={onLike}
            className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${
              comment.likedByMe ? "text-[#f26522]" : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-[#0d1117]"
            }`}
          >
            <Heart className={`h-3 w-3 ${comment.likedByMe ? "fill-current" : ""}`} />
            {comment.likeCount}
          </button>
          {canDelete && (
            <button onClick={onDelete} className="text-[11px] font-semibold text-red-500 hover:underline">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Avatar -----------------------------------------------------------------

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const dim = size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-[13px]";
  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [12, 28, 160, 200, 260, 340];
  const hue = hues[hash % hues.length];
  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold text-white shrink-0 ${dim}`}
      style={{ background: `hsl(${hue}, 70%, 48%)` }}
    >
      {initial}
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
