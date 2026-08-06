import { tiktokApi } from "./tiktok-shop";

/**
 * TikTok Shop Finance API (v202501).
 *
 * This is where the real money numbers live. An order's `payment.total_amount` is
 * what the BUYER paid; what lands in the seller wallet is the settlement amount:
 *
 *   settlement = revenue + fee_tax + shipping_cost + adjustment
 *
 * where fee_tax and shipping_cost arrive as NEGATIVE amounts (they are deductions).
 * Every one of those four has a documented breakdown, and this module keeps the
 * breakdown intact instead of collapsing it to a single "fees" number — a seller
 * needs to see that the 6% referral fee and the GMV Max ad fee are different things.
 *
 * Notably `fee.gmv_max_ad_fee_amount` means GMV Max ad spend is a synced number,
 * not something the seller has to copy out of Ads Manager by hand.
 */

/* ------------------------------------------------------------ line registry */

export type LineGroup = "revenue" | "fee" | "tax" | "shipping" | "adjustment";

/**
 * Human labels for the breakdown keys TikTok can return. Anything TikTok sends that
 * is missing here still gets aggregated and displayed — it falls back to a
 * de-snake-cased label — so a new fee type shows up rather than vanishing.
 */
export const LINE_LABELS: Record<string, string> = {
  // revenue_breakdown
  subtotal_before_discount_amount: "Subtotal before discount",
  seller_discount_amount: "Seller discount",
  seller_discount_refund_amount: "Seller discount refunded",
  refund_subtotal_before_discount_amount: "Refunded subtotal",
  cod_service_fee_amount: "COD service fee",
  refund_cod_service_fee_amount: "COD service fee refunded",
  distant_item_fee_amount: "Distant item fee",
  // fee_tax_breakdown.fee
  platform_commission_amount: "TikTok Shop commission",
  referral_fee_amount: "Referral fee",
  transaction_fee_amount: "Transaction fee",
  affiliate_commission_amount: "Affiliate commission",
  affiliate_ads_commission_amount: "Affiliate ads commission",
  affiliate_partner_commission_amount: "Affiliate partner commission",
  affiliate_commission_amount_before_pit: "Affiliate commission (before PIT)",
  gmv_max_ad_fee_amount: "GMV Max ad fee",
  tap_shop_ads_commission: "Tap Shop ads commission",
  external_affiliate_marketing_fee_amount: "External affiliate marketing fee",
  sfp_service_fee_amount: "Shipping fee promotion (SFP) service fee",
  mall_service_fee_amount: "Mall service fee",
  live_specials_fee_amount: "Live specials fee",
  flash_sales_service_fee_amount: "Flash sales service fee",
  voucher_xtra_service_fee_amount: "Voucher Xtra service fee",
  smart_promotion_fee_amount: "Smart promotion fee",
  bonus_cashback_service_fee_amount: "Bonus cashback service fee",
  cofunded_promotion_service_fee_amount: "Co-funded promotion service fee",
  cofunded_creator_bonus_amount: "Co-funded creator bonus",
  credit_card_handling_fee_amount: "Credit card handling fee",
  seller_paylater_handling_fee_amount: "PayLater handling fee",
  dt_handling_fee_amount: "Handling fee",
  refund_administration_fee_amount: "Refund administration fee",
  fee_per_item_sold_amount: "Fee per item sold",
  dynamic_commission_amount: "Dynamic commission",
  platform_special_service_fee_amount: "Platform special service fee",
  pre_order_service_fee_amount: "Pre-order service fee",
  shipping_fee_guarantee_service_fee: "Shipping fee guarantee service fee",
  installation_service_fee: "Installation service fee",
  tsp_commission_amount: "TSP commission",
  // fee_tax_breakdown.tax
  sst_amount: "SST",
  vat_amount: "VAT",
  gst_amount: "GST",
  import_vat_amount: "Import VAT",
  customs_duty_amount: "Customs duty",
  customs_clearance_amount: "Customs clearance",
  sales_tax_referral_fee_amount: "Sales tax on referral fee",
  pit_amount: "PIT",
  // shipping_cost_breakdown
  actual_shipping_fee_amount: "Actual shipping fee",
  customer_paid_shipping_fee_amount: "Customer paid shipping",
  shipping_fee_discount_amount: "Shipping fee discount",
  shipping_insurance_fee_amount: "Shipping insurance",
  return_shipping_fee_amount: "Return shipping fee",
  return_shipping_fee_paid_buyer_amount: "Return shipping paid by buyer",
  return_shipping_label_fee_amount: "Return shipping label fee",
  exchange_shipping_fee_amount: "Exchange shipping fee",
  replacement_shipping_fee_amount: "Replacement shipping fee",
  signature_confirmation_fee_amount: "Signature confirmation fee",
  failed_delivery_subsidy_amount: "Failed delivery subsidy",
  free_return_subsidy_amount: "Free return subsidy",
  seller_self_shipping_service_fee_amount: "Self-shipping service fee",
  shipping_fee_subsidy_amount: "Shipping fee subsidy",
  platform_shipping_fee_discount_amount: "Platform shipping fee discount",
  seller_shipping_fee_discount_amount: "Seller shipping fee discount",
  customer_shipping_fee_offset_amount: "Customer shipping fee offset",
  promo_shipping_incentive_amount: "Promo shipping incentive",
  fbt_shipping_cost_amount: "Fulfilled by TikTok shipping cost",
  fbt_fulfillment_fee_amount: "Fulfilled by TikTok fulfillment fee",
  fbm_shipping_cost_amount: "Fulfilled by merchant shipping cost",
};

