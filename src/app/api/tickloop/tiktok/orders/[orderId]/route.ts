import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { orderById, saveOrders, tiktokShopAccess, workspaceForUser } from "@/lib/tickloop";
import { getOrderDetail } from "@/lib/tiktok-shop";

export const dynamic = "force-dynamic";

/** GET /api/tickloop/tiktok/orders/<orderId> — full details for one order, refreshed on demand. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { orderId } = await params;
  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  const workspaceId = workspace.id as string;

  if (req.nextUrl.searchParams.get("sync") !== "0") {
    const access = await tiktokShopAccess(workspaceId);
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 409 });
    try {
      const orders = await getOrderDetail(access.accessToken, access.shopCipher, [orderId]);
      if (orders.length) await saveOrders(workspaceId, access.shopId, orders);
    } catch (error) {
      return NextResponse.json({ error: "tiktok_api_error", detail: (error as Error).message }, { status: 502 });
    }
  }

  const row = await orderById(workspaceId, orderId);
  if (!row) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  return NextResponse.json({ order: row });
}
