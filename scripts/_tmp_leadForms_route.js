// routes/leadForms.js
//
// Facebook Lead Ads → bisnesgpt WhatsApp auto-reply.
//
// Two surfaces:
//   /api/lead-forms/...  — admin CRUD for the inbox UI (create, list,
//      patch, delete, fire test, list recent leads, get + rotate the
//      webhook verify token).
//   /webhook/leadgen/:companyId  — public Meta callback. GET returns
//      the hub.challenge after verifying the per-company verify token.
//      POST receives the leadgen event, fetches the lead detail from
//      Graph using the stored page access token, renders the
//      auto-reply template, and fires it via WhatsAppService.
//
// Everything mounts on the existing api process. Auto-reply send goes
// through WhatsAppService — official Cloud API path is fully cross-
// process; wwebjs path requires the wwebjs process so we fall back to
// `delivery_status = queued` when the local botMap doesn't have the
// client. The wwebjs handler can pick those up via a small worker
// (out of scope here — the entries table will hold them).

const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');
const router  = express.Router();

const { pool } = require('../db');

// Lazy-resolve WhatsApp service so a missing import doesn't crash boot.
function tryLoadWhatsAppService() {
  try {
    return require('../services/whatsapp/WhatsAppService');
  } catch (err) {
    console.warn('[leadForms] WhatsApp service not available:', err.message);
    return null;
  }
}
const whatsappService = tryLoadWhatsAppService();

// ── helpers ────────────────────────────────────────────────────────────

function genVerifyToken() {
  return crypto.randomBytes(24).toString('base64url');
}

async function ensureWebhookConfig(companyId) {
  const existing = await pool.query(
    'SELECT * FROM lead_form_webhooks WHERE company_id = $1',
    [companyId]
  );
  if (existing.rowCount) return existing.rows[0];

  const token = genVerifyToken();
  const inserted = await pool.query(
    `INSERT INTO lead_form_webhooks (company_id, verify_token)
     VALUES ($1, $2)
     RETURNING *`,
    [companyId, token]
  );
  return inserted.rows[0];
}

function publicWebhookUrl(req, companyId) {
  // Honour the existing convention — bisnesgpt is reverse-proxied behind
  // bisnesgpt.jutateknologi.com. Fall back to the request host so this
  // works on staging too.
  const base = process.env.PUBLIC_BASE_URL ||
               (req && `${req.protocol}://${req.get('host')}`) ||
               'https://bisnesgpt.jutateknologi.com';
  return `${base.replace(/\/$/, '')}/webhook/leadgen/${encodeURIComponent(companyId)}`;
}

function renderTemplate(template, vars) {
  return String(template || '').replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, key) => {
    const val = vars[key];
    return val == null ? '' : String(val);
  });
}

// Pull name / email / phone out of Meta's field_data array. Meta's keys
// are inconsistent across forms — we match by common variants.
function extractContact(fieldData) {
  const map = {};
  for (const f of fieldData || []) {
    const key = String(f.name || '').toLowerCase();
    const val = Array.isArray(f.values) ? f.values[0] : f.value;
    if (val != null) map[key] = val;
  }
  const fullName = map['full_name'] || map['name']
    || [map['first_name'], map['last_name']].filter(Boolean).join(' ').trim();
  const email = map['email'] || map['email_address'];
  const phone = map['phone_number'] || map['phone'] || map['phone number'] || map['mobile_number'];
  return { fullName, email, phone };
}

function toWaChatId(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  return `${digits}@c.us`;  // wwebjs convention; the official Cloud API path tolerates plain digits too.
}

async function sendAutoReply({ companyId, phoneIndex, toPhone, message }) {
  if (!whatsappService) throw new Error('whatsapp service not loaded');
  const factory = whatsappService.getWhatsAppService || whatsappService.create || null;
  let svc;
  if (typeof factory === 'function') {
    svc = await factory(companyId, phoneIndex);
  } else if (whatsappService.WhatsAppService) {
    svc = new whatsappService.WhatsAppService(companyId, phoneIndex);
    if (svc.load) await svc.load();
  } else {
    throw new Error('whatsapp service has no factory');
  }
  const chatId = toWaChatId(toPhone);
  if (!chatId) throw new Error('lead has no phone number');
  return svc.sendText(chatId, message);
}

// ── /api/lead-forms — admin CRUD ──────────────────────────────────────