/** Fee keys that are advertising spend TikTok billed against GMV. Drives the "Kos Ads By GMV Pay" line. */
export const AD_FEE_KEYS = ["gmv_max_ad_fee_amount", "affiliate_ads_commission_amount", "tap_shop_ads_commission", "external_affiliate_marketing_fee_amount"] as const;

export function lineLabel(key: string) {
  return LINE_LABELS[key] || key.replace(/_amount$/, "").replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

/* ------------------------------------------------------------------- types */

type AmountMap = Record<string, unknown>;

export type FinanceStatement = {
  id?: string;
  payment_id?: string;
  payment_status?: string;
  statement_time?: number;
  currency?: string;
  settlement_amount?: string;
  revenue_amount?: string;
  fee_amount?: string;
  shipping_cost_amount?: string;
  adjustment_amount?: string;
  net_sales_amount?: string;
};

export type FinanceTransaction = {
  id?: string;
  type?: string;
  order_id?: string;
  order_create_time?: number;
  adjustment_id?: string;
  adjustment_order_id?: string;
  associated_order_id?: string;
  currency?: string;
  settlement_amount?: string;
  revenue_amount?: string;
  fee_tax_amount?: string;
  shipping_cost_amount?: string;
  adjustment_amount?: string;
  reserve_amount?: string;
  statement_id?: string;
  statement_time?: number;
  revenue_breakdown?: AmountMap;
  fee_tax_breakdown?: { fee?: AmountMap; tax?: AmountMap };
  shipping_cost_breakdown?: AmountMap & { supplementary_component?: AmountMap };
  supplementary_component?: AmountMap;
  [key: string]: unknown;
};

/** A flat, signed, per-key breakdown line. Signs are exactly as TikTok sent them. */
export type BreakdownLine = { key: string; group: LineGroup; amount: number };

export type SettlementRow = {
  /** Unique per transaction. An order can have several (the sale, then a refund adjustment). */
  transactionId: string;
  orderId: string;
  /** "ORDER" | "ADJUSTMENT" | ... — adjustments carry no order of their own. */
  type: string | null;
  currency: string | null;
  /** Money that actually reaches the wallet for this transaction. */
  settlementAmount: number;
  revenueAmount: number;
  /** Negative: platform commission, affiliate commission, transaction fee, ad fees, taxes. */
  feeTaxAmount: number;
  /** Negative when the seller bears shipping. */
  shippingCostAmount: number;
  adjustmentAmount: number;
  reserveAmount: number;
  /** What the buyer actually paid, per TikTok's own finance view. */
  customerPaymentAmount: number;
  /** Ad spend TikTok billed against this order's GMV (GMV Max + affiliate ads). Negative. */
  adFeeAmount: number;
  breakdown: BreakdownLine[];
  statementId: string | null;
  statementTime: string | null;
  orderCreateTime: string | null;
  raw: FinanceTransaction;
};

/* -------------------------------------------------------------- normalising */

function num(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Flattens one breakdown object into signed lines, dropping zeroes and nested containers. */
function flatten(source: AmountMap | undefined, group: LineGroup, into: BreakdownLine[]) {
  if (!source) return;
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object") {
      // `supplementary_component` nests one level deeper.
      flatten(value as AmountMap, group, into);
      continue;
    }
    const amount = num(value);
    if (amount === 0) continue;
    const existing = into.find((line) => line.key === key && line.group === group);
    if (existing) existing.amount += amount;
    else into.push({ key, group, amount });
  }
}

function epochToIso(seconds: unknown) {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}

export function normalizeTransaction(transaction: FinanceTransaction, statement?: FinanceStatement): SettlementRow | null {
  // Adjustments (chargebacks, manual corrections) may reference the order they
  // belong to rather than carrying one, and some carry no order at all.
  const orderId = transaction.order_id || transaction.adjustment_order_id || transaction.associated_order_id || transaction.adjustment_id || transaction.id;
  if (!orderId) return null;

  const breakdown: BreakdownLine[] = [];
  flatten(transaction.revenue_breakdown, "revenue", breakdown);
  flatten(transaction.fee_tax_breakdown?.fee, "fee", breakdown);
  flatten(transaction.fee_tax_breakdown?.tax, "tax", breakdown);
  flatten(transaction.shipping_cost_breakdown, "shipping", breakdown);

  const adFeeAmount = breakdown
    .filter((line) => line.group === "fee" && (AD_FEE_KEYS as readonly string[]).includes(line.key))
    .reduce((sum, line) => sum + line.amount, 0);

  return {
    // A single order yields several transactions over its life (the sale, then any
    // refund adjustment), so the transaction id is what must be unique — keying on
    // order_id would let a refund overwrite the sale it refunds.
    transactionId: String(transaction.id || transaction.adjustment_id || `${orderId}:${transaction.type || "txn"}`),
    orderId: String(orderId),
    type: transaction.type || null,
    currency: transaction.currency || statement?.currency || null,
    settlementAmount: num(transaction.settlement_amount),
    revenueAmount: num(transaction.revenue_amount),
    feeTaxAmount: num(transaction.fee_tax_amount),
    shippingCostAmount: num(transaction.shipping_cost_amount),
    adjustmentAmount: num(transaction.adjustment_amount),
    reserveAmount: num(transaction.reserve_amount),
    customerPaymentAmount: num(transaction.supplementary_component?.customer_payment_amount),
    adFeeAmount,
    breakdown,
    statementId: transaction.statement_id || statement?.id || null,
    statementTime: epochToIso(transaction.statement_time ?? statement?.statement_time),
    orderCreateTime: epochToIso(transaction.order_create_time),
    raw: transaction,
  };
}

