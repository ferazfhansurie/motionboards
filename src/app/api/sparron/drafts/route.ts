import { NextRequest, NextResponse } from "next/server";
import { listPendingDrafts, resolveDraft } from "@/lib/sparron";

export const dynamic = "force-dynamic";

// Same shared-secret gate as the cron route. This is the approval queue for
// the drafts Sparron held (hybrid/draft mode, capped threads, failed sends).
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
}

// GET  → list pending drafts.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const drafts = await listPendingDrafts();
    return NextResponse.json({ ok: true, count: drafts.length, drafts });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "failed to list drafts";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST { id, action: "approve" | "reject", text? } → send or discard a draft.
// `text` optionally overrides the body before sending (your edit wins).
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as { id?: string; action?: string; text?: string };
    if (!body.id || (body.action !== "approve" && body.action !== "reject")) {
      return NextResponse.json({ ok: false, error: "Provide { id, action: 'approve'|'reject', text? }" }, { status: 400 });
    }
    const result = await resolveDraft(body.id, body.action, body.text);
    return NextResponse.json({ ...result }, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "failed to resolve draft";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
