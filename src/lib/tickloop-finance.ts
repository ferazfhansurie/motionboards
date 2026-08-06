import { neon } from "@neondatabase/serverless";
import { ensureTickLoopSchema } from "./tickloop";
import { lineLabel, type BreakdownLine, type LineGroup, type SettlementRow } from "./tiktok-finance";
import type { TikTokOrder } from "./tiktok-shop";

type Row = Record<string, unknown>;
type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;
const sql: Sql = (strings, ...values) => neon(process.env.DATABASE_URL!)(strings, ...values) as Promise<Row[]>;

/**
 * The financial dashboard. The seller's spreadsheet defines which variables must
 * appear; the values come from TikTok Shop's own finance model wherever TikTok
 * exposes them, so the dashboard reconciles against Seller Center rather than
 * approximating it.
 *
 *   TikTok Orders API    -> Total Sales, per-bundle quantities
 *   TikTok Finance API   -> settlement, and every fee/tax/shipping line behind it,
 *                           including GMV Max ad spend
 *   Seller-entered       -> product cost per bundle, card-billed ad spend, WHT rate
 *
 * Only two things stay manual, and both are genuinely outside TikTok Shop: what a
 * bundle costs to make, and ad spend billed to a credit card in TikTok Ads Manager
 * (a different API surface with its own OAuth app).
 */

let financeSchemaReady = false;
export async function ensureFinanceSchema() {
  if (financeSchemaReady) return;
  await ensureTickLoopSchema();
  await sql`CREATE TABLE IF NOT EXISTS tl_settlements (
    workspace_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    transaction_type TEXT,
    currency TEXT,
    settlement_amount NUMERIC NOT NULL DEFAULT 0,
    revenue_amount NUMERIC NOT NULL DEFAULT 0,
    fee_tax_amount NUMERIC NOT NULL DEFAULT 0,
    shipping_cost_amount NUMERIC NOT NULL DEFAULT 0,
    adjustment_amount NUMERIC NOT NULL DEFAULT 0,
    reserve_amount NUMERIC NOT NULL DEFAULT 0,
    customer_payment_amount NUMERIC NOT NULL DEFAULT 0,
    ad_fee_amount NUMERIC NOT NULL DEFAULT 0,
    breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    statement_id TEXT,
    statement_time TIMESTAMPTZ,
    order_create_time TIMESTAMPTZ,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, transaction_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS tl_settlements_time_idx ON tl_settlements(workspace_id, statement_time DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS tl_settlements_order_idx ON tl_settlements(workspace_id, order_id)`;

  // One row per sellable SKU: which bundle it belongs to, what it costs us, and how
  // many bottles it contains (trial sachets contain zero — that is the "Unit ME" count).
  await sql`CREATE TABLE IF NOT EXISTS tl_product_costs (
    workspace_id TEXT NOT NULL,
    sku_key TEXT NOT NULL,
    bundle TEXT NOT NULL,
    unit_cost NUMERIC NOT NULL DEFAULT 0,
    bottles NUMERIC NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, sku_key)
  )`;

  // Month-scoped costs that TikTok Shop genuinely cannot tell us.
  await sql`CREATE TABLE IF NOT EXISTS tl_period_costs (
    workspace_id TEXT NOT NULL,
    period TEXT NOT NULL,
    ads_card NUMERIC NOT NULL DEFAULT 0,
    ad_credit NUMERIC NOT NULL DEFAULT 0,
    wht_rate NUMERIC NOT NULL DEFAULT 0.10,
    other_cost NUMERIC NOT NULL DEFAULT 0,
    ads_gmv_pay_override NUMERIC,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, period)
  )`;
  // Earlier revisions stored GMV Pay as a plain manual column; it is synced now.
  await sql`ALTER TABLE tl_period_costs ADD COLUMN IF NOT EXISTS ads_gmv_pay_override NUMERIC`;
  await sql`ALTER TABLE tl_period_costs DROP COLUMN IF EXISTS ads_gmv_pay`;
  financeSchemaReady = true;
}

/* --------------------------------------------------------------- settlements */

