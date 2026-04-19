import { NextRequest, NextResponse } from "next/server";

// Thin server-side proxy to https://bisnesgpt.jutateknologi.com.
//
// motionboards is on a different origin than the bisnesgpt backend, so going
// direct from the browser risks CORS and makes the backend URL brittle to
// change. We forward /api/whatsapp/bsg/<path>?<qs> → bisnesgpt.../api/<path>?<qs>
// with the original method, body, and query string. Everything else (auth,
// QR polling, send) stays identical to how app.adleticagency.com calls the
// backend since that's the same URL shape.

const BASE = "https://bisnesgpt.jutateknologi.com";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "content-encoding",
]);

async function forward(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params;
  const subPath = (path || []).map(encodeURIComponent).join("/");
  const search = req.nextUrl.search; // includes "?" or empty
  const target = `${BASE}/api/${subPath}${search}`;

  // Copy most request headers but drop hop-by-hop and Host.
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    // NextRequest.body is a ReadableStream; streaming it directly works for
    // JSON, form, and binary bodies alike.
    body = req.body ?? undefined;
  }

  let res: Response;
  try {
    res = await fetch(target, {
      method: req.method,
      headers,
      body,
      // next is safe; we're in a Node runtime.
      // @ts-expect-error duplex is required by Node fetch when streaming a body
      duplex: body ? "half" : undefined,
    });
  } catch (err) {
    console.error("WA proxy fetch error:", err);
    return NextResponse.json(
      { error: "Upstream unreachable" },
      { status: 502 }
    );
  }

  // Pass through the response body and headers (minus hop-by-hop).
  const outHeaders = new Headers();
  res.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) outHeaders.set(key, value);
  });
  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}

export { forward as GET, forward as POST, forward as PUT, forward as DELETE, forward as PATCH };
