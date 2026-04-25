import { useEffect, useState, type RefObject } from "react";

// Returns whether a DOM node is currently intersecting the viewport (with
// the given margin). Used by board-item.tsx to defer mounting heavy
// <video> / <img> elements when they're scrolled off-screen — critical for
// mobile Safari, which OOM-kills tabs that hold too many decoded media
// elements at once.
//
// rootMargin: how far OUTSIDE the viewport an element should still count as
// "in view". A bigger margin means earlier load (smoother scroll, more
// memory); smaller means later load (saves memory, may show placeholder
// for a moment as the user scrolls).
export function useInViewport(
  ref: RefObject<HTMLElement | null>,
  rootMargin: string = "300px"
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Server / very old browser → assume in view so content still renders.
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // The single-entry case — there's only ever one observed target.
        if (entries[0]) setInView(entries[0].isIntersecting);
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return inView;
}