export async function saveSettlements(workspaceId: string, rows: SettlementRow[]) {
  await ensureFinanceSchema();
  for (const row of rows) {
    await sql`INSERT INTO tl_settlements (workspace_id, transaction_id, order_id, transaction_type, currency, settlement_amount, revenue_amount, fee_tax_amount, shipping_cost_amount, adjustment_amount, reserve_amount, customer_payment_amount, ad_fee_amount, breakdown, statement_id, statement_time, order_create_time, raw, synced_at)
      VALUES (${workspaceId}, ${row.transactionId}, ${row.orderId}, ${row.type}, ${row.currency}, ${row.settlementAmount}, ${row.revenueAmount}, ${row.feeTaxAmount}, ${row.shippingCostAmount}, ${row.adjustmentAmount}, ${row.reserveAmount}, ${row.customerPaymentAmount}, ${row.adFeeAmount}, ${JSON.stringify(row.breakdown)}::jsonb, ${row.statementId}, ${row.statementTime}, ${row.orderCreateTime}, ${JSON.stringify(row.raw)}::jsonb, NOW())
      ON CONFLICT (workspace_id, transaction_id) DO UPDATE SET order_id = EXCLUDED.order_id, transaction_type = EXCLUDED.transaction_type, currency = EXCLUDED.currency, settlement_amount = EXCLUDED.settlement_amount, revenue_amount = EXCLUDED.revenue_amount, fee_tax_amount = EXCLUDED.fee_tax_amount, shipping_cost_amount = EXCLUDED.shipping_cost_amount, adjustment_amount = EXCLUDED.adjustment_amount, reserve_amount = EXCLUDED.reserve_amount, customer_payment_amount = EXCLUDED.customer_payment_amount, ad_fee_amount = EXCLUDED.ad_fee_amount, breakdown = EXCLUDED.breakdown, statement_id = EXCLUDED.statement_id, statement_time = EXCLUDED.statement_time, order_create_time = EXCLUDED.order_create_time, raw = EXCLUDED.raw, synced_at = NOW()`;
  }
  return rows.length;
}

/* -------------------------------------------------------------- cost config */

export type ProductCost = { skuKey: string; bundle: string; unitCost: number; bottles: number; sortOrder: number };

export async function listProductCosts(workspaceId: string): Promise<ProductCost[]> {
  await ensureFinanceSchema();
  const rows = await sql`SELECT sku_key, bundle, unit_cost, bottles, sort_order FROM tl_product_costs WHERE workspace_id = ${workspaceId} ORDER BY sort_order, bundle`;
  return rows.map((row) => ({
    skuKey: row.sku_key as string,
    bundle: row.bundle as string,
    unitCost: Number(row.unit_cost),
    bottles: Number(row.bottles),
    sortOrder: Number(row.sort_order),
  }));
}

export async function saveProductCosts(workspaceId: string, costs: ProductCost[]) {
  await ensureFinanceSchema();
  for (const cost of costs) {
    await sql`INSERT INTO tl_product_costs (workspace_id, sku_key, bundle, unit_cost, bottles, sort_order, updated_at)
      VALUES (${workspaceId}, ${cost.skuKey}, ${cost.bundle}, ${cost.unitCost}, ${cost.bottles}, ${cost.sortOrder}, NOW())
      ON CONFLICT (workspace_id, sku_key) DO UPDATE SET bundle = EXCLUDED.bundle, unit_cost = EXCLUDED.unit_cost, bottles = EXCLUDED.bottles, sort_order = EXCLUDED.sort_order, updated_at = NOW()`;
  }
}

export async function deleteProductCost(workspaceId: string, skuKey: string) {
  await ensureFinanceSchema();
  await sql`DELETE FROM tl_product_costs WHERE workspace_id = ${workspaceId} AND sku_key = ${skuKey}`;
}

export type PeriodCost = { period: string; adsCard: number; adCredit: number; whtRate: number; otherCost: number; adsGmvPayOverride: number | null; notes: string | null };

const DEFAULT_WHT_RATE = 0.1;

function toPeriodCost(row: Row): PeriodCost {
  return {
    period: row.period as string,
    adsCard: Number(row.ads_card),
    adCredit: Number(row.ad_credit),
    whtRate: Number(row.wht_rate),
    otherCost: Number(row.other_cost),
    adsGmvPayOverride: row.ads_gmv_pay_override === null || row.ads_gmv_pay_override === undefined ? null : Number(row.ads_gmv_pay_override),
    notes: (row.notes as string) || null,
  };
}

export async function listPeriodCosts(workspaceId: string): Promise<PeriodCost[]> {
  await ensureFinanceSchema();
  const rows = await sql`SELECT period, ads_card, ad_credit, wht_rate, other_cost, ads_gmv_pay_override, notes FROM tl_period_costs WHERE workspace_id = ${workspaceId} ORDER BY period DESC`;
  return rows.map(toPeriodCost);
}

