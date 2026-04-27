import { NextRequest, NextResponse } from "next/server";
import { recordEvent, getUserFromToken } from "@/lib/db";

// In-house event tracking endpoint. Replaces Meta Pixel.
//
// Body: { eventName, anonId?, pathname?, referrer?, properties? }
// We pull the user_id from the session cookie (no need to trust the client),
// and record everything to mb_events. Failures are swallowed — never let
// tracking break the user-facing flow.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const eventName = typeof body?.eventName === "string" ? body.eventName.slice(0, 64) : null;
    if (!eventName) {
      return NextResponse.json({ ok: false, error: "eventName required" }, { status: 400 });
    }

    const token = req.cookies.get("session")?.value;
    const user = token ? await getUserFromToken(token) : null;
    const ua = req.headers.get("user-agent")?.slice(0, 500) || undefined;

    await recordEvent({
      userId: user?.id || null,
      anonId: typeof body?.anonId === "string" ? body.anonId.slice(0, 64) : null,
      eventName,
      pathname: typeof body?.pathname === "string" ? body.pathname.slice(0, 200) : undefined,
      referrer: typeof body?.referrer === "string" ? body.referrer.slice(0, 500) : undefined,
      userAgent: ua,
      properties: body?.properties && typeof body.properties === "object" ? body.properties : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Never let analytics break user flow
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
