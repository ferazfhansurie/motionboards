import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { workspaceForUser } from "@/lib/tickloop";
import { deleteProductCost, discoverSkus, listPeriodCosts, listProductCosts, savePeriodCost, saveProductCosts, type PeriodCost, type ProductCost } from "@/lib/tickloop-finance";

export const dynamic = "force-dynamic";

/** The cost inputs TikTok Shop cannot supply: product cost per bundle, and monthly ad spend. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  const workspaceId = workspace.id as string;

  const [products, periods, skus] = await Promise.all([
    listProductCosts(workspaceId),
    listPeriodCosts(workspaceId),
    discoverSkus(workspaceId),
  ]);
  return NextResponse.json({ products, periods, skus });
}

type Payload = {
  products?: (Partial<ProductCost> & { skuKey: string })[];
  period?: Omit<Partial<PeriodCost>, "adsGmvPayOverride"> & { period: string; adsGmvPayOverride?: number | string | null };
  deleteSkuKey?: string;
};

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  const workspaceId = workspace.id as string;

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (payload.deleteSkuKey) await deleteProductCost(workspaceId, payload.deleteSkuKey);

  if (payload.products?.length) {
    const invalid = payload.products.find((product) => !product.skuKey || !product.bundle);
    if (invalid) return NextResponse.json({ error: "each product needs skuKey and bundle" }, { status: 400 });
    await saveProductCosts(
      workspaceId,
      payload.products.map((product, index) => ({
        skuKey: product.skuKey,
        bundle: product.bundle as string,
        unitCost: Number(product.unitCost) || 0,
        bottles: Number(product.bottles) || 0,
        sortOrder: Number.isFinite(Number(product.sortOrder)) ? Number(product.sortOrder) : index,
      })),
    );
  }

  if (payload.period?.period) {
    if (!/^\d{4}-\d{2}$/.test(payload.period.period)) return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 });
    const override = payload.period.adsGmvPayOverride;
    await savePeriodCost(workspaceId, {
      period: payload.period.period,
      adsCard: Number(payload.period.adsCard) || 0,
      adCredit: Number(payload.period.adCredit) || 0,
      whtRate: Number.isFinite(Number(payload.period.whtRate)) ? Number(payload.period.whtRate) : 0.1,
      otherCost: Number(payload.period.otherCost) || 0,
      // null means "trust the synced GMV Max ad fee" — distinct from an override of 0.
      adsGmvPayOverride: override === null || override === undefined || override === "" ? null : Number(override) || 0,
      notes: payload.period.notes ?? null,
    });
  }

  const [products, periods] = await Promise.all([listProductCosts(workspaceId), listPeriodCosts(workspaceId)]);
  return NextResponse.json({ products, periods });
}