router.get('/:companyId', async (req, res) => {
  const { companyId } = req.params;
  try {
    const r = await pool.query(
      `SELECT s.id, s.fb_form_id, s.fb_page_id, s.fb_page_name, s.label,
              s.auto_reply_template, s.is_active, s.created_at,
              COALESCE(c.total_leads, 0) AS total_leads,
              c.last_lead_at
       FROM lead_form_subscriptions s
       LEFT JOIN (
         SELECT subscription_id,
                COUNT(*)         AS total_leads,
                MAX(created_at)  AS last_lead_at
         FROM lead_form_entries
         GROUP BY subscription_id
       ) c ON c.subscription_id = s.id
       WHERE s.company_id = $1
       ORDER BY s.created_at DESC`,
      [companyId]
    );
    res.json({ forms: r.rows });
  } catch (err) {
    console.error('[leadForms] list failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const { fb_form_id, fb_page_id, fb_page_name, fb_page_access_token,
          label, auto_reply_template, phoneIndex } = req.body || {};
  if (!fb_form_id || !fb_page_id || !label || !auto_reply_template) {
    return res.status(400).json({ error: 'fb_form_id, fb_page_id, label, auto_reply_template are required' });
  }
  try {
    await ensureWebhookConfig(companyId);
    const r = await pool.query(
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
    );
    res.json({ form: r.rows[0] });
  } catch (err) {
    console.error('[leadForms] create failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:companyId/:formId', async (req, res) => {
  const { companyId, formId } = req.params;
  const { fb_form_id, fb_page_id, fb_page_name, fb_page_access_token,
          label, auto_reply_template, is_active } = req.body || {};
  try {
    const r = await pool.query(
      `UPDATE lead_form_subscriptions
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
       label, auto_reply_template, is_active, formId, companyId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ form: r.rows[0] });
  } catch (err) {
    console.error('[leadForms] patch failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:companyId/:formId', async (req, res) => {
  const { companyId, formId } = req.params;
  try {
    const r = await pool.query(
      'DELETE FROM lead_form_subscriptions WHERE id = $1 AND company_id = $2 RETURNING id',
      [formId, companyId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[leadForms] delete failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:companyId/:formId/test', async (req, res) => {
  const { companyId, formId } = req.params;
  const { phoneIndex, toPhone, fakeName, fakeEmail } = req.body || {};
  try {
    const r = await pool.query(
      'SELECT * FROM lead_form_subscriptions WHERE id = $1 AND company_id = $2',
      [formId, companyId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'form not found' });
    const sub = r.rows[0];

    const vars = {
      name: fakeName || 'Test Lead',
      email: fakeEmail || 'test@example.com',
      phone: toPhone || sub.fb_page_id, // fallback so the template renders
      form_label: sub.label,
    };
    const message = renderTemplate(sub.auto_reply_template, vars);

    let deliveryStatus = 'queued';
    let deliveryError = null;
    try {
      if (toPhone) {
        await sendAutoReply({
          companyId,
          phoneIndex: phoneIndex ?? sub.phone_index ?? 0,
          toPhone,
          message,
        });
        deliveryStatus = 'sent';
      } else {
        deliveryStatus = 'skipped';
        deliveryError = 'no toPhone supplied — preview only';
      }
    } catch (err) {
      deliveryStatus = 'failed';
      deliveryError = err.message;
    }

    await pool.query(
      `INSERT INTO lead_form_entries
         (company_id, subscription_id, fb_lead_id, fb_form_id, fb_page_id,
          full_name, email, phone, raw_field_data, delivery_status,
          delivery_error, delivered_message, delivered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
               CASE WHEN $10 = 'sent' THEN now() ELSE NULL END)
       ON CONFLICT (company_id, fb_lead_id) DO NOTHING`,
      [companyId, sub.id, `test_${Date.now()}`, sub.fb_form_id, sub.fb_page_id,
       vars.name, vars.email, toPhone || null, JSON.stringify([]),
       deliveryStatus, deliveryError, message]
    );

    res.json({ ok: deliveryStatus === 'sent', deliveryStatus, deliveryError, preview: message });
  } catch (err) {
    console.error('[leadForms] test failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:companyId/leads', async (req, res) => {
  const { companyId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  try {
    const r = await pool.query(
      `SELECT e.id, e.fb_form_id, e.full_name, e.email, e.phone,
              e.delivery_status, e.delivery_error, e.created_at,
              s.label AS form_label
       FROM lead_form_entries e
       LEFT JOIN lead_form_subscriptions s ON s.id = e.subscription_id
       WHERE e.company_id = $1
       ORDER BY e.created_at DESC
       LIMIT $2`,
      [companyId, limit]
    );
    res.json({ leads: r.rows });
  } catch (err) {
    console.error('[leadForms] leads list failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:companyId/webhook-info', async (req, res) => {
  const { companyId } = req.params;
  try {
    const cfg = await ensureWebhookConfig(companyId);
    res.json({ url: publicWebhookUrl(req, companyId), verify_token: cfg.verify_token });
  } catch (err) {
    console.error('[leadForms] webhook-info failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:companyId/webhook-info/rotate', async (req, res) => {
  const { companyId } = req.params;
  try {
    const token = genVerifyToken();
    await pool.query(
      `INSERT INTO lead_form_webhooks (company_id, verify_token)
       VALUES ($1, $2)
       ON CONFLICT (company_id) DO UPDATE SET verify_token = EXCLUDED.verify_token, rotated_at = now()`,
      [companyId, token]
    );
    res.json({ url: publicWebhookUrl(req, companyId), verify_token: token });
  } catch (err) {
    console.error('[leadForms] rotate failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── /webhook/leadgen/:companyId — Meta callback ───────────────────────

const webhookRouter = express.Router();

// GET — Meta hub.challenge verification.
webhookRouter.get('/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode !== 'subscribe' || !token || !challenge) return res.sendStatus(400);

  try {
    const cfg = await pool.query(
      'SELECT verify_token FROM lead_form_webhooks WHERE company_id = $1',
      [companyId]
    );
    if (cfg.rowCount === 0 || cfg.rows[0].verify_token !== token) {
      return res.sendStatus(403);
    }
    res.status(200).send(challenge);
  } catch (err) {
    console.error('[leadgen webhook] verification failed:', err);
    res.sendStatus(500);
  }
});

// POST — leadgen events.
webhookRouter.post('/:companyId', express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }), async (req, res) => {
  // Acknowledge fast — Meta retries aggressively if we 4xx.
  res.sendStatus(200);

  const { companyId } = req.params;
  const body = req.body || {};
  if (body.object !== 'page' || !Array.isArray(body.entry)) return;

  for (const entry of body.entry) {
    const pageId = entry.id;
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue;
      const v = change.value || {};
      const fbLeadId = v.leadgen_id || v.lead_id;
      const fbFormId = v.form_id;
      if (!fbLeadId || !fbFormId) continue;

      try {
        const subRes = await pool.query(
          `SELECT * FROM lead_form_subscriptions
           WHERE company_id = $1 AND fb_form_id = $2 AND is_active = true LIMIT 1`,
          [companyId, fbFormId]
        );
        if (subRes.rowCount === 0) {
          console.log(`[leadgen] no active subscription for company=${companyId} form=${fbFormId}`);
          continue;
        }
        const sub = subRes.rows[0];

        // Fetch lead detail from Graph API.
        let fieldData = [];
        try {
          if (sub.fb_page_access_token) {
            const fb = await axios.get(
              `https://graph.facebook.com/v19.0/${fbLeadId}`,
              { params: { access_token: sub.fb_page_access_token, fields: 'field_data,created_time' }, timeout: 10000 }
            );
            fieldData = fb.data?.field_data || [];
          }
        } catch (err) {
          console.warn(`[leadgen] graph fetch failed for ${fbLeadId}:`, err.response?.data || err.message);
        }

        const { fullName, email, phone } = extractContact(fieldData);
        const message = renderTemplate(sub.auto_reply_template, {
          name: fullName || 'there',
          email: email || '',
          phone: phone || '',
          form_label: sub.label,
        });

        let deliveryStatus = 'queued';
        let deliveryError = null;
        try {
          if (phone) {
            await sendAutoReply({
              companyId,
              phoneIndex: sub.phone_index ?? 0,
              toPhone: phone,
              message,
            });
            deliveryStatus = 'sent';
          } else {
            deliveryStatus = 'skipped';
            deliveryError = 'no phone in lead payload';
          }
        } catch (err) {
          deliveryStatus = 'failed';
          deliveryError = err.message;
          console.warn(`[leadgen] send failed for lead ${fbLeadId}:`, err.message);
        }

        await pool.query(
          `INSERT INTO lead_form_entries
             (company_id, subscription_id, fb_lead_id, fb_form_id, fb_page_id,
              full_name, email, phone, raw_field_data, delivery_status,
              delivery_error, delivered_message, delivered_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
                   CASE WHEN $10 = 'sent' THEN now() ELSE NULL END)
           ON CONFLICT (company_id, fb_lead_id) DO UPDATE SET
             delivery_status = EXCLUDED.delivery_status,
             delivery_error  = EXCLUDED.delivery_error,
             delivered_message = EXCLUDED.delivered_message,
             delivered_at = EXCLUDED.delivered_at`,
          [companyId, sub.id, fbLeadId, fbFormId, pageId,
           fullName || null, email || null, phone || null,
           JSON.stringify(fieldData), deliveryStatus, deliveryError, message]
        );
      } catch (err) {
        console.error('[leadgen] handler error for lead:', fbLeadId, err);
      }
    }
  }
});

module.exports = router;
module.exports.webhookRouter = webhookRouter;
