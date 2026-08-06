import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { saveOrders, tiktokShopAccess, workspaceForUser } from "@/lib/tickloop";
import { financeSummary, saveSettlements } from "@/lib/tickloop-finance";
import { fetchSettlements } from "@/lib/tiktok-finance";
import { searchAllOrders } from "@/lib/tiktok-shop";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/tickloop/finance/summary
 *
 *   ?from=2026-07-01   inclusive (default: first day of the current month)
 *   ?to=2026-08-01     exclusive (default: now)
 *   ?sync=1            refresh orders + settlements from TikTok before computing
 *
 * Returns the full P&L. Without ?sync=1 it reads only cached rows, so the page loads
 * fast and a sync is an explicit, visible action.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  const workspaceId = workspace.id as string;
  const params = req.nextUrl.searchParams;

  const now = new Date();
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const from = fromParam ? new Date(fromParam) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = toParam ? new Date(toParam) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  if (from >= to) return NextResponse.json({ error: "from must be before to" }, { status: 400 });

  let sync: Record<string, unknown> | undefined;
  if (params.get("sync") === "1") {
    const access = await tiktokShopAccess(workspaceId);
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 409 });

    // TikTok caps a create_time window at 90 days per call, so clamp the request
    // rather than sending a window it will reject.
    const spanDays = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
    const createTimeGe = Math.floor(Math.max(from.getTime(), to.getTime() - 90 * 86_400_000) / 1000);
    const errors: string[] = [];
    let orderCount = 0;
    let settlementCount = 0;

    try {
      const { orders, truncated } = await searchAllOrders({
        accessToken: access.accessToken,
        shopCipher: access.shopCipher,
        createTimeGe,
        createTimeLt: Math.floor(to.getTime() / 1000),
      }, 5000);
      await saveOrders(workspaceId, access.shopId, orders);
      orderCount = orders.length;
      if (truncated) errors.push("order sync hit the 5000-order safety stop — narrow the date range");
    } catch (error) {
      errors.push(`orders: ${(error as Error).message}`);
    }

    // Settlements are a separate scope; a finance permission failure must not lose
    // the order sync we just completed.
    try {
      const { rows, truncated } = await fetchSettlements({
        accessToken: access.accessToken,
        shopCipher: access.shopCipher,
        statementTimeGe: Math.floor(from.getTime() / 1000),
        statementTimeLt: Math.floor(to.getTime() / 1000) + 30 * 86_400,
      });
      settlementCount = await saveSettlements(workspaceId, rows);
      if (truncated) errors.push("settlement sync hit the 5000-transaction safety stop");
    } catch (error) {
      errors.push(`settlements: ${(error as Error).message}`);
    }

    sync = {
      orders: orderCount,
      settlements: settlementCount,
      shopName: access.shopName,
      clampedTo90Days: spanDays > 90,
      ...(errors.length ? { errors } : {}),
    };
  }

  const summary = await financeSummary(workspaceId, from.toISOString(), to.toISOString());
  return NextResponse.json({ ...summary, ...(sync ? { sync } : {}) });
}
