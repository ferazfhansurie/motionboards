import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { neon } from "@neondatabase/serverless";
import { getAuthorizedShops, normalizeOrder, refreshAccessToken, toE164, type TikTokOrder, type TikTokTokens } from "./tiktok-shop";

type Row = Record<string, unknown>;
type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;
const sql: Sql = (strings, ...values) => neon(process.env.DATABASE_URL!)(strings, ...values) as Promise<Row[]>;

export type Integration = "tiktok_shop" | "whatsapp";

let schemaReady = false;
export async function ensureTickLoopSchema() {
  if (schemaReady) return;
  await sql`CREATE TABLE IF NOT EXISTS tl_workspaces (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS tl_workspaces_owner_idx ON tl_workspaces(owner_id)`;
  await sql`CREATE TABLE IF NOT EXISTS tl_connections (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, provider TEXT NOT NULL, external_id TEXT, status TEXT NOT NULL DEFAULT 'pending', credentials TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(workspace_id, provider))`;
  await sql`CREATE TABLE IF NOT EXISTS tl_oauth_states (state TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, provider TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS tl_automations (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT FALSE, trigger TEXT NOT NULL, template_name TEXT, config JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS tl_events (id BIGSERIAL PRIMARY KEY, workspace_id TEXT, provider TEXT NOT NULL, event_type TEXT NOT NULL, external_id TEXT, payload JSONB NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(provider, external_id))`;
  await sql`CREATE TABLE IF NOT EXISTS tl_consents (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, phone_hash TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL, captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(workspace_id, phone_hash))`;
  await sql`CREATE TABLE IF NOT EXISTS tl_orders (workspace_id TEXT NOT NULL, order_id TEXT NOT NULL, shop_id TEXT, status TEXT NOT NULL, recipient_name TEXT, phone TEXT, phone_e164 TEXT, phone_masked BOOLEAN NOT NULL DEFAULT TRUE, buyer_email TEXT, address TEXT, postal_code TEXT, region_code TEXT, currency TEXT, total_amount TEXT, item_count INTEGER NOT NULL DEFAULT 0, tracking_number TEXT, create_time TIMESTAMPTZ, paid_time TIMESTAMPTZ, update_time TIMESTAMPTZ, raw JSONB NOT NULL DEFAULT '{}'::jsonb, synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (workspace_id, order_id))`;
  await sql`CREATE INDEX IF NOT EXISTS tl_orders_status_idx ON tl_orders(workspace_id, status, create_time DESC)`;
  schemaReady = true;
}

export async function workspaceForUser(userId: string, name?: string) {
  await ensureTickLoopSchema();
  const existing = await sql`SELECT * FROM tl_workspaces WHERE owner_id = ${userId} LIMIT 1`;
  if (existing[0]) return existing[0];
  const id = `ws_${randomBytes(12).toString("hex")}`;
  const rows = await sql`INSERT INTO tl_workspaces (id, owner_id, name) VALUES (${id}, ${userId}, ${name || "My workspace"}) RETURNING *`;
  return rows[0];
}

