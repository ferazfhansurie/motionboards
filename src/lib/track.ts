// In-house event tracking. Replaces Meta Pixel.
//
// Anonymous users get a stable `mb_anon_id` UUID stored in localStorage so
// their pre-signup activity (impressions, gated-generate clicks, etc.) can
// be stitched together — and joined to their user_id once they sign up.

const ANON_KEY = "mb_anon_id";

function ensureAnonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      // Cheap UUID — crypto.randomUUID is widely supported, fallback below.
      id = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// Fire-and-forget. Failures are swallowed — analytics never blocks UX.
export function track(eventName: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const payload = {
    eventName,
    anonId: ensureAnonId(),
    // Pathname only — strip query string so the same logical page (e.g.
    // /generate vs /generate?fbclid=...) doesn't fragment into N rows.
    pathname: window.location.pathname,
    referrer: document.referrer || undefined,
    properties,
  };
  try {
    // sendBeacon survives page navigations (great for outbound link clicks).
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/track", blob);
      if (ok) return;
    }
  } catch { /* fall through to fetch */ }
  // Fallback: regular fetch with keepalive so it still goes out on unload.
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => { /* swallow */ });
}
