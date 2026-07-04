import { NextRequest, NextResponse } from "next/server";
import { runAutoPost, fetchRecentPosts, generateFathopesPost, resolvePhase } from "@/lib/threads";

// Generate + publish takes an LLM call plus two Threads round-trips and a
// short settle wait. Headroom on Vercel Pro's 300s ceiling.
export const maxDuration = 60;
// Never cache a cron endpoint.
export const dynamic = "force-dynamic";

// Vercel Cron invokes this with `Authorization: Bearer <CRON_SECRET>`.
// We also accept `?secret=` so you can fire it manually from a browser/curl
// while testing. If CRON_SECRET isn't set, the endpoint is disabled (fail
// closed) rather than left open to the world.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // ?dry=1 → generate and return the post WITHOUT publishing. Lets you
    // preview the voice (and confirm your token can read recent posts)
    // without burning a real post.
    if (req.nextUrl.searchParams.get("dry")) {
      const userId = process.env.THREADS_USER_ID;
      const token = process.env.THREADS_ACCESS_TOKEN;
      if (!userId || !token) {
        return NextResponse.json(
          { ok: false, error: "THREADS_USER_ID and THREADS_ACCESS_TOKEN must be set" },
          { status: 500 },
        );
      }
      const recent = await fetchRecentPosts(userId, token);
      const phase = resolvePhase();
      const { text, model, mood, topicTag } = await generateFathopesPost(recent, phase);
      return NextResponse.json({
        ok: true,
        dry: true,
        wouldPost: text,
        model,
        phase: phase.phase,
        day: phase.dayIndex + 1,
        mood,
        topicTag,
        sawRecent: recent.length,
      });
    }

    const { text, model, phase, mood, topicTag, result } = await runAutoPost();
    console.log(
      `[threads-autopost] published ${result.id} [${phase.phase} d${phase.dayIndex + 1} mood:${mood}] - ${text}`,
    );
    return NextResponse.json({
      ok: true,
      posted: text,
      model,
      phase: phase.phase,
      day: phase.dayIndex + 1,
      mood,
      topicTag,
      id: result.id,
      permalink: result.permalink,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "auto-post failed";
    console.error("[threads-autopost] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
