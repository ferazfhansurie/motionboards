#!/bin/bash
# Add optional image-attachment support to lead-form auto-replies:
#   1. Migration  → lead_form_subscriptions.auto_reply_image_url TEXT
#   2. CRUD       → POST / PATCH / GET pass image_url through
#   3. Internal   → /_internal/wwebjs-send accepts imageUrl and uses
#                   MessageMedia.fromUrl(url) so the attachment is sent
#                   with the message text as caption.
#   4. Test + webhook → forward sub.auto_reply_image_url to sendAutoReply.
#
# Idempotent. Restarts api + wwebjs at the end.
set -euo pipefail
cd /home/firaz/backend/bisnesgpt-server

# ── 1. Migration ────────────────────────────────────────────────────
echo "→ migration"
node - <<'JS'
require('dotenv').config();
const { Pool } = require('pg');
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});
  try {
    await p.query("ALTER TABLE lead_form_subscriptions ADD COLUMN IF NOT EXISTS auto_reply_image_url TEXT");
    console.log('  ✔ column added (or already present)');
  } catch (e) {
    console.error('  ✖', e.message);
    process.exit(1);
  }
  process.exit(0);
})();
JS

# ── 2. + 3. + 4. — patch routes/leadForms.js ────────────────────────
echo "→ patching routes/leadForms.js"
python3 - <<'PY'
path = 'routes/leadForms.js'
src = open(path, 'r', encoding='utf-8').read()

# 2a. POST /:companyId — accept auto_reply_image_url, persist it.
old_post_destructure = "  const { fb_form_id, fb_page_id, fb_page_name, fb_page_access_token,\n          label, auto_reply_template, phoneIndex } = req.body || {};"
new_post_destructure = "  const { fb_form_id, fb_page_id, fb_page_name, fb_page_access_token,\n          label, auto_reply_template, auto_reply_image_url, phoneIndex } = req.body || {};"
if new_post_destructure not in src and old_post_destructure in src:
    src = src.replace(old_post_destructure, new_post_destructure, 1)

old_post_insert = """    const r = await pool.query(
      `INSERT INTO lead_form_subscriptions
         (company_id, phone_index, fb_form_id, fb_page_id, fb_page_name,
          fb_page_access_token, label, auto_reply_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (company_id, fb_form_id) DO UPDATE SET
         fb_page_id           = EXCLUDED.fb_page_id,
         fb_page_name         = EXCLUDED.fb_page_name,
         fb_page_access_token = COALESCE(EXCLUDED.fb_page_access_token, lead_form_subscriptions.fb_page_access_token),
         label                = EXCLUDED.label,
         auto_reply_template  = EXCLUDED.auto_reply_template,
         updated_at           = now()
       RETURNING *`,
      [companyId, phoneIndex || 0, fb_form_id, fb_page_id, fb_page_name || null,
       fb_page_access_token || null, label, auto_reply_template]
    );"""
new_post_insert = """    const r = await pool.query(
      `INSERT INTO lead_form_subscriptions
         (company_id, phone_index, fb_form_id, fb_page_id, fb_page_name,
          fb_page_access_token, label, auto_reply_template, auto_reply_image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (company_id, fb_form_id) DO UPDATE SET
         fb_page_id            = EXCLUDED.fb_page_id,
         fb_page_name          = EXCLUDED.fb_page_name,
         fb_page_access_token  = COALESCE(EXCLUDED.fb_page_access_token, lead_form_subscriptions.fb_page_access_token),
         label                 = EXCLUDED.label,
         auto_reply_template   = EXCLUDED.auto_reply_template,
         auto_reply_image_url  = EXCLUDED.auto_reply_image_url,
         updated_at            = now()
       RETURNING *`,
      [companyId, phoneIndex || 0, fb_form_id, fb_page_id, fb_page_name || null,
       fb_page_access_token || null, label, auto_reply_template,
       (auto_reply_image_url && auto_reply_image_url.trim()) || null]
    );"""
if new_post_insert not in src and old_post_insert in src:
    src = src.replace(old_post_insert, new_post_insert, 1)