/* ---------------------------------------------------------------- endpoints */

/** Payout statements in a time window. Each is one bank transfer. */
export function getStatements(input: {
  accessToken: string;
  shopCipher: string;
  statementTimeGe?: number;
  statementTimeLt?: number;
  pageSize?: number;
  pageToken?: string;
}) {
  return tiktokApi<{ statements?: FinanceStatement[]; next_page_token?: string }>({
    path: "/finance/202501/statements",
    accessToken: input.accessToken,
    query: {
      shop_cipher: input.shopCipher,
      page_size: input.pageSize ?? 50,
      page_token: input.pageToken,
      statement_time_ge: input.statementTimeGe,
      statement_time_lt: input.statementTimeLt,
      sort_field: "statement_time",
    },
  });
}

export type StatementTransactionsResponse = {
  /** NOTE: the response key is `transactions`, not `statement_transactions`. */
  transactions?: FinanceTransaction[];
  next_page_token?: string;
  currency?: string;
  total_count?: number;
  payable_amount?: string;
  total_settlement_amount?: string;
  total_reserve_amount?: string;
  total_settlement_breakdown?: {
    total_revenue_amount?: string;
    total_fee_tax_amount?: string;
    total_shipping_cost_amount?: string;
    total_adjustment_amount?: string;
  };
};

/** The transactions that make up one payout statement. */
export function getStatementTransactions(input: {
  accessToken: string;
  shopCipher: string;
  statementId: string;
  pageSize?: number;
  pageToken?: string;
}) {
  return tiktokApi<StatementTransactionsResponse>({
    path: `/finance/202501/statements/${encodeURIComponent(input.statementId)}/statement_transactions`,
    accessToken: input.accessToken,
    query: { shop_cipher: input.shopCipher, page_size: input.pageSize ?? 50, page_token: input.pageToken },
  });
}

/** SKU-level finance for a single order — carries quantity, sku_id and sku_name. */
export function getOrderTransactions(input: { accessToken: string; shopCipher: string; orderId: string }) {
  return tiktokApi<{
    currency?: string;
    settlement_amount?: string;
    revenue_amount?: string;
    fee_and_tax_amount?: string;
    shipping_cost_amount?: string;
    sku_transactions?: { sku_id?: string; sku_name?: string; product_name?: string; quantity?: number; settlement_amount?: string; revenue_amount?: string }[];
  }>({
    path: `/finance/202501/orders/${encodeURIComponent(input.orderId)}/statement_transactions`,
    accessToken: input.accessToken,
    query: { shop_cipher: input.shopCipher },
  });
}

/**
 * Walks every statement in the window and every transaction inside each statement.
 * `maxTransactions` is a safety stop and is reported back rather than applied silently.
 */
export async function fetchSettlements(input: {
  accessToken: string;
  shopCipher: string;
  statementTimeGe?: number;
  statementTimeLt?: number;
  maxTransactions?: number;
}) {
  const max = input.maxTransactions ?? 5000;
  const rows: SettlementRow[] = [];
  const statements: FinanceStatement[] = [];
  let sampleTransaction: FinanceTransaction | null = null;
  let truncated = false;
  let statementToken: string | undefined;

  outer: do {
    const page = await getStatements({ ...input, pageToken: statementToken });
    for (const statement of page.statements || []) {
      statements.push(statement);
      if (!statement.id) continue;

      let transactionToken: string | undefined;
      do {
        const result = await getStatementTransactions({
          accessToken: input.accessToken,
          shopCipher: input.shopCipher,
          statementId: statement.id,
          pageToken: transactionToken,
        });
        for (const transaction of result.transactions || []) {
          if (!sampleTransaction) sampleTransaction = transaction;
          const normalized = normalizeTransaction(transaction, statement);
          if (normalized) rows.push(normalized);
        }
        transactionToken = result.next_page_token || undefined;
        if (rows.length >= max) {
          truncated = Boolean(transactionToken || page.next_page_token);
          break outer;
        }
      } while (transactionToken);
    }
    statementToken = page.next_page_token || undefined;
  } while (statementToken);

  return { rows, statements, sampleTransaction, truncated };
}
