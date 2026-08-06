import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { tiktokShopAccess, workspaceForUser } from "@/lib/tickloop";
import { saveSettlements } from "@/lib/tickloop-finance";
import { fetchSettlements, getOrderTransactions } from "@/lib/tiktok-finance";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/tickloop/tiktok/settlements
 *
 *   ?days=90        how far back to pull payout statements (default 90)
 *   ?order=<id>     instead of a window, dump one order's raw finance payload
 *   ?debug=1        include the raw first statement + transaction in the response
 *
 * "Duit Masuk" comes from here. Requires the Finance permission on the TikTok Shop
 * app authorization — if the seller authorized before that scope was added they must
 * re-authorize, and TikTok returns a permission error rather than empty data.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  const workspaceId = workspace.id as string;

  const access = await tiktokShopAccess(workspaceId);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 409 });

  const params = req.nextUrl.searchParams;
  const debug = params.get("debug") === "1";
  const orderId = params.get("order");

  try {
    if (orderId) {
      const data = await getOrderTransactions({ accessToken: access.accessToken, shopCipher: access.shopCipher, orderId });
      return NextResponse.json({ orderId, raw: data });
    }

    const days = Math.min(Math.max(Number(params.get("days")) || 90, 1), 365);
    const statementTimeGe = Math.floor(Date.now() / 1000) - days * 86_400;
    const { rows, statements, sampleTransaction, truncated } = await fetchSettlements({
      accessToken: access.accessToken,
      shopCipher: access.shopCipher,
      statementTimeGe,
    });

    const saved = await saveSettlements(workspaceId, rows);

    return NextResponse.json({
      saved,
      statements: statements.length,
      windowDays: days,
      truncated,
      // TikTok's own identity is settlement = revenue + fee_tax + shipping + adjustment.
      // A drift here means we are reading the payload wrong, so surface it rather than
      // letting a wrong Duit Masuk look authoritative.
      settlementDrift: Number(rows.reduce((sum, row) => sum + row.settlementAmount - (row.revenueAmount + row.feeTaxAmount + row.shippingCostAmount + row.adjustmentAmount), 0).toFixed(2)),
      adFeeTotal: Number(rows.reduce((sum, row) => sum + row.adFeeAmount, 0).toFixed(2)),
      ...(debug ? { sampleStatement: statements[0] ?? null, sampleTransaction } : {}),
    });
  } catch (error) {
    return NextResponse.json({ error: "tiktok_finance_error", detail: (error as Error).message }, { status: 502 });
  }
}
