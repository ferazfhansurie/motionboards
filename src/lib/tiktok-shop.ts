import { createHmac } from "crypto";

/**
 * TikTok Shop Open API client (Partner / ISV flow).
 *
 * Signature algorithm (v2, unchanged since 202309):
 *   1. take every QUERY param except `sign` and `access_token`, sort keys alphabetically
 *   2. concat as {key}{value}
 *   3. prepend the request path
 *   4. append the raw request body (skipped for GET and multipart)
 *   5. wrap the whole thing in app_secret on both sides
 *   6. sign = HMAC-SHA256(app_secret, that string), lowercase hex
 */

const API_BASE = process.env.TIKTOK_SHOP_API_BASE || "https://open-api.tiktokglobalshop.com";
const AUTH_BASE = process.env.TIKTOK_SHOP_AUTH_API_BASE || "https://auth.tiktok-shops.com";

export type TikTokTokens = {
  access_token: string;
  access_token_expire_in: number; // absolute epoch SECONDS
  refresh_token: string;
  refresh_token_expire_in: number;
  open_id?: string;
  seller_name?: string;
  seller_base_region?: string;
};

export type TikTokShopInfo = { id: string; name: string; region: string; cipher: string; code?: string };

export type TikTokOrder = {
  id: string;
  status: string;
  create_time?: number;
  update_time?: number;
  paid_time?: number;
  delivery_time?: number;
  buyer_email?: string;
  buyer_message?: string;
  tracking_number?: string;
  shipping_provider?: string;
  payment?: { currency?: string; total_amount?: string; sub_total?: string; shipping_fee?: string };
  recipient_address?: {
    name?: string;
    phone_number?: string;
    full_address?: string;
    address_detail?: string;
    postal_code?: string;
    region_code?: string;
    district_info?: { address_name?: string; address_level_name?: string }[];
  };
  line_items?: {
    id?: string;
    product_id?: string;
    product_name?: string;
    sku_id?: string;
    sku_name?: string;
    seller_sku?: string;
    sale_price?: string;
    currency?: string;
    sku_image?: string;
  }[];
};

/** A normalised, ready-to-use view of an order — this is what the automations consume. */
export type NormalizedOrder = {
  orderId: string;
  status: string;
  phone: string | null;
  phoneIsMasked: boolean;
  recipientName: string | null;
  buyerEmail: string | null;
  address: string | null;
  postalCode: string | null;
  regionCode: string | null;
  currency: string | null;
  totalAmount: string | null;
  itemCount: number;
  items: { productId: string | null; productName: string | null; skuName: string | null; quantityPrice: string | null }[];
  trackingNumber: string | null;
  createTime: string | null;
  paidTime: string | null;
  updateTime: string | null;
  raw: TikTokOrder;
};

function appKey() {
  const value = process.env.TIKTOK_SHOP_APP_KEY;
  if (!value) throw new Error("TIKTOK_SHOP_APP_KEY is not configured");
  return value;
}
function appSecret() {
  const value = process.env.TIKTOK_SHOP_APP_SECRET;
  if (!value) throw new Error("TIKTOK_SHOP_APP_SECRET is not configured");
  return value;
}

