import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { logEvent, saveOrders, tiktokShopAccess, workspaceForTikTokShop } from "@/lib/tickloop";
import { getOrderDetail } from "@/lib/tiktok-shop";

function validSignature(raw: string, received: string | null) {
  const secret = process.env.TIKTOK_SHOP_WEBHOOK_SECRET; if (!secret || !received) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return received.length === expected.length && timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

type WebhookPayload = {
  type?: string | number;
  event_type?: string;
  shop_id?: string;
  data?: { order_id?: string; order_status?: string; shop_id?: string };
};

export async function POST(req: NextRequest) {
  const raw = await req.text(); const signature = req.headers.get("authorization");
  if (!validSignature(raw, signature)) return new NextResponse("Invalid signature", { status: 401 });
  const payload = JSON.parse(raw) as WebhookPayload;
  const orderId = payload.data?.order_id;
  const shopId = payload.shop_id || payload.data?.shop_id;
  const workspaceId = shopId ? await workspaceForTikTokShop(shopId) : undefined;

  await logEvent("tiktok_shop", String(payload.type || payload.event_type || "unknown"), payload, orderId || shopId, workspaceId);

  // Order status changed — pull the full record so orderId, phone and buyer
  // details are available to automations without another round trip.
  if (orderId && workspaceId) {
    try {
      const access = await tiktokShopAccess(workspaceId);
      if (access.ok) {
        const orders = await getOrderDetail(access.accessToken, access.shopCipher, [orderId]);
        if (orders.length) await saveOrders(workspaceId, access.shopId, orders);
      }
    } catch (error) {
      // Never fail the webhook on a fetch problem — TikTok retries on non-2xx.
      console.error("[tickloop] order hydrate failed", orderId, error);
    }
  }

  return NextResponse.json({ received: true });
}
