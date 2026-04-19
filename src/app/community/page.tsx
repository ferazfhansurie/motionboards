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
  Image as ImageIcon,
  Film,
  Paperclip,
  Send,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { askConfirm, showToast, updateToast } from "@/lib/ui-store";
import { UILayer } from "@/components/ui/ui-layer";

// Scrapbook / zine look. Every surface is a sticker: solid color, black outline,
// hard offset shadow, slightly rotated. Category metadata drives the little
// "taped label" on each post card and the chip color in the sidebar.
const CATEGORY_META = {
  All:       { emoji: "✦", label: "All" },
  General:   { emoji: "☺", label: "General" },
  Showcase:  { emoji: "✱", label: "Showcase" },
  Help:      { emoji: "?",  label: "Help" },
  Wins:      { emoji: "★",  label: "Wins" },
  Feedback:  { emoji: "♡",  label: "Feedback" },
} as const;
type Category = keyof typeof CATEGORY_META;
const CATEGORIES = Object.keys(CATEGORY_META) as Category[];
const POST_CATEGORIES = CATEGORIES.filter((c) => c !== "All");

// Cycled tilt values for the sidebar and feed so each surface feels hand-placed
// instead of perfectly aligned.
const TILTS = [-1.5, 1, -0.5, 1.5, -1, 0.5];
const tiltAt = (i: number) => TILTS[i % TILTS.length];

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

  // Theme tokens — scrapbook works best on cream paper; dark mode swaps the
  // base palette to a warm near-black so the same stickers still read.
  const ink = isDark ? "#f4ece0" : "#0d1117";
  const paper = isDark ? "#14100c" : "#fdf6ec";
  const paperAlt = isDark ? "#1c1712" : "#fff8ec";

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
    <div className="relative min-h-screen" style={{ background: paper, color: ink }}>
      <PaperTexture isDark={isDark} />

      {/* Top strip */}
      <header className="relative z-20 border-b-2" style={{ borderColor: ink, background: paperAlt }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/generate" className="mb-link flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.12em]">
            <ArrowLeft className="h-4 w-4" /> Back to canvas
          </Link>
          <div className="font-black uppercase tracking-[0.2em] text-[13px]">Motionboards · Zine</div>
          <div className="flex items-center gap-2">
            {me ? (
              <>
                <Avatar name={me.name} size="sm" ink={ink} />
                <span className="text-[12px] font-black">{me.name}</span>
              </>
            ) : (
              <span className="text-[12px] font-bold opacity-60">Sign in to post</span>
            )}
          </div>
        </div>
      </header>

      {/* Masthead */}
      <section className="relative mx-auto max-w-6xl px-5 pt-10 pb-6">
        <div className="relative flex items-end justify-between gap-6 flex-wrap">
          <div className="relative">
            <span className="mb-serif-italic text-[13px] opacity-70">— where creators show up, loudly —</span>
            <h1 className="mt-1 relative inline-block">
              <span className="block font-black uppercase leading-[0.88] tracking-tight" style={{ fontSize: "clamp(3.25rem, 10vw, 7rem)" }}>
                The feed.
              </span>
              <ScribbleUnderline color="#f26522" />
              <StarDoodle className="absolute -top-6 -right-10 text-[#f26522]" rotate={-10} size={34} />
            </h1>
            <p className="mt-3 mb-serif-italic text-[15px] opacity-80 max-w-md">
              Wins. Works-in-progress. Weird questions. Drop it all here and watch it loop.
            </p>
          </div>

          <StickerButton
            onClick={() => {
              if (!me) return showToast("Sign in to post", { kind: "info" });
              setShowComposer(true);
            }}
            ink={ink}
            rotate={2}
          >
            <Plus className="h-4 w-4" /> New Post
          </StickerButton>
        </div>

        <DashDivider ink={ink} className="mt-10" />
      </section>

      <main className="relative mx-auto grid max-w-6xl gap-8 px-5 pb-20 md:grid-cols-[240px_1fr_280px]">
        {/* Left: categories stack */}
        <aside className="md:sticky md:top-24 md:self-start">
          <div className="space-y-3">
            {CATEGORIES.map((c, i) => (
              <CategoryCard
                key={c}
                cat={c}
                active={activeCategory === c}
                ink={ink}
                paper={paperAlt}
                tilt={tiltAt(i)}
                onClick={() => setActiveCategory(c)}
              />
            ))}
          </div>
        </aside>

        {/* Center: feed */}
        <section className="min-w-0">
          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-[#f26522]" />
            </div>
          ) : posts.length === 0 ? (
            <EmptyFeed ink={ink} paper={paperAlt} onNew={() => me ? setShowComposer(true) : showToast("Sign in to post", { kind: "info" })} />
          ) : (
            <div className="space-y-6">
              {posts.map((p, i) => (
                <FeedCard
                  key={p.id}
                  post={p}
                  ink={ink}
                  paper={paperAlt}
                  tilt={tiltAt(i + 2)}
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
          <Leaderboard entries={leaderboard} ink={ink} paper={paperAlt} />
        </aside>
      </main>

      {openPost && (
        <PostDetailModal
          post={openPost}
          me={me}
          isAdmin={!!isAdmin}
          ink={ink}
          paper={paper}
          paperAlt={paperAlt}
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
          ink={ink}
          paper={paper}
          paperAlt={paperAlt}
          onClose={() => setShowComposer(false)}
          onCreated={(post) => {
            setPosts((prev) => [post, ...prev]);
            setShowComposer(false);
            loadLeaderboard();
          }}
        />
      )}

      <UILayer />

      {/* Font + keyframes. Inline so the page is self-contained. If Caveat/
          Fraunces aren't on the system we fall back through native cursive/
          serif stacks so it still reads artistic. */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Fraunces:ital,wght@0,800;1,600;1,700&display=swap');
        .mb-script { font-family: 'Caveat', 'Kalam', 'Bradley Hand', 'Segoe Script', cursive; }
        .mb-serif-italic { font-style: italic; font-family: 'Fraunces', 'Georgia', 'Times New Roman', serif; font-weight: 600; letter-spacing: -0.01em; }
        .mb-serif-display { font-family: 'Fraunces', 'Georgia', serif; font-weight: 800; font-style: italic; letter-spacing: -0.03em; }
        @keyframes mb-card-in {
          from { transform: translateY(10px) rotate(var(--tilt, 0deg)); opacity: 0; }
          to { transform: translateY(0) rotate(var(--tilt, 0deg)); opacity: 1; }
        }
        .mb-card-enter { animation: mb-card-in 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .mb-link { transition: color 120ms; }
        .mb-link:hover { color: #f26522; }
      `}</style>
    </div>
  );
}

// --- Paper texture overlay --------------------------------------------------

function PaperTexture({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundImage: isDark
          ? "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)"
          : "radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)",
        backgroundSize: "4px 4px",
        opacity: 0.6,
      }}
    />
  );
}

// --- Sticker primitives -----------------------------------------------------

function StickerButton({
  children,
  ink,
  rotate = 0,
  onClick,
  fill = "#f26522",
  color = "#fff",
  size = "md",
  disabled = false,
}: {
  children: React.ReactNode;
  ink: string;
  rotate?: number;
  onClick?: () => void;
  fill?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}) {
  const pad = size === "lg" ? "px-6 py-3 text-[14px]" : size === "sm" ? "px-3 py-1.5 text-[11px]" : "px-5 py-2.5 text-[13px]";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full border-[2.5px] font-black uppercase tracking-wider transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 ${pad}`}
      style={{
        background: fill,
        color,
        borderColor: ink,
        boxShadow: `4px 4px 0 0 ${ink}`,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {children}
    </button>
  );
}

function StickerChip({
  children,
  ink,
  fill,
  color = "#0d1117",
  rotate = 0,
}: {
  children: React.ReactNode;
  ink: string;
  fill: string;
  color?: string;
  rotate?: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border-2 px-2 py-[2px] text-[10px] font-black uppercase tracking-wider"
      style={{ background: fill, color, borderColor: ink, transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

function DashDivider({ ink, className = "" }: { ink: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex-1 border-t-[2px] border-dashed" style={{ borderColor: ink, opacity: 0.35 }} />
      <span className="h-2 w-2 rounded-full" style={{ background: "#f26522" }} />
      <span className="flex-1 border-t-[2px] border-dashed" style={{ borderColor: ink, opacity: 0.35 }} />
    </div>
  );
}

function ScribbleUnderline({ color }: { color: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 220 18"
      className="absolute left-0 right-0 -bottom-2 w-[60%] max-w-[320px]"
      preserveAspectRatio="none"
    >
      <path
        d="M3 12 C 40 2, 80 16, 120 8 S 200 4, 218 12"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StarDoodle({
  className = "",
  rotate = 0,
  size = 24,
}: {
  className?: string;
  rotate?: number;
  size?: number;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
        fill="currentColor"
      />
    </svg>
  );
}

// --- Category card ---------------------------------------------------------

function CategoryCard({
  cat,
  active,
  ink,
  paper,
  tilt,
  onClick,
}: {
  cat: Category;
  active: boolean;
  ink: string;
  paper: string;
  tilt: number;
  onClick: () => void;
}) {
  const meta = CATEGORY_META[cat];
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border-[2.5px] px-3 py-3 text-left transition-transform hover:-translate-y-0.5 hover:translate-x-0.5"
      style={{
        background: active ? "#f26522" : paper,
        color: active ? "#fff" : ink,
        borderColor: ink,
        boxShadow: `${active ? 5 : 3}px ${active ? 5 : 3}px 0 0 ${ink}`,
        transform: `rotate(${tilt}deg)`,
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[16px] font-black"
        style={{
          background: active ? "#fff" : "#f26522",
          color: active ? "#f26522" : "#fff",
          borderColor: ink,
        }}
      >
        {meta.emoji}
      </span>
      <span className="text-[14px] font-black tracking-tight">{meta.label}</span>
    </button>
  );
}

// --- Empty feed ------------------------------------------------------------

function EmptyFeed({ ink, paper, onNew }: { ink: string; paper: string; onNew: () => void }) {
  return (
    <div
      className="relative rounded-3xl border-[2.5px] p-10 text-center"
      style={{
        background: paper,
        borderColor: ink,
        boxShadow: `6px 6px 0 0 ${ink}`,
        transform: "rotate(-0.5deg)",
      }}
    >
      <StarDoodle className="absolute top-4 left-6 text-[#f26522]" rotate={12} size={22} />
      <StarDoodle className="absolute top-10 right-10 text-[#f26522]" rotate={-20} size={16} />
      <StarDoodle className="absolute bottom-6 left-12 text-[#f26522]" rotate={8} size={18} />

      <span className="mb-serif-italic text-[14px] opacity-75">— chapter one —</span>
      <h3 className="mt-2 mb-serif-display" style={{ fontSize: "clamp(2rem, 5vw, 3rem)", color: ink }}>
        Nothing here… <span style={{ color: "#f26522" }}>yet.</span>
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-[13px]" style={{ color: ink, opacity: 0.7 }}>
        Be the one to start it. Drop a win, a WIP, or a weird question — this feed loves it all.
      </p>
      <div className="mt-5 flex justify-center">
        <StickerButton ink={ink} onClick={onNew} rotate={-1} size="lg">
          <Plus className="h-4 w-4" /> Make the first post
        </StickerButton>
      </div>
    </div>
  );
}

// --- Feed card -------------------------------------------------------------

function FeedCard({
  post,
  ink,
  paper,
  tilt,
  onOpen,
  onToggleLike,
}: {
  post: Post;
  ink: string;
  paper: string;
  tilt: number;
  onOpen: () => void;
  onToggleLike: () => void;
}) {
  const cat = getCat(post.category);
  const meta = CATEGORY_META[cat];

  return (
    <article
      className="mb-card-enter relative rounded-3xl border-[2.5px] p-5 transition-transform hover:-translate-y-1"
      style={
        {
          background: paper,
          color: ink,
          borderColor: ink,
          boxShadow: `6px 6px 0 0 ${ink}`,
          transform: `rotate(${tilt}deg)`,
          // expose to the keyframe so the card lands at its real tilt:
          ["--tilt" as string]: `${tilt}deg`,
          opacity: post.hidden ? 0.5 : 1,
        } as React.CSSProperties
      }
    >
      {/* Taped category label */}
      <div
        className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-md border-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
        style={{
          background: "#f26522",
          color: "#fff",
          borderColor: ink,
          transform: "rotate(-3deg)",
          boxShadow: `2px 2px 0 0 ${ink}`,
        }}
      >
        <span className="text-[13px] leading-none">{meta.emoji}</span>
        {meta.label}
      </div>

      {post.pinned && (
        <div
          className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-md border-2 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
          style={{
            color: ink,
            borderColor: ink,
            transform: "rotate(3deg)",
            boxShadow: `2px 2px 0 0 ${ink}`,
          }}
        >
          <Pin className="h-3 w-3" /> Pinned
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Avatar name={post.authorName} ink={ink} size="md" stickerRing />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-black truncate">{post.authorName}</p>
          <p className="mb-serif-italic text-[11.5px] opacity-70">{relativeTime(post.createdAt)}</p>
        </div>
      </div>

      <button onClick={onOpen} className="mt-3 block w-full text-left">
        <h3
          className="mb-serif-display leading-[1.05]"
          style={{ fontSize: "clamp(1.25rem, 2vw, 1.6rem)" }}
        >
          {post.title || "(untitled)"}
        </h3>
        {post.body && (
          <p className="mt-1.5 text-[13.5px] leading-relaxed line-clamp-3" style={{ color: ink, opacity: 0.8 }}>
            {post.body}
          </p>
        )}
      </button>

      {post.fileId && (
        <button
          onClick={onOpen}
          className="mt-3 block w-full overflow-hidden rounded-2xl border-[2.5px]"
          style={{ borderColor: ink }}
        >
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

      <div className="mt-4 flex items-center gap-2 border-t-[2px] border-dashed pt-3" style={{ borderColor: ink, opacity: 1 }}>
        <button
          onClick={onToggleLike}
          className="group inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[12px] font-black uppercase tracking-wider transition-transform hover:-translate-y-0.5"
          style={{
            background: post.likedByMe ? "#f26522" : "transparent",
            color: post.likedByMe ? "#fff" : ink,
            borderColor: ink,
            boxShadow: post.likedByMe ? `2px 2px 0 0 ${ink}` : "none",
          }}
        >
          <Heart className={`h-3.5 w-3.5 ${post.likedByMe ? "fill-current" : ""}`} />
          {post.likeCount}
        </button>
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[12px] font-black uppercase tracking-wider transition-transform hover:-translate-y-0.5"
          style={{ borderColor: ink, color: ink }}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {post.commentCount}
        </button>
      </div>
    </article>
  );
}

// --- Leaderboard -----------------------------------------------------------

function Leaderboard({ entries, ink, paper }: { entries: LeaderEntry[]; ink: string; paper: string }) {
  return (
    <div
      className="relative rounded-3xl border-[2.5px] p-5"
      style={{
        background: paper,
        borderColor: ink,
        boxShadow: `5px 5px 0 0 ${ink}`,
        transform: "rotate(1deg)",
      }}
    >
      <StarDoodle className="absolute -top-3 -right-2 text-[#f26522]" rotate={20} size={20} />
      <div className="mb-3">
        <span className="mb-serif-italic text-[12px] opacity-70">— on top —</span>
        <h3 className="mb-serif-display leading-none" style={{ fontSize: "1.6rem", color: ink }}>
          Top creators
        </h3>
      </div>
      {entries.length === 0 ? (
        <p className="text-[12px]" style={{ color: ink, opacity: 0.7 }}>
          No activity yet. Post something and claim #1.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => {
            const isOne = i === 0;
            return (
              <div
                key={e.userId}
                className="flex items-center gap-2.5 rounded-2xl border-2 px-2.5 py-2"
                style={{
                  background: isOne ? "#f26522" : "transparent",
                  color: isOne ? "#fff" : ink,
                  borderColor: ink,
                  boxShadow: isOne ? `3px 3px 0 0 ${ink}` : "none",
                  transform: `rotate(${isOne ? -1 : 0}deg)`,
                }}
              >
                <span
                  className="mb-serif-display flex h-7 w-7 shrink-0 items-center justify-center leading-none"
                  style={{
                    color: isOne ? "#fff" : "#f26522",
                    fontSize: "1.35rem",
                    fontStyle: "italic",
                  }}
                >
                  {i + 1}
                </span>
                <Avatar name={e.authorName} ink={ink} size="sm" stickerRing={isOne} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[12.5px] font-black">{e.authorName}</p>
                  <p className="text-[10px] font-bold" style={{ opacity: 0.85 }}>
                    Lv {e.level} · {e.points} pts
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- New post modal --------------------------------------------------------

function NewPostModal({
  ink,
  paper,
  paperAlt,
  onClose,
  onCreated,
}: {
  ink: string;
  paper: string;
  paperAlt: string;
  onClose: () => void;
  onCreated: (post: Post) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("General");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      updateToast(toastId, { kind: "success", message: "Posted." });
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

  const inputStyle: React.CSSProperties = {
    background: paperAlt,
    color: ink,
    borderColor: ink,
    boxShadow: `3px 3px 0 0 ${ink}`,
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border-[2.5px] overflow-hidden"
        style={{ background: paper, color: ink, borderColor: ink, boxShadow: `8px 8px 0 0 ${ink}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <StarDoodle className="absolute top-3 left-5 text-[#f26522]" rotate={8} size={22} />
        <StarDoodle className="absolute top-4 right-20 text-[#f26522]" rotate={-18} size={16} />

        <div className="flex items-center justify-between border-b-2 px-5 py-4" style={{ borderColor: ink }}>
          <div>
            <span className="mb-serif-italic text-[12px] opacity-70">— write a post —</span>
            <h3 className="mb-serif-display leading-none mt-1" style={{ fontSize: "1.6rem", color: ink }}>
              Say it loud.
            </h3>
          </div>
          <button onClick={onClose} className="rounded-full border-2 p-1.5" style={{ borderColor: ink }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-5">
          <input
            type="text"
            placeholder="Title. Keep it punchy."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border-[2.5px] px-4 py-3 text-[16px] font-black outline-none"
            style={inputStyle}
          />
          <div className="flex flex-wrap gap-1.5">
            {POST_CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c];
              const active = category === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="inline-flex items-center gap-1.5 rounded-full border-[2.5px] px-3 py-1 text-[11px] font-black uppercase tracking-wider transition-transform hover:-translate-y-0.5"
                  style={{
                    background: active ? "#f26522" : paperAlt,
                    color: active ? "#fff" : ink,
                    borderColor: ink,
                    boxShadow: active ? `3px 3px 0 0 ${ink}` : "none",
                    transform: active ? "rotate(-1.5deg)" : "rotate(0deg)",
                  }}
                >
                  <span className="text-[13px] leading-none">{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
          <textarea
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-2xl border-[2.5px] px-4 py-3 text-[13.5px] leading-relaxed outline-none"
            style={inputStyle}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider hover:-translate-y-0.5 transition-transform"
              style={{ borderColor: ink, color: ink, background: "transparent" }}
            >
              <Paperclip className="h-3.5 w-3.5" />
              {file ? "Swap attachment" : "Attach image / video"}
            </button>
            {file && (
              <span className="mb-serif-italic inline-flex items-center gap-1 text-[11px]" style={{ color: "#f26522" }}>
                {file.type.startsWith("video/") ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                <span className="truncate max-w-[180px]">{file.name}</span>
                <button onClick={() => setFile(null)} className="ml-1 opacity-60 hover:opacity-100">
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

        <div className="flex items-center justify-end gap-3 border-t-2 px-5 py-3" style={{ borderColor: ink, background: paperAlt }}>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full border-2 px-4 py-2 text-[11.5px] font-black uppercase tracking-wider"
            style={{ borderColor: ink, color: ink, background: "transparent" }}
          >
            Cancel
          </button>
          <StickerButton ink={ink} onClick={submit} disabled={busy || !title.trim()} rotate={-1}>
            {busy ? "Publishing…" : "Publish"}
          </StickerButton>
        </div>
      </div>
    </div>
  );
}

// --- Post detail modal -----------------------------------------------------

function PostDetailModal({
  post,
  me,
  isAdmin,
  ink,
  paper,
  paperAlt,
  onClose,
  onMutate,
  onRemove,
}: {
  post: Post;
  me: Me | null;
  isAdmin: boolean;
  ink: string;
  paper: string;
  paperAlt: string;
  onClose: () => void;
  onMutate: (updater: (p: Post) => Post) => void;
  onRemove: (id: string) => void;
}) {
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
    <div
      className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto p-4 md:items-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl border-[2.5px] overflow-hidden"
        style={{ background: paper, color: ink, borderColor: ink, boxShadow: `8px 8px 0 0 ${ink}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute -top-3 right-8 inline-flex items-center gap-1 rounded-md border-2 px-3 py-1 text-[10.5px] font-black uppercase tracking-wider"
          style={{
            background: "#f26522",
            color: "#fff",
            borderColor: ink,
            transform: "rotate(-3deg)",
            boxShadow: `2px 2px 0 0 ${ink}`,
          }}
        >
          <span className="text-[13px] leading-none">{meta.emoji}</span>
          {meta.label}
        </div>

        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border-2 p-1.5"
          style={{ borderColor: ink, background: paperAlt }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6">
          <div className="flex items-center gap-3">
            <Avatar name={post.authorName} ink={ink} size="md" stickerRing />
            <div className="flex-1 min-w-0">
              <p className="font-black truncate">{post.authorName}</p>
              <p className="mb-serif-italic text-[11.5px] opacity-70">{relativeTime(post.createdAt)}</p>
            </div>
          </div>

          <h2 className="mb-serif-display mt-4 leading-[1.02]" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.4rem)" }}>
            {post.title}
          </h2>
          {post.body && (
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed" style={{ opacity: 0.85 }}>
              {post.body}
            </p>
          )}

          {post.fileId && (
            <div className="mt-4 overflow-hidden rounded-2xl border-[2.5px]" style={{ borderColor: ink }}>
              {post.mediaType === "video" ? (
                <video src={`/api/files/${post.fileId}`} controls className="max-h-[60vh] w-full" />
              ) : (
                <img src={`/api/files/${post.fileId}`} alt="" className="max-h-[60vh] w-full object-contain" />
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-dashed pt-3" style={{ borderColor: ink }}>
            <button
              onClick={togglePostLike}
              className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[12px] font-black uppercase tracking-wider"
              style={{
                background: post.likedByMe ? "#f26522" : "transparent",
                color: post.likedByMe ? "#fff" : ink,
                borderColor: ink,
                boxShadow: post.likedByMe ? `2px 2px 0 0 ${ink}` : "none",
              }}
            >
              <Heart className={`h-3.5 w-3.5 ${post.likedByMe ? "fill-current" : ""}`} />
              {post.likeCount}
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[12px] font-black uppercase tracking-wider" style={{ borderColor: ink, opacity: 0.7 }}>
              <MessageCircle className="h-3.5 w-3.5" />
              {post.commentCount}
            </span>
            <div className="flex-1" />
            <button
              onClick={flagPost}
              disabled={post.flaggedByMe}
              title={post.flaggedByMe ? "Already reported" : "Report"}
              className="rounded-full border-2 p-1.5"
              style={{ borderColor: ink, color: post.flaggedByMe ? "#d97706" : ink, background: "transparent" }}
            >
              <Flag className="h-4 w-4" />
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={togglePin}
                  title={post.pinned ? "Unpin" : "Pin"}
                  className="rounded-full border-2 p-1.5"
                  style={{ borderColor: ink, color: post.pinned ? "#f26522" : ink, background: "transparent" }}
                >
                  {post.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
                <button
                  onClick={toggleHide}
                  title={post.hidden ? "Unhide" : "Hide"}
                  className="rounded-full border-2 p-1.5"
                  style={{ borderColor: ink, color: post.hidden ? "#dc2626" : ink, background: "transparent" }}
                >
                  {post.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </>
            )}
            {canDeletePost && (
              <button onClick={remove} className="rounded-full border-2 p-1.5" style={{ borderColor: ink, color: "#dc2626", background: "transparent" }}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-5">
            <span className="mb-serif-italic text-[12px] opacity-70">— chatter —</span>
            <h4 className="mb-serif-display leading-none mt-0.5" style={{ fontSize: "1.3rem" }}>
              {post.commentCount} Comment{post.commentCount === 1 ? "" : "s"}
            </h4>
            <div className="mt-2 space-y-2">
              {loadingComments ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin opacity-70" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-[12px] opacity-70">No replies yet. Be the one with something to say.</p>
              ) : (
                comments.map((c, i) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    me={me}
                    isAdmin={isAdmin}
                    ink={ink}
                    paper={paperAlt}
                    tilt={tiltAt(i + 4)}
                    onLike={() => toggleCommentLike(c)}
                    onDelete={() => deleteComment(c)}
                  />
                ))
              )}
            </div>

            <div className="mt-3 flex items-start gap-2">
              <Avatar name={me?.name || "?"} ink={ink} size="sm" />
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
                  className="w-full resize-none rounded-2xl border-[2.5px] px-3 py-2 text-[13px] outline-none"
                  style={{ background: paperAlt, color: ink, borderColor: ink, boxShadow: `3px 3px 0 0 ${ink}` }}
                />
                <div className="mt-1.5 flex justify-end">
                  <StickerButton ink={ink} onClick={submitComment} disabled={!me || !newComment.trim() || posting} rotate={-1} size="sm">
                    <Send className="h-3 w-3" />
                    {posting ? "Posting…" : "Comment"}
                  </StickerButton>
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
  ink,
  paper,
  tilt,
  onLike,
  onDelete,
}: {
  comment: Comment;
  me: Me | null;
  isAdmin: boolean;
  ink: string;
  paper: string;
  tilt: number;
  onLike: () => void;
  onDelete: () => void;
}) {
  const canDelete = !!me && (me.id === comment.userId || isAdmin);
  return (
    <div
      className="flex items-start gap-2 rounded-2xl border-2 px-3 py-2.5"
      style={{
        background: paper,
        borderColor: ink,
        boxShadow: `3px 3px 0 0 ${ink}`,
        transform: `rotate(${tilt}deg)`,
        opacity: comment.hidden ? 0.5 : 1,
      }}
    >
      <Avatar name={comment.authorName} ink={ink} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-black">{comment.authorName}</p>
          <span className="mb-serif-italic text-[10px] opacity-70">{relativeTime(comment.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ opacity: 0.9 }}>
          {comment.body}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <button
            onClick={onLike}
            className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
            style={{ color: comment.likedByMe ? "#f26522" : ink }}
          >
            <Heart className={`h-3 w-3 ${comment.likedByMe ? "fill-current" : ""}`} />
            {comment.likeCount}
          </button>
          {canDelete && (
            <button onClick={onDelete} className="text-[11px] font-black uppercase tracking-wider" style={{ color: "#dc2626" }}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Avatar ----------------------------------------------------------------

function Avatar({
  name,
  ink,
  size = "md",
  stickerRing = false,
}: {
  name: string;
  ink: string;
  size?: "sm" | "md";
  stickerRing?: boolean;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const dim = size === "sm" ? "h-7 w-7 text-[11px]" : "h-10 w-10 text-[14px]";
  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [18, 30, 160, 200, 280, 340];
  const hue = hues[hash % hues.length];
  const circle = (
    <div
      className={`flex items-center justify-center rounded-full border-2 font-black text-white shrink-0 ${dim}`}
      style={{ background: `hsl(${hue}, 65%, 48%)`, borderColor: ink }}
    >
      {initial}
    </div>
  );
  if (!stickerRing) return circle;
  const pad = size === "sm" ? "p-[2px]" : "p-[3px]";
  return (
    <div className={`rounded-full shrink-0 ${pad}`} style={{ background: "#f26522" }}>
      <div className={`rounded-full ${pad}`} style={{ background: "#fff" }}>
        {circle}
      </div>
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