export function signRequest(path: string, query: Record<string, string>, body: string, secret = appSecret()) {
  const signable = Object.keys(query)
    .filter((key) => key !== "sign" && key !== "access_token")
    .sort()
    .map((key) => `${key}${query[key]}`)
    .join("");
  const payload = `${secret}${path}${signable}${body}${secret}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

type CallOptions = {
  path: string;
  method?: "GET" | "POST" | "PUT";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  accessToken: string;
};

/** Signed call against open-api.tiktokglobalshop.com. Throws on transport or `code != 0` errors. */
export async function tiktokApi<T>({ path, method = "GET", query = {}, body, accessToken }: CallOptions): Promise<T> {
  const params: Record<string, string> = { app_key: appKey(), timestamp: String(Math.floor(Date.now() / 1000)) };
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params[key] = String(value);

  const rawBody = body === undefined ? "" : JSON.stringify(body);
  params.sign = signRequest(path, params, method === "GET" ? "" : rawBody);

  const url = `${API_BASE}${path}?${new URLSearchParams(params).toString()}`;
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json", "x-tts-access-token": accessToken },
    body: method === "GET" ? undefined : rawBody,
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: { code?: number; message?: string; data?: T };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(`TikTok Shop ${path} returned non-JSON (${response.status}): ${text.slice(0, 400)}`);
  }
  if (!response.ok || (parsed.code ?? 0) !== 0) {
    throw new Error(`TikTok Shop ${path} failed: code=${parsed.code} message=${parsed.message || response.status}`);
  }
  return parsed.data as T;
}

/* ------------------------------------------------------------------ auth */

/** The token endpoints live on auth.tiktok-shops.com and are NOT signed. */
async function authCall(endpoint: string, params: Record<string, string>): Promise<TikTokTokens> {
  const url = `${AUTH_BASE}${endpoint}?${new URLSearchParams({ ...params, app_key: appKey(), app_secret: appSecret() }).toString()}`;
  const response = await fetch(url, { headers: { "content-type": "application/json" }, cache: "no-store" });
  const text = await response.text();
  let parsed: { code?: number; message?: string; data?: TikTokTokens };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(`TikTok Shop ${endpoint} returned non-JSON (${response.status}): ${text.slice(0, 400)}`);
  }
  if (!response.ok || (parsed.code ?? 0) !== 0 || !parsed.data?.access_token) {
    throw new Error(`TikTok Shop ${endpoint} failed: code=${parsed.code} message=${parsed.message || response.status}`);
  }
  return parsed.data;
}

/** `grant_type=authorized_code` is intentional — TikTok Shop deviates from the OAuth spelling. */
export function exchangeAuthCode(authCode: string) {
  return authCall("/api/v2/token/get", { auth_code: authCode, grant_type: "authorized_code" });
}
export function refreshAccessToken(refreshToken: string) {
  return authCall("/api/v2/token/refresh", { refresh_token: refreshToken, grant_type: "refresh_token" });
}

/** Shops the seller authorised us for. `cipher` is required on every order call. */
export async function getAuthorizedShops(accessToken: string) {
  const data = await tiktokApi<{ shops?: TikTokShopInfo[] }>({ path: "/authorization/202309/shops", accessToken });
  return data.shops || [];
}

/* ---------------------------------------------------------------- orders */

export const ORDER_STATUSES = [
  "UNPAID",
  "ON_HOLD",
  "AWAITING_SHIPMENT",
  "AWAITING_COLLECTION",
  "PARTIALLY_SHIPPING",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type SearchOrdersInput = {
  accessToken: string;
  shopCipher: string;
  status?: OrderStatus;
  createTimeGe?: number; // epoch seconds
  createTimeLt?: number;
  updateTimeGe?: number;
  pageSize?: number;
  pageToken?: string;
};

/**
 * One page of orders. The 202309 search response already carries the full order
 * object (recipient address, line items, payment) — no per-order detail call needed.
 */
export async function searchOrders(input: SearchOrdersInput) {
  const body: Record<string, unknown> = {};
  if (input.status) body.order_status = input.status;
  if (input.createTimeGe) body.create_time_ge = input.createTimeGe;
  if (input.createTimeLt) body.create_time_lt = input.createTimeLt;
  if (input.updateTimeGe) body.update_time_ge = input.updateTimeGe;

  return tiktokApi<{ orders?: TikTokOrder[]; next_page_token?: string; total_count?: number }>({
    path: "/order/202309/orders/search",
    method: "POST",
    accessToken: input.accessToken,
    query: {
      shop_cipher: input.shopCipher,
      page_size: input.pageSize ?? 50,
      sort_field: "create_time",
      sort_order: "DESC",
      page_token: input.pageToken,
    },
    body,
  });
}

/** Walks every page of `searchOrders`. `maxOrders` is a safety stop, not a silent cap — it is reported back. */
export async function searchAllOrders(input: Omit<SearchOrdersInput, "pageToken">, maxOrders = 1000) {
  const orders: TikTokOrder[] = [];
  let pageToken: string | undefined;
  let truncated = false;
  do {
    const page = await searchOrders({ ...input, pageToken });
    orders.push(...(page.orders || []));
    pageToken = page.next_page_token || undefined;
    if (orders.length >= maxOrders) {
      truncated = Boolean(pageToken);
      break;
    }
  } while (pageToken);
  return { orders, truncated };
}

/** Detail lookup for up to 50 order ids — used by the webhook path. */
export async function getOrderDetail(accessToken: string, shopCipher: string, ids: string[]) {
  const data = await tiktokApi<{ orders?: TikTokOrder[] }>({
    path: "/order/202309/orders",
    accessToken,
    query: { shop_cipher: shopCipher, ids: ids.join(",") },
  });
  return data.orders || [];
}

/* ----------------------------------------------------------- normalising */

const MASK_PATTERN = /\*/;

function epochToIso(seconds?: number) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

export function normalizeOrder(order: TikTokOrder): NormalizedOrder {
  const address = order.recipient_address;
  const phone = address?.phone_number?.trim() || null;
  return {
    orderId: order.id,
    status: order.status,
    phone,
    phoneIsMasked: phone ? MASK_PATTERN.test(phone) : false,
    recipientName: address?.name?.trim() || null,
    buyerEmail: order.buyer_email?.trim() || null,
    address: address?.full_address || address?.address_detail || null,
    postalCode: address?.postal_code || null,
    regionCode: address?.region_code || null,
    currency: order.payment?.currency || null,
    totalAmount: order.payment?.total_amount || null,
    itemCount: order.line_items?.length ?? 0,
    items: (order.line_items || []).map((item) => ({
      productId: item.product_id || null,
      productName: item.product_name || null,
      skuName: item.sku_name || item.seller_sku || null,
      quantityPrice: item.sale_price || null,
    })),
    trackingNumber: order.tracking_number || null,
    createTime: epochToIso(order.create_time),
    paidTime: epochToIso(order.paid_time),
    updateTime: epochToIso(order.update_time),
    raw: order,
  };
}

/**
 * TikTok returns MY/SG phones like `(+60)11****4321`. Strip decoration so a
 * fully-visible number is dialable; masked numbers are returned as-is and the
 * caller must not attempt to message them.
 */
export function toE164(phone: string | null, defaultCountry = "60") {
  if (!phone || MASK_PATTERN.test(phone)) return null;
  const explicit = phone.match(/\(\+(\d+)\)\s*(.*)$/);
  const digits = (explicit ? explicit[1] + explicit[2] : phone).replace(/\D/g, "");
  if (!digits) return null;
  if (explicit) return digits;
  return digits.startsWith("0") ? defaultCountry + digits.slice(1) : digits;
}