# 2b. PATCH /:companyId/:formId — accept auto_reply_image_url.
old_patch_destructure = "  const { fb_form_id, fb_page_id, fb_page_name, fb_page_access_token,\n          label, auto_reply_template, is_active } = req.body || {};"
new_patch_destructure = "  const { fb_form_id, fb_page_id, fb_page_name, fb_page_access_token,\n          label, auto_reply_template, auto_reply_image_url, is_active } = req.body || {};"
if new_patch_destructure not in src and old_patch_destructure in src:
    src = src.replace(old_patch_destructure, new_patch_destructure, 1)

old_patch_sql = """      `UPDATE lead_form_subscriptions
       SET fb_form_id           = COALESCE($1, fb_form_id),
           fb_page_id           = COALESCE($2, fb_page_id),
           fb_page_name         = COALESCE($3, fb_page_name),
           fb_page_access_token = COALESCE($4, fb_page_access_token),
           label                = COALESCE($5, label),
           auto_reply_template  = COALESCE($6, auto_reply_template),
           is_active            = COALESCE($7, is_active),
           updated_at           = now()
       WHERE id = $8 AND company_id = $9
       RETURNING *`,
      [fb_form_id, fb_page_id, fb_page_name, fb_page_access_token,
       label, auto_reply_template, is_active, formId, companyId]"""
new_patch_sql = """      `UPDATE lead_form_subscriptions
       SET fb_form_id            = COALESCE($1, fb_form_id),
           fb_page_id            = COALESCE($2, fb_page_id),
           fb_page_name          = COALESCE($3, fb_page_name),
           fb_page_access_token  = COALESCE($4, fb_page_access_token),
           label                 = COALESCE($5, label),
           auto_reply_template   = COALESCE($6, auto_reply_template),
           auto_reply_image_url  = COALESCE($7, auto_reply_image_url),
           is_active             = COALESCE($8, is_active),
           updated_at            = now()
       WHERE id = $9 AND company_id = $10
       RETURNING *`,
      [fb_form_id, fb_page_id, fb_page_name, fb_page_access_token,
       label, auto_reply_template,
       (auto_reply_image_url === '' ? null : auto_reply_image_url),
       is_active, formId, companyId]"""
if new_patch_sql not in src and old_patch_sql in src:
    src = src.replace(old_patch_sql, new_patch_sql, 1)

# 2c. GET /:companyId — include auto_reply_image_url in the SELECT.
old_get = "      `SELECT s.id, s.fb_form_id, s.fb_page_id, s.fb_page_name, s.label,\n              s.auto_reply_template, s.is_active, s.created_at,"
new_get = "      `SELECT s.id, s.fb_form_id, s.fb_page_id, s.fb_page_name, s.label,\n              s.auto_reply_template, s.auto_reply_image_url, s.is_active, s.created_at,"
if new_get not in src and old_get in src:
    src = src.replace(old_get, new_get, 1)

# 3. /_internal/wwebjs-send — add imageUrl support via MessageMedia.fromUrl
old_internal = """    let recipientId;
    if (typeof client.getNumberId === 'function') {
      // Returns null when the number isn't on WhatsApp.
      const numberId = await client.getNumberId(digits);
      if (!numberId) {
        return res.status(404).json({ error: `${digits} is not on WhatsApp` });
      }
      recipientId = numberId._serialized || `${digits}@c.us`;
    } else {
      recipientId = `${digits}@c.us`;
    }

    const sent = await client.sendMessage(recipientId, message);"""
new_internal = """    let recipientId;
    if (typeof client.getNumberId === 'function') {
      // Returns null when the number isn't on WhatsApp.
      const numberId = await client.getNumberId(digits);
      if (!numberId) {
        return res.status(404).json({ error: `${digits} is not on WhatsApp` });
      }
      recipientId = numberId._serialized || `${digits}@c.us`;
    } else {
      recipientId = `${digits}@c.us`;
    }

    // If imageUrl supplied, send the image with the text as caption.
    // Otherwise send plain text. MessageMedia.fromUrl streams the bytes
    // through whatsapp-web.js which uploads them to WhatsApp's CDN.
    const { imageUrl } = req.body || {};
    let sent;
    if (imageUrl && String(imageUrl).trim()) {
      try {
        const wweb = require('whatsapp-web.js');
        const media = await wweb.MessageMedia.fromUrl(String(imageUrl).trim(), { unsafeMime: true });
        sent = await client.sendMessage(recipientId, media, { caption: message });
      } catch (mediaErr) {
        console.warn('[leadForms _internal/wwebjs-send] image fetch failed, falling back to text-only:', mediaErr.message);
        sent = await client.sendMessage(recipientId, message);
      }
    } else {
      sent = await client.sendMessage(recipientId, message);
    }"""
