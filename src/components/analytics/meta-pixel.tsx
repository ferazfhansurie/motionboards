"use client";

// Meta Pixel (Facebook Pixel) — client-side tracking.
//
// Wires the standard fbq base code and fires PageView on every App Router
// navigation. Loads via next/script with strategy="afterInteractive" so it
// doesn't block first paint.
//
// Pixel ID comes from NEXT_PUBLIC_META_PIXEL_ID — without it, the component
// renders nothing (so local dev / preview deploys don't pollute prod stats).
//
// To track conversions elsewhere in the app, import { fbqTrack } and call:
//   fbqTrack("Lead");                             // simple
//   fbqTrack("Purchase", { value: 19, currency: "MYR" });

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export function fbqTrack(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (params) window.fbq("track", eventName, params);
  else window.fbq("track", eventName);
}

export function MetaPixel() {
  const pathname = usePathname();

  // Fire PageView on every client-side route change. The first PageView
  // is also fired by the inline script below for users who land directly.
  useEffect(() => {
    if (!PIXEL_ID) return;
    fbqTrack("PageView");
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      {/* Noscript fallback — fires a 1×1 tracking pixel for users with JS off */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
