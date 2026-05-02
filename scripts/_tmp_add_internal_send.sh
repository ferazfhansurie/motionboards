#!/bin/bash
# Add an internal lead-form send route that resolves the recipient via
# getNumberId before sendMessage — this avoids the "Lid is missing in
# chat table" error whatsapp-web.js throws for first-contact recipients.
#
# Then re-point sendAutoReply's proxy URL at this new internal route.
set -euo pipefail
cd /home/firaz/backend/bisnesgpt-server

python3 - <<'PY'
path = 'routes/leadForms.js'
src = open(path, 'r', encoding='utf-8').read()

# 1. Add the internal send route (idempotent)
if "/_internal/wwebjs-send'" not in src:
    anchor = "module.exports = router;"
    if anchor not in src:
        raise SystemExit("anchor 'module.exports = router;' not found")
    snippet = r"""
// ── /api/lead-forms/_internal/wwebjs-send ──────────────────────────────
//
// Same-process send for lead-form replies. Reachable on whichever pm2
// process loads server.js (api on :3000, wwebjs on :3001) — the
// implementation gates on `global.botMap` so it only ACTUALLY sends
// when called on the wwebjs process where the WhatsApp client lives.
//
// Critical bit: we resolve the recipient via `client.getNumberId(phone)`
// BEFORE calling `sendMessage`. That registers the chat in
// whatsapp-web.js's internal cache and avoids the
//   "Lid is missing in chat table"
// error whatsapp-web.js throws for first-contact recipients (the chat
// object hasn't been initialised yet, so its `id._lid` is undefined).
//
// Body shape: { companyId, phoneIndex, phone, message }
//   phone is the recipient in plain digits (e.g. "60123456789").
router.post('/_internal/wwebjs-send', async (req, res) => {
  const { companyId, phoneIndex, phone, message } = req.body || {};
  if (!companyId || !phone || !message) {
    return res.status(400).json({ error: 'companyId, phone, message required' });
  }
  const idx = (phoneIndex == null) ? 0 : phoneIndex;

  const botMap = global.botMap;
  if (!botMap) {
    return res.status(503).json({ error: 'wwebjs botMap not present in this process' });
  }
  const map = (typeof botMap.get === 'function') ? botMap.get(companyId) : botMap[companyId];
  const slot = map && map[idx];
  const client = slot && (slot.client || slot);
  if (!client || typeof client.sendMessage !== 'function') {
    return res.status(503).json({ error: `wwebjs client not loaded for ${companyId}/${idx}` });
  }

  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return res.status(400).json({ error: 'phone has no digits' });

  try {
    let recipientId;
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

    const sent = await client.sendMessage(recipientId, message);
    res.json({
      ok: true,
      messageId: sent && sent.id && sent.id._serialized,
      timestamp: sent && sent.timestamp,
      to: recipientId,
    });
  } catch (err) {
    const msg = String((err && err.message) || err);
    console.error('[leadForms _internal/wwebjs-send]', msg);
    res.status(500).json({ error: msg });
  }
});

"""
    src = src.replace(anchor, snippet + anchor, 1)

# 2. Re-point the proxy URL inside sendAutoReply.
old_proxy = '''  // Proxy to the wwebjs process. We're in the api process; localhost
  // routing is fine — they share the same box.
  const wwebjsPort = process.env.WWEBJS_PORT || 3001;
  const url = `http://localhost:${wwebjsPort}/api/v2/messages/text/${encodeURIComponent(companyId)}/${encodeURIComponent(chatId)}`;
  try {
    const proxyRes = await axios.post(
      url,
      { message, phoneIndex },
      { timeout: 30000 }
    );'''
new_proxy = '''  // Proxy to the wwebjs process via our own internal endpoint that
  // does getNumberId() resolution first — avoids "Lid is missing in
  // chat table" for first-contact recipients.
  const wwebjsPort = process.env.WWEBJS_PORT || 3001;
  const url = `http://localhost:${wwebjsPort}/api/lead-forms/_internal/wwebjs-send`;
  const phoneDigits = String(toPhone || '').replace(/\D/g, '');
  try {
    const proxyRes = await axios.post(
      url,
      { companyId, phoneIndex, phone: phoneDigits, message },
      { timeout: 30000 }
    );'''
if new_proxy not in src and old_proxy in src:
    src = src.replace(old_proxy, new_proxy, 1)

open(path, 'w', encoding='utf-8').write(src)
print('✔ added _internal/wwebjs-send + repointed proxy URL')
PY

# Restart both processes — api needs the new code, wwebjs needs the new
# route too because that's where the actual send happens.
pm2 restart bisnesgpt-api > /dev/null
pm2 restart bisnesgpt-wwebjs > /dev/null
echo "✔ pm2 restarted bisnesgpt-api and bisnesgpt-wwebjs"