export async function savePeriodCost(workspaceId: string, cost: PeriodCost) {
  await ensureFinanceSchema();
  await sql`INSERT INTO tl_period_costs (workspace_id, period, ads_card, ad_credit, wht_rate, other_cost, ads_gmv_pay_override, notes, updated_at)
    VALUES (${workspaceId}, ${cost.period}, ${cost.adsCard}, ${cost.adCredit}, ${cost.whtRate}, ${cost.otherCost}, ${cost.adsGmvPayOverride}, ${cost.notes}, NOW())
    ON CONFLICT (workspace_id, period) DO UPDATE SET ads_card = EXCLUDED.ads_card, ad_credit = EXCLUDED.ad_credit, wht_rate = EXCLUDED.wht_rate, other_cost = EXCLUDED.other_cost, ads_gmv_pay_override = EXCLUDED.ads_gmv_pay_override, notes = EXCLUDED.notes, updated_at = NOW()`;
}

/* ------------------------------------------------------------------ the P&L */

/** Order statuses that represent a sale we recognise. CANCELLED never counts. */
const REVENUE_STATUSES = new Set(["AWAITING_SHIPMENT", "AWAITING_COLLECTION", "IN_TRANSIT", "DELIVERED", "COMPLETED", "PARTIALLY_SHIPPING"]);

export type BundleLine = { skuKey: string; bundle: string; quantity: number; unitCost: number; bottles: number; totalCost: number; matched: boolean };
export type SummaryLine = { key: string; label: string; group: LineGroup; amount: number };

export type FinanceSummary = {
  from: string;
  to: string;
  currency: string;
  orderCount: number;

  /* --- what TikTok Shop reports --- */
  /** "Total Sales (Order Amount)" — buyer-paid total from the Orders API. */
  totalSales: number;
  /** The same figure as TikTok's finance view sees it. Diverges from totalSales when orders are partly refunded. */
  customerPayment: number;
  /** "Duit Masuk (Total settlement)" — what TikTok actually paid out. */
  duitMasuk: number;
  /** Settlement components, all signed as TikTok sends them (deductions negative). */
  revenueAmount: number;
  feeTaxAmount: number;
  shippingCostAmount: number;
  adjustmentAmount: number;
  reserveAmount: number;
  /** Every non-zero fee/tax/shipping/revenue line, aggregated and labelled. */
  lines: SummaryLine[];
  /** settlement − (revenue + fee_tax + shipping + adjustment). Should be ~0. */
  settlementDrift: number;
  /** Distinct orders in the window that have settled. */
  settledOrders: number;
  /** Transaction rows behind those orders — higher when refunds/adjustments exist. */
  settledTransactions: number;

  /* --- seller-side costs --- */
  /** "Kos Produk" */
  kosProduk: number;
  /** "Kos Ads By Card" — manual, from Ads Manager billing. */
  adsCard: number;
  /** "Kos Ads By GMV Pay" — synced from TikTok's GMV Max / affiliate ads fees, positive magnitude. */
  adsGmvPay: number;
  adsGmvPayIsOverride: boolean;
  /** "Ad Credit" — informational; the sheet does not net it off profit. */
  adCredit: number;
  otherCost: number;
  whtRate: number;
  /** "WHT 10% (To Pay)" = rate x (card + GMV pay) */
  wht: number;

  /* --- results --- */
  nettProfit: number;
  profitPercentage: number;
  /** Margin against money actually received, which is the harsher and more useful number. */
  marginOnSettlement: number;

  totalQuantity: number;
  /** "UNIT ME" — bottles moved, excluding trial sachets. */
  unitMe: number;
  bundles: BundleLine[];
  unmappedSkus: { skuKey: string; quantity: number }[];
  periods: string[];
};

function skuKeyFor(item: { seller_sku?: string; sku_id?: string; sku_name?: string; product_name?: string }) {
  return (item.seller_sku || item.sku_id || item.sku_name || item.product_name || "unknown").trim();
}

