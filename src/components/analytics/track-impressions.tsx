"use client";

// Fires a `page_view` event to /api/track on every App Router navigation.
// Replaces the Meta Pixel PageView. Mount once in the root layout.
//
// Anonymous and logged-in visits are both captured; the API endpoint pulls
// user_id from the session cookie automatically.

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/track";

export function TrackImpressions() {
  const pathname = usePathname();

  useEffect(() => {
    track("page_view");
  }, [pathname]);

  return null;
}