if new_internal not in src and old_internal in src:
    src = src.replace(old_internal, new_internal, 1)

# 4. sendAutoReply — accept imageUrl arg and forward.
old_sendautoreply_sig = "async function sendAutoReply({ companyId, phoneIndex, toPhone, message }) {"
new_sendautoreply_sig = "async function sendAutoReply({ companyId, phoneIndex, toPhone, message, imageUrl }) {"
if new_sendautoreply_sig not in src and old_sendautoreply_sig in src:
    src = src.replace(old_sendautoreply_sig, new_sendautoreply_sig, 1)

# 4a. Direct path (Cloud API) — call sendMedia when imageUrl present.
old_direct_block = """      if (svc) {
        const result = await svc.sendText(chatId, message);
        return { transport: 'direct', result };
      }"""
new_direct_block = """      if (svc) {
        let result;
        if (imageUrl && svc.sendMedia) {
          // Cloud API path supports image; caption goes via the same call.
          result = await svc.sendMedia(chatId, 'image', imageUrl, message);
        } else {
          result = await svc.sendText(chatId, message);
        }
        return { transport: 'direct', result };
      }"""
if new_direct_block not in src and old_direct_block in src:
    src = src.replace(old_direct_block, new_direct_block, 1)

# 4b. Proxy POST body — include imageUrl.
old_proxy_post = """    const proxyRes = await axios.post(
      url,
      { companyId, phoneIndex, phone: phoneDigits, message },
      { timeout: 30000 }
    );"""
new_proxy_post = """    const proxyRes = await axios.post(
      url,
      { companyId, phoneIndex, phone: phoneDigits, message, imageUrl },
      { timeout: 60000 }
    );"""
if new_proxy_post not in src and old_proxy_post in src:
    src = src.replace(old_proxy_post, new_proxy_post, 1)

# 4c. Test endpoint — pass sub.auto_reply_image_url through.
old_test_call = """      if (toPhone) {
        await sendAutoReply({
          companyId,
          phoneIndex: phoneIndex ?? sub.phone_index ?? 0,
          toPhone,
          message,
        });"""
new_test_call = """      if (toPhone) {
        await sendAutoReply({
          companyId,
          phoneIndex: phoneIndex ?? sub.phone_index ?? 0,
          toPhone,
          message,
          imageUrl: sub.auto_reply_image_url || null,
        });"""
if new_test_call not in src and old_test_call in src:
    src = src.replace(old_test_call, new_test_call, 1)

# 4d. Webhook handler — pass sub.auto_reply_image_url through.
old_webhook_call = """          if (phone) {
            await sendAutoReply({
              companyId,
              phoneIndex: sub.phone_index ?? 0,
              toPhone: phone,
              message,
            });"""
new_webhook_call = """          if (phone) {
            await sendAutoReply({
              companyId,
              phoneIndex: sub.phone_index ?? 0,
              toPhone: phone,
              message,
              imageUrl: sub.auto_reply_image_url || null,
            });"""
if new_webhook_call not in src and old_webhook_call in src:
    src = src.replace(old_webhook_call, new_webhook_call, 1)

open(path, 'w', encoding='utf-8').write(src)
print('  ✔ routes/leadForms.js updated')
PY

# ── 5. Restart ───────────────────────────────────────────────────────
echo "→ pm2 restart bisnesgpt-api"
pm2 restart bisnesgpt-api > /dev/null
echo "→ pm2 restart bisnesgpt-wwebjs"
pm2 restart bisnesgpt-wwebjs > /dev/null
echo "✔ image-attachment support deployed"
