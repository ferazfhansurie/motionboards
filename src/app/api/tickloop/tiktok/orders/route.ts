import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listOrders, saveOrders, tiktokShopAccess, workspaceForUser } from "@/lib/tickloop";
import { ORDER_STATUSES, searchAllOrders, type OrderStatus } from "@/lib/tiktok-shop";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_WINDOW_DAYS = 90;

/**
 * GET /api/tickloop/tiktok/orders
 *
 *   ?status=COMPLETED   order status filter (default COMPLETED — a finished purchase)
 *   ?sync=1             pull fresh from TikTok Shop before returning (default: cached rows)
 *   ?days=90            how far back to sync (TikTok caps create_time windows at 90 days)
 *   ?withPhone=1        only return orders whose phone came back unmasked
 *   ?limit=100
 *
 * Returns one row per order with orderId + phone + recipient + items.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const statusParam = (params.get("status") || "COMPLETED").toUpperCase();
  const status = statusParam === "ALL" ? undefined : (statusParam as OrderStatus);
  if (status && !ORDER_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Unknown status "${statusParam}"`, allowed: [...ORDER_STATUSES, "ALL"] }, { status: 400 });
  }

  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  const workspaceId = workspace.id as string;
  const wantsSync = params.get("sync") === "1" || params.get("sync") === "true";

  let sync: Record<string, unknown> | undefined;
  if (wantsSync) {
    const access = await tiktokShopAccess(workspaceId);
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 409 });

    const days = Math.min(Math.max(Number(params.get("days")) || DEFAULT_WINDOW_DAYS, 1), 90);
    const createTimeGe = Math.floor(Date.now() / 1000) - days * 86_400;

    try {
      const { orders, truncated } = await searchAllOrders({ accessToken: access.accessToken, shopCipher: access.shopCipher, status, createTimeGe });
      await saveOrders(workspaceId, access.shopId, orders);
      sync = { fetched: orders.length, windowDays: days, truncated, shopId: access.shopId, shopName: access.shopName };
    } catch (error) {
      return NextResponse.json({ error: "tiktok_api_error", detail: (error as Error).message }, { status: 502 });
    }
  }

  const rows = await listOrders(workspaceId, {
    status,
    withPhoneOnly: params.get("withPhone") === "1",
    limit: Number(params.get("limit")) || 100,
  });

  const orders = rows.map((row) => ({
    orderId: row.order_id,
    status: row.status,
    phone: row.phone,
    phoneE164: row.phone_e164,
    phoneMasked: row.phone_masked,
    recipientName: row.recipient_name,
    buyerEmail: row.buyer_email,
    address: row.address,
    postalCode: row.postal_code,
    regionCode: row.region_code,
    currency: row.currency,
    totalAmount: row.total_amount,
    itemCount: row.item_count,
    trackingNumber: row.tracking_number,
    createTime: row.create_time,
    paidTime: row.paid_time,
    updateTime: row.update_time,
    items: ((row.raw as { line_items?: { product_name?: string; sku_name?: string; sale_price?: string; quantity?: number }[] })?.line_items || []).map((item) => ({
      productName: item.product_name || null,
      skuName: item.sku_name || null,
      salePrice: item.sale_price || null,
      quantity: item.quantity ?? 1,
    })),
  }));

  const maskedCount = orders.filter((order) => order.phoneMasked).length;
  return NextResponse.json({
    status: statusParam,
    count: orders.length,
    contactable: orders.length - maskedCount,
    masked: maskedCount,
    ...(sync ? { sync } : {}),
    orders,
  });
}
