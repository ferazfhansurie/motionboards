import { NextRequest, NextResponse } from "next/server";
import { runDiscoveryReply } from "@/lib/threads-discovery";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && (req.headers.get("authorization") === `Bearer ${secret}` || req.nextUrl.searchParams.get("secret") === secret);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runDiscoveryReply(req.nextUrl.searchParams.get("dry") === "1");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery reply failed";
    console.error("[threads-discovery-reply]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
