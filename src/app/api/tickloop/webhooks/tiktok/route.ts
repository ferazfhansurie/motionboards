import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/tickloop";

function validSignature(raw: string, received: string | null) {
  const secret = process.env.TIKTOK_SHOP_WEBHOOK_SECRET; if (!secret || !received) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return received.length === expected.length && timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const raw = await req.text(); const signature = req.headers.get("authorization");
  if (!validSignature(raw, signature)) return new NextResponse("Invalid signature", { status: 401 });
  const payload = JSON.parse(raw) as { type?: string; event_type?: string; data?: { order_id?: string; shop_id?: string } };
  await logEvent("tiktok_shop", payload.type || payload.event_type || "unknown", payload, payload.data?.order_id || payload.data?.shop_id);
  return NextResponse.json({ received: true });
}
