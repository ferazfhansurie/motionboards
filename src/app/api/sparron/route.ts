import { NextRequest, NextResponse } from "next/server";
import { runSparron } from "@/lib/sparron";

// A run is one Graph sweep across four surfaces + an LLM triage per new item.
// Comfortable headroom under Vercel Pro's ceiling; most runs finish in seconds.
export const maxDuration = 120;
// Never cache a cron endpoint.
export const dynamic = "force-dynamic";

// Vercel Cron invokes this with `Authorization: Bearer <CRON_SECRET>`. We also
// accept `?secret=` so it can be fired manually while testing. If CRON_SECRET
// isn't set the endpoint is disabled (fail closed) rather than left open.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // ?dry=1 → triage + queue drafts but send nothing. Lets you preview
    // Sparron's voice and her auto/hold decisions without posting.
    const dry = !!req.nextUrl.searchParams.get("dry");
    const run = await runSparron({ dry });
    console.log(
      `[sparron] scanned ${run.scanned} · sent ${run.sent} · drafted ${run.drafted} · capped ${run.capped} · skipped ${run.skipped} · failed ${run.failed}${dry ? " (dry)" : ""}`,
    );
    return NextResponse.json({ ok: true, dry, ...run });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "sparron run failed";
    console.error("[sparron] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
