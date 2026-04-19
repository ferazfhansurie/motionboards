"use client";

// Hand-drawn scrapbook stickers — all inline SVG so they're crisp, themable,
// and never hit the network. Every sticker takes a size, rotation, and a
// color pair (fill + ink) so they can be tinted per-surface. Export a single
// `Sticker` object so callers can write `<Sticker.Daisy rotate={-6} />` and
// keep code scannable.

import type { CSSProperties } from "react";

export interface StickerProps {
  size?: number;
  rotate?: number;
  className?: string;
  color?: string;
  ink?: string;
  style?: CSSProperties;
}

function wrapStyle(size: number, rotate: number, extra?: CSSProperties): CSSProperties {
  return {
    width: size,
    height: size,
    display: "inline-block",
    transform: `rotate(${rotate}deg)`,
    transformOrigin: "center",
    ...extra,
  };
}

// --- Star (hand-drawn 5-point, off-kilter) -------------------------------

function StarDoodle({ size = 40, rotate = 0, color = "#f26522", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={wrapStyle(size, rotate, style)}>
      <path
        d="M32 4 C34 18, 46 20, 60 22 C48 30, 50 42, 54 58 C40 48, 28 54, 14 60 C20 46, 14 36, 4 26 C18 26, 28 18, 32 4 Z"
        fill={color}
        stroke={ink}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Daisy (5-petal flower) ----------------------------------------------

function Daisy({ size = 48, rotate = 0, color = "#f26522", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={wrapStyle(size, rotate, style)}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="32"
          cy="14"
          rx="9"
          ry="13"
          fill={color}
          stroke={ink}
          strokeWidth={2.5}
          transform={`rotate(${a} 32 32)`}
        />
      ))}
      <circle cx="32" cy="32" r="7" fill="#fff8ec" stroke={ink} strokeWidth={2.5} />
    </svg>
  );
}

// --- Wobbly heart --------------------------------------------------------