function key() {
  const secret = process.env.TICKLOOP_ENCRYPTION_KEY;
  if (!secret) throw new Error("TICKLOOP_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(secret).digest();
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}
export function decrypt<T>(value: string): T {
  const [iv, tag, body] = value.split("."); const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8")) as T;
}
export function newState() { return randomBytes(32).toString("base64url"); }
export async function saveOAuthState(state: string, workspaceId: string, provider: Integration) { await ensureTickLoopSchema(); await sql`INSERT INTO tl_oauth_states (state, workspace_id, provider, expires_at) VALUES (${state}, ${workspaceId}, ${provider}, NOW() + INTERVAL '10 minutes')`; }
export async function consumeOAuthState(state: string, provider: Integration) { await ensureTickLoopSchema(); const rows = await sql`DELETE FROM tl_oauth_states WHERE state = ${state} AND provider = ${provider} AND expires_at > NOW() RETURNING workspace_id`; return rows[0]?.workspace_id as string | undefined; }
export async function upsertConnection(workspaceId: string, provider: Integration, externalId: string, credentials: unknown, metadata: unknown = {}) { await ensureTickLoopSchema(); const id = `con_${randomBytes(10).toString("hex")}`; await sql`INSERT INTO tl_connections (id, workspace_id, provider, external_id, status, credentials, metadata) VALUES (${id}, ${workspaceId}, ${provider}, ${externalId}, 'connected', ${encrypt(credentials)}, ${JSON.stringify(metadata)}::jsonb) ON CONFLICT (workspace_id, provider) DO UPDATE SET external_id = EXCLUDED.external_id, status = 'connected', credentials = EXCLUDED.credentials, metadata = EXCLUDED.metadata, updated_at = NOW()`; }
export async function listConnections(workspaceId: string) { await ensureTickLoopSchema(); return sql`SELECT provider, external_id, status, metadata, updated_at FROM tl_connections WHERE workspace_id = ${workspaceId}`; }
export async function connectionForWorkspace(workspaceId: string, provider: Integration) { await ensureTickLoopSchema(); const rows = await sql`SELECT * FROM tl_connections WHERE workspace_id = ${workspaceId} AND provider = ${provider} LIMIT 1`; return rows[0]; }
export async function workspaceForWhatsAppPhone(phoneNumberId: string) { await ensureTickLoopSchema(); const rows = await sql`SELECT workspace_id FROM tl_connections WHERE provider = 'whatsapp' AND external_id = ${phoneNumberId} LIMIT 1`; return rows[0]?.workspace_id as string | undefined; }
export function phoneHash(phone: string) { return createHash("sha256").update(phone.replace(/\D/g, "")).digest("hex"); }
export async function setConsent(workspaceId: string, phone: string, status: "opted_in" | "opted_out", source: string) { await ensureTickLoopSchema(); const id = `consent_${randomBytes(10).toString("hex")}`; await sql`INSERT INTO tl_consents (id, workspace_id, phone_hash, status, source) VALUES (${id}, ${workspaceId}, ${phoneHash(phone)}, ${status}, ${source}) ON CONFLICT (workspace_id, phone_hash) DO UPDATE SET status = EXCLUDED.status, source = EXCLUDED.source, captured_at = NOW()`; }
export async function hasConsent(workspaceId: string, phone: string) { await ensureTickLoopSchema(); const rows = await sql`SELECT status FROM tl_consents WHERE workspace_id = ${workspaceId} AND phone_hash = ${phoneHash(phone)} LIMIT 1`; return rows[0]?.status === "opted_in"; }
export async function sendTemplate(workspaceId: string, to: string, name: string, body: string[]) {
  if (!await hasConsent(workspaceId, to)) return { ok: false, reason: "missing_consent" as const };
  const connection = await connectionForWorkspace(workspaceId, "whatsapp"); if (!connection?.credentials || !connection.external_id) return { ok: false, reason: "whatsapp_not_connected" as const };
  const credentials = decrypt<{ access_token?: string }>(connection.credentials as string); if (!credentials.access_token) return { ok: false, reason: "missing_access_token" as const };
  const response = await fetch(`https://graph.facebook.com/v23.0/${connection.external_id}/messages`, { method: "POST", headers: { authorization: `Bearer ${credentials.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "template", template: { name, language: { code: "en_US" }, components: body.length ? [{ type: "body", parameters: body.map((text) => ({ type: "text", text })) }] : [] } }) });
  if (!response.ok) return { ok: false, reason: "provider_error" as const, detail: await response.text() };
  return { ok: true, result: await response.json() };
}
export async function logEvent(provider: Integration, eventType: string, payload: unknown, externalId?: string, workspaceId?: string) { await ensureTickLoopSchema(); await sql`INSERT INTO tl_events (workspace_id, provider, event_type, external_id, payload) VALUES (${workspaceId || null}, ${provider}, ${eventType}, ${externalId || null}, ${JSON.stringify(payload)}::jsonb) ON CONFLICT (provider, external_id) DO NOTHING`; }
/* ------------------------------------------------------- TikTok Shop access */

/**
 * Returns a live access token + shop cipher for the workspace, refreshing the
 * token and back-filling the shop cipher on demand. Every order call goes
 * through here so a 7-day token expiry never surfaces as a 401 to the caller.
 */
export async function tiktokShopAccess(workspaceId: string) {
  const connection = await connectionForWorkspace(workspaceId, "tiktok_shop");
  if (!connection?.credentials) return { ok: false as const, reason: "tiktok_not_connected" as const };

  let tokens = decrypt<TikTokTokens>(connection.credentials as string);
  const metadata = (connection.metadata || {}) as { shopCipher?: string; shopId?: string; shopName?: string; region?: string };
  let changed = false;

  const expiresAt = Number(tokens.access_token_expire_in || 0);
  if (expiresAt && expiresAt * 1000 - Date.now() < 5 * 60_000) {
    if (!tokens.refresh_token) return { ok: false as const, reason: "tiktok_token_expired" as const };
    tokens = await refreshAccessToken(tokens.refresh_token);
    changed = true;
  }

  let shopCipher = metadata.shopCipher;
  if (!shopCipher) {
    const shops = await getAuthorizedShops(tokens.access_token);
    const shop = shops[0];
    if (!shop?.cipher) return { ok: false as const, reason: "no_authorized_shop" as const };
    Object.assign(metadata, { shopCipher: shop.cipher, shopId: shop.id, shopName: shop.name, region: shop.region });
    shopCipher = shop.cipher;
    changed = true;
  }

  if (changed) await upsertConnection(workspaceId, "tiktok_shop", (connection.external_id as string) || metadata.shopId || "authorized-shop", tokens, metadata);
  return { ok: true as const, accessToken: tokens.access_token, shopCipher, shopId: metadata.shopId, shopName: metadata.shopName, region: metadata.region };
}

/* -------------------------------------------------------------- tl_orders */

export async function saveOrders(workspaceId: string, shopId: string | undefined, orders: TikTokOrder[]) {
  await ensureTickLoopSchema();
  const normalized = orders.map(normalizeOrder);
  for (const order of normalized) {
    await sql`INSERT INTO tl_orders (workspace_id, order_id, shop_id, status, recipient_name, phone, phone_e164, phone_masked, buyer_email, address, postal_code, region_code, currency, total_amount, item_count, tracking_number, create_time, paid_time, update_time, raw, synced_at)
      VALUES (${workspaceId}, ${order.orderId}, ${shopId || null}, ${order.status}, ${order.recipientName}, ${order.phone}, ${toE164(order.phone)}, ${order.phoneIsMasked}, ${order.buyerEmail}, ${order.address}, ${order.postalCode}, ${order.regionCode}, ${order.currency}, ${order.totalAmount}, ${order.itemCount}, ${order.trackingNumber}, ${order.createTime}, ${order.paidTime}, ${order.updateTime}, ${JSON.stringify(order.raw)}::jsonb, NOW())
      ON CONFLICT (workspace_id, order_id) DO UPDATE SET status = EXCLUDED.status, recipient_name = EXCLUDED.recipient_name, phone = EXCLUDED.phone, phone_e164 = EXCLUDED.phone_e164, phone_masked = EXCLUDED.phone_masked, buyer_email = EXCLUDED.buyer_email, address = EXCLUDED.address, postal_code = EXCLUDED.postal_code, region_code = EXCLUDED.region_code, currency = EXCLUDED.currency, total_amount = EXCLUDED.total_amount, item_count = EXCLUDED.item_count, tracking_number = EXCLUDED.tracking_number, paid_time = EXCLUDED.paid_time, update_time = EXCLUDED.update_time, raw = EXCLUDED.raw, synced_at = NOW()`;
  }
  return normalized;
}

export async function listOrders(workspaceId: string, options: { status?: string; withPhoneOnly?: boolean; limit?: number } = {}) {
  await ensureTickLoopSchema();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  if (options.status && options.withPhoneOnly) return sql`SELECT * FROM tl_orders WHERE workspace_id = ${workspaceId} AND status = ${options.status} AND phone_e164 IS NOT NULL ORDER BY create_time DESC NULLS LAST LIMIT ${limit}`;
  if (options.status) return sql`SELECT * FROM tl_orders WHERE workspace_id = ${workspaceId} AND status = ${options.status} ORDER BY create_time DESC NULLS LAST LIMIT ${limit}`;
  if (options.withPhoneOnly) return sql`SELECT * FROM tl_orders WHERE workspace_id = ${workspaceId} AND phone_e164 IS NOT NULL ORDER BY create_time DESC NULLS LAST LIMIT ${limit}`;
  return sql`SELECT * FROM tl_orders WHERE workspace_id = ${workspaceId} ORDER BY create_time DESC NULLS LAST LIMIT ${limit}`;
}

export async function orderById(workspaceId: string, orderId: string) {
  await ensureTickLoopSchema();
  const rows = await sql`SELECT * FROM tl_orders WHERE workspace_id = ${workspaceId} AND order_id = ${orderId} LIMIT 1`;
  return rows[0];
}

export async function workspaceForTikTokShop(shopId: string) {
  await ensureTickLoopSchema();
  const rows = await sql`SELECT workspace_id FROM tl_connections WHERE provider = 'tiktok_shop' AND (external_id = ${shopId} OR metadata->>'shopId' = ${shopId}) LIMIT 1`;
  return rows[0]?.workspace_id as string | undefined;
}

export function validMetaSignature(raw: string, signature: string | null) { const secret = process.env.META_APP_SECRET; if (!secret || !signature?.startsWith("sha256=")) return false; const hmac = createHmac("sha256", secret).update(raw).digest("hex"); return timingSafeEqual(Buffer.from(hmac), Buffer.from(signature.slice(7))); }