function monthsBetween(from: Date, to: Date) {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

/**
 * Builds the whole dashboard for a date range.
 *
 *   Kos Produk  = SUM(quantity x unit cost)
 *   Unit ME     = SUM(quantity x bottles)
 *   WHT         = rate x (ads by card + ads by GMV pay)
 *   Nett Profit = Duit Masuk - Kos Produk - Ads By Card - WHT - Other
 *   Profit %    = Nett Profit / Total Sales
 *
 * Ads By GMV Pay is deliberately NOT subtracted again: TikTok charges it as a fee
 * inside the settlement, so it is already absent from Duit Masuk. Subtracting it
 * here would double-count it. It still drives WHT, which the seller pays separately.
 */
export async function financeSummary(workspaceId: string, fromIso: string, toIso: string): Promise<FinanceSummary> {
  await ensureFinanceSchema();

  const orders = await sql`SELECT order_id, status, currency, total_amount, raw FROM tl_orders
    WHERE workspace_id = ${workspaceId} AND create_time >= ${fromIso} AND create_time < ${toIso}`;

  const counted = orders.filter((order) => REVENUE_STATUSES.has(String(order.status).toUpperCase()));
  const orderIds = counted.map((order) => order.order_id as string);

  const settlements = orderIds.length
    ? await sql`SELECT order_id, settlement_amount, revenue_amount, fee_tax_amount, shipping_cost_amount, adjustment_amount, reserve_amount, customer_payment_amount, ad_fee_amount, breakdown, currency
        FROM tl_settlements WHERE workspace_id = ${workspaceId} AND order_id = ANY(${orderIds})`
    : [];

  const costs = await listProductCosts(workspaceId);
  const costBySku = new Map(costs.map((cost) => [cost.skuKey, cost]));

  const quantityBySku = new Map<string, number>();
  let totalSales = 0;
  let currency = "MYR";

  for (const order of counted) {
    totalSales += Number(order.total_amount) || 0;
    if (order.currency) currency = order.currency as string;
    for (const item of (order.raw as TikTokOrder)?.line_items || []) {
      // The 202309 order payload emits one line_item per unit, so a missing
      // `quantity` means exactly one unit — not an unknown amount.
      const quantity = Number((item as { quantity?: number }).quantity ?? 1) || 1;
      const key = skuKeyFor(item);
      quantityBySku.set(key, (quantityBySku.get(key) || 0) + quantity);
    }
  }

  /* ---- bundles, product cost, Unit ME ---- */
  const unmappedSkus: { skuKey: string; quantity: number }[] = [];
  const byBundle = new Map<string, BundleLine>();
  let kosProduk = 0;
  let totalQuantity = 0;
  let unitMe = 0;

  for (const [skuKey, quantity] of quantityBySku) {
    totalQuantity += quantity;
    const cost = costBySku.get(skuKey);
    if (!cost) {
      unmappedSkus.push({ skuKey, quantity });
      const line = byBundle.get(skuKey) || { skuKey, bundle: skuKey, quantity: 0, unitCost: 0, bottles: 0, totalCost: 0, matched: false };
      line.quantity += quantity;
      byBundle.set(skuKey, line);
      continue;
    }
    kosProduk += quantity * cost.unitCost;
    unitMe += quantity * cost.bottles;
    const line = byBundle.get(cost.bundle) || { skuKey: cost.skuKey, bundle: cost.bundle, quantity: 0, unitCost: cost.unitCost, bottles: cost.bottles, totalCost: 0, matched: true };
    line.quantity += quantity;
    line.totalCost += quantity * cost.unitCost;
    byBundle.set(cost.bundle, line);
  }
  const bundleOrder = new Map(costs.map((cost) => [cost.bundle, cost.sortOrder]));
  const bundles = [...byBundle.values()].sort((a, b) => (bundleOrder.get(a.bundle) ?? 999) - (bundleOrder.get(b.bundle) ?? 999));

  /* ---- settlement and its breakdown ---- */
  const totals = { settlement: 0, revenue: 0, feeTax: 0, shipping: 0, adjustment: 0, reserve: 0, customerPayment: 0, adFee: 0 };
  const lineTotals = new Map<string, SummaryLine>();
  // An order can have several transactions (the sale, then a refund adjustment), so
  // "settled" counts distinct orders rather than rows.
  const settledOrderIds = new Set<string>();

  for (const row of settlements) {
    settledOrderIds.add(row.order_id as string);
    totals.settlement += Number(row.settlement_amount) || 0;
    totals.revenue += Number(row.revenue_amount) || 0;
    totals.feeTax += Number(row.fee_tax_amount) || 0;
    totals.shipping += Number(row.shipping_cost_amount) || 0;
    totals.adjustment += Number(row.adjustment_amount) || 0;
    totals.reserve += Number(row.reserve_amount) || 0;
    totals.customerPayment += Number(row.customer_payment_amount) || 0;
    totals.adFee += Number(row.ad_fee_amount) || 0;
    if (row.currency) currency = row.currency as string;

    for (const line of (row.breakdown as BreakdownLine[]) || []) {
      const id = `${line.group}:${line.key}`;
      const existing = lineTotals.get(id);
      if (existing) existing.amount += line.amount;
      else lineTotals.set(id, { key: line.key, label: lineLabel(line.key), group: line.group, amount: line.amount });
    }
  }

  const groupRank: Record<LineGroup, number> = { revenue: 0, fee: 1, tax: 2, shipping: 3, adjustment: 4 };
  const lines = [...lineTotals.values()].sort((a, b) => groupRank[a.group] - groupRank[b.group] || Math.abs(b.amount) - Math.abs(a.amount));

  /* ---- manual costs ---- */
  const periods = monthsBetween(new Date(fromIso), new Date(toIso));
  const periodRows = periods.length
    ? await sql`SELECT period, ads_card, ad_credit, wht_rate, other_cost, ads_gmv_pay_override, notes FROM tl_period_costs WHERE workspace_id = ${workspaceId} AND period = ANY(${periods})`
    : [];
  const periodCosts = periodRows.map(toPeriodCost);

  const adsCard = periodCosts.reduce((sum, cost) => sum + cost.adsCard, 0);
  const adCredit = periodCosts.reduce((sum, cost) => sum + cost.adCredit, 0);
  const otherCost = periodCosts.reduce((sum, cost) => sum + cost.otherCost, 0);
  const whtRate = periodCosts.length ? periodCosts[0].whtRate : DEFAULT_WHT_RATE;

  // GMV Pay is synced from TikTok's ad fees. An override exists because a seller
  // reconciling against an invoice must be able to win an argument with the API.
  const overrides = periodCosts.filter((cost) => cost.adsGmvPayOverride !== null);
  const adsGmvPayIsOverride = overrides.length > 0;
  const adsGmvPay = adsGmvPayIsOverride
    ? overrides.reduce((sum, cost) => sum + (cost.adsGmvPayOverride || 0), 0)
    : Math.abs(totals.adFee);

  const wht = whtRate * (adsCard + adsGmvPay);
  const duitMasuk = totals.settlement;
  const nettProfit = duitMasuk - kosProduk - adsCard - wht - otherCost;

  // TikTok's own identity: settlement = revenue + fee_tax + shipping + adjustment.
  const settlementDrift = totals.settlement - (totals.revenue + totals.feeTax + totals.shipping + totals.adjustment);

  return {
    from: fromIso,
    to: toIso,
    currency,
    orderCount: counted.length,
    totalSales,
    customerPayment: totals.customerPayment,
    duitMasuk,
    revenueAmount: totals.revenue,
    feeTaxAmount: totals.feeTax,
    shippingCostAmount: totals.shipping,
    adjustmentAmount: totals.adjustment,
    reserveAmount: totals.reserve,
    lines,
    settlementDrift,
    settledOrders: settledOrderIds.size,
    settledTransactions: settlements.length,
    kosProduk,
    adsCard,
    adsGmvPay,
    adsGmvPayIsOverride,
    adCredit,
    otherCost,
    whtRate,
    wht,
    nettProfit,
    profitPercentage: totalSales > 0 ? nettProfit / totalSales : 0,
    marginOnSettlement: duitMasuk > 0 ? nettProfit / duitMasuk : 0,
    totalQuantity,
    unitMe,
    bundles,
    unmappedSkus: unmappedSkus.sort((a, b) => b.quantity - a.quantity),
    periods,
  };
}

/** Every SKU seen in synced orders — powers the cost-mapping UI so the seller never types a SKU by hand. */
export async function discoverSkus(workspaceId: string) {
  await ensureFinanceSchema();
  const rows = await sql`SELECT raw FROM tl_orders WHERE workspace_id = ${workspaceId}`;
  const seen = new Map<string, { skuKey: string; productName: string | null; skuName: string | null; quantity: number }>();
  for (const row of rows) {
    for (const item of (row.raw as TikTokOrder)?.line_items || []) {
      const key = skuKeyFor(item);
      const entry = seen.get(key) || { skuKey: key, productName: item.product_name || null, skuName: item.sku_name || null, quantity: 0 };
      entry.quantity += Number((item as { quantity?: number }).quantity ?? 1) || 1;
      seen.set(key, entry);
    }
  }
  return [...seen.values()].sort((a, b) => b.quantity - a.quantity);
}