function Heart({ size = 40, rotate = 0, color = "#ec4899", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 64 58" className={className} style={wrapStyle(size, rotate, style)}>
      <path
        d="M32 54 C 4 40, 2 16, 18 10 C 26 8, 30 14, 32 20 C 34 14, 38 8, 46 10 C 62 16, 60 40, 32 54 Z"
        fill={color}
        stroke={ink}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- 4-point sparkle -----------------------------------------------------

function Sparkle({ size = 28, rotate = 0, color = "#f26522", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={wrapStyle(size, rotate, style)}>
      <path
        d="M20 2 L23 17 L38 20 L23 23 L20 38 L17 23 L2 20 L17 17 Z"
        fill={color}
        stroke={ink}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Starburst (multi-spike) ---------------------------------------------

function Burst({ size = 56, rotate = 0, color = "#f26522", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 80 80" className={className} style={wrapStyle(size, rotate, style)}>
      <path
        d="M40 4 L44 22 L60 10 L54 28 L74 26 L58 38 L76 46 L56 48 L66 66 L48 56 L44 76 L40 58 L32 76 L30 56 L12 66 L22 48 L2 46 L20 38 L4 26 L24 28 L20 10 L36 22 Z"
        fill={color}
        stroke={ink}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Squiggle wave -------------------------------------------------------

function Squiggle({ size = 60, rotate = 0, color = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 80 24" className={className} style={wrapStyle(size, rotate, { height: size * 0.3, ...style })}>
      <path
        d="M2 12 C 10 2, 18 22, 26 12 S 42 2, 50 12 S 66 22, 78 12"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Scribble cluster ----------------------------------------------------

function Scribble({ size = 52, rotate = 0, color = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 60 60" className={className} style={wrapStyle(size, rotate, style)}>
      <path
        d="M10 40 C 18 18, 34 22, 42 36 C 50 50, 26 52, 18 42 C 12 36, 22 30, 32 32 C 42 34, 48 26, 42 20"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Hand-drawn arrow ----------------------------------------------------

function Arrow({ size = 60, rotate = 0, color = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 80 40" className={className} style={wrapStyle(size, rotate, { height: size * 0.5, ...style })}>
      <path
        d="M4 20 C 20 10, 40 26, 62 18"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path
        d="M54 10 L64 18 L56 28"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Masking tape strip --------------------------------------------------

function Tape({ size = 80, rotate = -6, color = "#f2b56522", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg
      viewBox="0 0 120 40"
      className={className}
      style={wrapStyle(size, rotate, { height: size * 0.33, ...style })}
    >
      <rect x="2" y="6" width="116" height="28" fill={color} stroke={ink} strokeWidth={1.5} />
      <line x1="8" y1="12" x2="112" y2="12" stroke={ink} strokeOpacity="0.2" strokeWidth={1} />
      <line x1="8" y1="28" x2="112" y2="28" stroke={ink} strokeOpacity="0.2" strokeWidth={1} />
    </svg>
  );
}

// --- Post-it note --------------------------------------------------------

function PostIt({
  size = 80,
  rotate = 3,
  color = "#ffe58f",
  ink = "#0d1117",
  className,
  style,
  children,
}: StickerProps & { children?: React.ReactNode }) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        transform: `rotate(${rotate}deg)`,
        background: color,
        border: `2.5px solid ${ink}`,
        boxShadow: `4px 4px 0 0 ${ink}`,
        padding: 6,
        fontSize: size * 0.14,
        fontFamily: "'Caveat', 'Bradley Hand', cursive",
        color: ink,
        lineHeight: 1.1,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// --- Paperclip -----------------------------------------------------------

function Paperclip({ size = 36, rotate = 0, color = "#9ca3af", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 40 60" className={className} style={wrapStyle(size, rotate, { height: size * 1.5, ...style })}>
      <path
        d="M12 48 V 14 C 12 6, 28 6, 28 14 V 46 C 28 54, 16 54, 16 46 V 20"
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M12 48 V 14 C 12 6, 28 6, 28 14 V 46 C 28 54, 16 54, 16 46 V 20"
        fill="none"
        stroke={ink}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Pencil --------------------------------------------------------------

function Pencil({ size = 70, rotate = -25, ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 120 24" className={className} style={wrapStyle(size, rotate, { height: size * 0.2, ...style })}>
      <polygon points="2,12 14,4 14,20" fill="#e5c99a" stroke={ink} strokeWidth={2} />
      <polygon points="14,4 14,20 24,20 24,4" fill="#111" stroke={ink} strokeWidth={2} />
      <rect x="24" y="4" width="70" height="16" fill="#f2b356" stroke={ink} strokeWidth={2} />
      <rect x="94" y="4" width="16" height="16" fill="#e4b3b3" stroke={ink} strokeWidth={2} />
      <rect x="110" y="4" width="8" height="16" fill="#8b7b6e" stroke={ink} strokeWidth={2} />
    </svg>
  );
}

// --- Coffee mug with stain -----------------------------------------------

function Coffee({ size = 44, rotate = 0, color = "#f26522", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 64 60" className={className} style={wrapStyle(size, rotate, style)}>
      <rect x="14" y="20" width="32" height="28" rx="3" fill={color} stroke={ink} strokeWidth={2.5} />
      <path d="M46 26 C 58 26, 58 40, 46 40" fill="none" stroke={ink} strokeWidth={2.5} />
      <path
        d="M22 14 C 24 8, 28 18, 30 12 M 34 14 C 36 8, 40 18, 42 12"
        fill="none"
        stroke={ink}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Lightning bolt ------------------------------------------------------

function Lightning({ size = 36, rotate = 10, color = "#facc15", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 40 60" className={className} style={wrapStyle(size, rotate, { height: size * 1.6, ...style })}>
      <path
        d="M22 2 L6 32 L18 32 L14 58 L34 24 L22 24 L28 2 Z"
        fill={color}
        stroke={ink}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Cross / X mark ------------------------------------------------------

function Cross({ size = 28, rotate = 0, color = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} style={wrapStyle(size, rotate, style)}>
      <line x1="6" y1="6" x2="26" y2="26" stroke={color} strokeWidth={3.5} strokeLinecap="round" />
      <line x1="26" y1="6" x2="6" y2="26" stroke={color} strokeWidth={3.5} strokeLinecap="round" />
    </svg>
  );
}

// --- Dot cluster ---------------------------------------------------------

function Dots({ size = 40, rotate = 0, color = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={wrapStyle(size, rotate, style)}>
      <circle cx="8" cy="8" r="3" fill={color} />
      <circle cx="22" cy="12" r="2.5" fill={color} />
      <circle cx="14" cy="22" r="2" fill={color} />
      <circle cx="30" cy="24" r="3.5" fill={color} />
      <circle cx="10" cy="32" r="2.5" fill={color} />
      <circle cx="26" cy="34" r="2" fill={color} />
    </svg>
  );
}

// --- Spiral --------------------------------------------------------------

function Swirl({ size = 44, rotate = 0, color = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} style={wrapStyle(size, rotate, style)}>
      <path
        d="M24 24 m0,-2 a2,2 0 1,1 0,4 a4,4 0 1,0 0,-8 a6,6 0 1,1 0,12 a8,8 0 1,0 0,-16 a10,10 0 1,1 0,20 a12,12 0 1,0 0,-24"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Concentric rings ----------------------------------------------------

function Rings({ size = 40, rotate = 0, color = "#f26522", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={wrapStyle(size, rotate, style)}>
      <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth={3} />
      <circle cx="20" cy="20" r="10" fill="none" stroke={ink} strokeWidth={3} />
      <circle cx="20" cy="20" r="4" fill={color} stroke={ink} strokeWidth={2} />
    </svg>
  );
}

// --- Flame ---------------------------------------------------------------

function Flame({ size = 36, rotate = 0, color = "#f26522", ink = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 40 52" className={className} style={wrapStyle(size, rotate, { height: size * 1.3, ...style })}>
      <path
        d="M20 4 C 18 14, 8 18, 10 30 C 12 42, 28 46, 32 34 C 34 28, 26 24, 28 16 C 24 20, 22 10, 20 4 Z"
        fill={color}
        stroke={ink}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d="M20 20 C 18 26, 14 28, 16 34 C 18 40, 26 40, 26 32 C 26 28, 22 26, 20 20 Z"
        fill="#facc15"
        stroke={ink}
        strokeWidth={1.5}
      />
    </svg>
  );
}

// --- Wink eye ------------------------------------------------------------

function Eye({ size = 40, rotate = 0, color = "#0d1117", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 48 24" className={className} style={wrapStyle(size, rotate, { height: size * 0.5, ...style })}>
      <path
        d="M4 12 C 14 2, 34 2, 44 12 C 34 22, 14 22, 4 12 Z"
        fill="#fff"
        stroke={color}
        strokeWidth={2.5}
      />
      <circle cx="24" cy="12" r="5" fill={color} />
      <circle cx="26" cy="10" r="1.5" fill="#fff" />
    </svg>
  );
}

// --- Speech bubble -------------------------------------------------------

function Bubble({
  size = 56,
  rotate = -4,
  color = "#fff8ec",
  ink = "#0d1117",
  className,
  style,
  children,
}: StickerProps & { children?: React.ReactNode }) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: size,
        minHeight: size * 0.7,
        transform: `rotate(${rotate}deg)`,
        background: color,
        border: `2.5px solid ${ink}`,
        boxShadow: `3px 3px 0 0 ${ink}`,
        borderRadius: 14,
        padding: 6,
        fontSize: size * 0.18,
        fontFamily: "'Caveat', 'Bradley Hand', cursive",
        color: ink,
        lineHeight: 1.1,
        ...style,
      }}
    >
      {children}
      <span
        style={{
          position: "absolute",
          left: 10,
          bottom: -10,
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: `12px solid ${ink}`,
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 13,
          bottom: -5,
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `8px solid ${color}`,
        }}
      />
    </div>
  );
}

// --- Polaroid frame (empty, decorative) ----------------------------------

function Polaroid({
  size = 100,
  rotate = -4,
  color = "#fff",
  ink = "#0d1117",
  className,
  style,
  fill = "#f26522",
}: StickerProps & { fill?: string }) {
  return (
    <div
      className={className}
      style={{
        width: size,
        transform: `rotate(${rotate}deg)`,
        background: color,
        border: `2.5px solid ${ink}`,
        boxShadow: `4px 4px 0 0 ${ink}`,
        padding: 6,
        paddingBottom: size * 0.22,
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          background: fill,
          border: `2px solid ${ink}`,
        }}
      />
    </div>
  );
}

// --- Coffee-stain ring (translucent) -------------------------------------

function Stain({ size = 80, rotate = 0, color = "#b45309", className, style }: StickerProps) {
  return (
    <svg viewBox="0 0 80 80" className={className} style={wrapStyle(size, rotate, { opacity: 0.35, ...style })}>
      <path
        d="M40 8 C 62 8, 72 26, 70 42 C 68 60, 50 70, 34 66 C 18 62, 6 48, 12 32 C 16 18, 28 8, 40 8 Z M 40 14 C 24 14, 14 28, 20 42 C 24 54, 42 62, 56 54 C 66 48, 66 30, 58 22 C 52 16, 46 14, 40 14 Z"
        fill={color}
      />
    </svg>
  );
}

export const Sticker = {
  Star: StarDoodle,
  Daisy,
  Heart,
  Sparkle,
  Burst,
  Squiggle,
  Scribble,
  Arrow,
  Tape,
  PostIt,
  Paperclip,
  Pencil,
  Coffee,
  Lightning,
  Cross,
  Dots,
  Swirl,
  Rings,
  Flame,
  Eye,
  Bubble,
  Polaroid,
  Stain,
};

// --- Decorative scatter ----------------------------------------------------
//
// A preset collection of stickers absolutely positioned around the corners of
// a container. Drop <DoodleScatter variant="hero" /> inside a relative parent
// and it sprinkles a matching set of stickers. Each variant is a different
// mood so surfaces can opt in without re-specifying positions.

type DoodleItem = {
  node: React.ReactNode;
  pos: React.CSSProperties;
};

const SCATTERS: Record<string, DoodleItem[]> = {
  hero: [
    { node: <Sticker.Daisy size={48} rotate={-12} />, pos: { top: -20, left: -26 } },
    { node: <Sticker.Sparkle size={30} rotate={18} />, pos: { top: 40, left: -40 } },
    { node: <Sticker.Scribble size={56} color="#f26522" rotate={14} />, pos: { bottom: -30, left: 80 } },
    { node: <Sticker.Burst size={44} color="#ec4899" rotate={-8} />, pos: { top: -30, right: 20 } },
    { node: <Sticker.Arrow size={70} rotate={-18} />, pos: { bottom: 0, right: -30 } },
    { node: <Sticker.Heart size={34} rotate={10} />, pos: { top: 80, right: -20 } },
  ],
  empty: [
    { node: <Sticker.Daisy size={38} rotate={-10} />, pos: { top: 10, left: 18 } },
    { node: <Sticker.Sparkle size={22} rotate={16} />, pos: { top: 18, right: 30 } },
    { node: <Sticker.Lightning size={28} rotate={-18} />, pos: { bottom: 14, right: 12 } },
    { node: <Sticker.Dots size={34} rotate={0} />, pos: { bottom: 10, left: 26 } },
    { node: <Sticker.Heart size={26} rotate={-6} />, pos: { top: 60, right: 70 } },
  ],
  card: [
    { node: <Sticker.Sparkle size={22} rotate={10} />, pos: { top: -10, right: -10 } },
    { node: <Sticker.Star size={24} rotate={-14} />, pos: { bottom: -12, left: -10 } },
  ],
  auth: [
    { node: <Sticker.Daisy size={46} rotate={-10} />, pos: { top: -28, left: -22 } },
    { node: <Sticker.Heart size={30} rotate={12} />, pos: { top: 40, right: -30 } },
    { node: <Sticker.Lightning size={28} rotate={-18} />, pos: { bottom: 30, left: -24 } },
    { node: <Sticker.Sparkle size={22} rotate={6} />, pos: { bottom: -20, right: 30 } },
    { node: <Sticker.Scribble size={50} color="#f26522" rotate={20} />, pos: { bottom: -30, left: 60 } },
    { node: <Sticker.Arrow size={60} rotate={-20} />, pos: { top: 80, right: -40 } },
  ],
};

export function DoodleScatter({
  variant,
  className = "",
}: {
  variant: keyof typeof SCATTERS;
  className?: string;
}) {
  const items = SCATTERS[variant] || [];
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      {items.map((it, i) => (
        <span key={i} style={{ position: "absolute", ...it.pos }}>
          {it.node}
        </span>
      ))}
    </div>
  );
}
