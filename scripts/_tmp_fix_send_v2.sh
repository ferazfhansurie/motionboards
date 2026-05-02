#!/bin/bash
# Replace the broken queue fallback in routes/leadForms.js with the
# established api→wwebjs HTTP proxy pattern. The wwebjs process
# exposes POST /api/v2/messages/text/:companyId/:chatId — server.js
# already uses it as the standard cross-process bridge for wwebjs
# sends from the api process.
set -euo pipefail
cd /home/firaz/backend/bisnesgpt-server

python3 - <<'PY'
path = 'routes/leadForms.js'
src = open(path, 'r', encoding='utf-8').read()

# Find the start and end of the (now-broken) queue version we patched
# in last attempt, and replace it wholesale.
start_marker = "// Try the direct WhatsAppService path first"
end_marker = "  return { transport: 'queue', jobId: job.id };\n}"
i = src.find(start_marker)
if i == -1:
    raise SystemExit("anchor 'Try the direct WhatsAppService path first' not found")
j = src.find(end_marker, i)
if j == -1:
    raise SystemExit("anchor end of queue-version sendAutoReply not found")
j += len(end_marker)

replacement = '''// sendAutoReply — chooses the right transport for whichever
// connection_type the company is on:
//   • Official Cloud API → WhatsAppService.sendText() works directly
//     from the api process (dialog360 talks HTTPS, no in-process
//     state needed).
//   • whatsapp-web.js → the WhatsApp client only lives in the
//     bisnesgpt-wwebjs process. We use the same internal proxy
//     pattern the rest of server.js uses: POST to
//     localhost:WWEBJS_PORT /api/v2/messages/text/:companyId/:chatId.
async function sendAutoReply({ companyId, phoneIndex, toPhone, message }) {
  const chatId = toWaChatId(toPhone);
  if (!chatId) throw new Error('lead has no phone number');

  // Try direct first — this only succeeds for official Cloud API
  // companies. For wwebjs we fall through on the well-known error.
  if (whatsappService) {
    try {
      const factory = whatsappService.getWhatsAppService || whatsappService.create || null;
      let svc;
      if (typeof factory === 'function') {
        svc = await factory(companyId, phoneIndex);
      } else if (whatsappService.WhatsAppService) {
        svc = new whatsappService.WhatsAppService(companyId, phoneIndex);
        if (svc.load) await svc.load();
      }
      if (svc) {
        const result = await svc.sendText(chatId, message);
        return { transport: 'direct', result };
      }
    } catch (err) {
      const msg = String((err && err.message) || '');
      const looksLikeWwebjsGap =
        /whatsapp client not found|client not found|bot.*not ready|not initialised|not initialized/i.test(msg);
      if (!looksLikeWwebjsGap) throw err;
      // fall through to the wwebjs proxy
    }
  }

  // Proxy to the wwebjs process. We're in the api process; localhost
  // routing is fine — they share the same box.
  const wwebjsPort = process.env.WWEBJS_PORT || 3001;
  const url = `http://localhost:${wwebjsPort}/api/v2/messages/text/${encodeURIComponent(companyId)}/${encodeURIComponent(chatId)}`;
  try {
    const proxyRes = await axios.post(
      url,
      { message, phoneIndex },
      { timeout: 30000 }
    );
    return { transport: 'wwebjs-proxy', status: proxyRes.status, data: proxyRes.data };
  } catch (proxyErr) {
    const status = proxyErr.response && proxyErr.response.status;
    const detail = (proxyErr.response && proxyErr.response.data && (proxyErr.response.data.error || JSON.stringify(proxyErr.response.data)))
      || proxyErr.message;
    throw new Error(`wwebjs proxy failed (HTTP ${status || 'n/a'}): ${detail}`);
  }
}'''

src = src[:i] + replacement + src[j:]
open(path, 'w', encoding='utf-8').write(src)
print('✔ replaced sendAutoReply with wwebjs HTTP proxy fallback')
PY

pm2 restart bisnesgpt-api > /dev/null
echo "✔ pm2 restart bisnesgpt-api"
