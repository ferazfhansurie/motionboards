import { NextResponse } from "next/server";

// GET /api/blob/test — diagnostic endpoint that tells us exactly what's
// wrong with the Blob setup. Visit this URL in the browser after deploying
// and read the JSON; no auth needed so you can curl it too.
export async function GET() {
  const tokenEnv = process.env.BLOB_READ_WRITE_TOKEN;
  if (!tokenEnv) {
    return NextResponse.json({
      ok: false,
      reason: "BLOB_READ_WRITE_TOKEN env var is NOT set on this deployment.",
      fix: "Vercel dashboard → Storage → your Blob store → Projects → Connect motionboards. Then redeploy.",
    });
  }

  // Shape check — Vercel-issued tokens start with vercel_blob_rw_ and are
  // around 120 chars. If the value doesn't match, something's off.
  const shape = {
    length: tokenEnv.length,
    startsWith: tokenEnv.slice(0, 20),
    looksValid: tokenEnv.startsWith("vercel_blob_rw_") && tokenEnv.length > 60,
  };

  // Try listing to confirm the token actually grants access to the store.
  try {
    const { list } = await import("@vercel/blob");
    const res = await list({ limit: 1, token: tokenEnv });
    return NextResponse.json({
      ok: true,
      shape,
      listWorks: true,
      blobCount: res.blobs.length,
      hasMore: res.hasMore,
      note: "Token is valid and can reach the Blob store. If uploads still fail, the issue is elsewhere (client SDK version, CORS, or upload size).",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      shape,
      listWorks: false,
      error: msg,
      fix: "The token is set but Vercel rejected the list() call. Most likely: the token belongs to a different Blob store than the one linked to this project, OR the Blob store was deleted. Re-create or re-link from Vercel → Storage.",
    });
  }
}
