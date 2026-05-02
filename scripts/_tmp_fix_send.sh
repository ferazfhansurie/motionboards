#!/bin/bash
# Patch routes/leadForms.js so sendAutoReply falls through to the
# BullMQ wwebjs queue when the direct send throws "WhatsApp client
# not found". The wwebjs process already has a worker registered
# (server-wwebjs.js → createWwebjsWorker) that reads jobs of the form
#   { companyId, phoneIndex, messageData: { to, message } }
# and dispatches via the in-process WhatsApp client.
#
# Without this patch, lead-form sends from the api process always
# failed because global.botMap only exists in the wwebjs process.
set -euo pipefail
cd /home/firaz/backend/bisnesgpt-server

if grep -q 'addWwebjsMessage' routes/leadForms.js; then
  echo "· already patched"
  exit 0
fi

python3 - <<'PY'
path = 'routes/leadForms.js'
src = open(path, 'r', encoding='utf-8').read()
needle = """async function sendAutoReply({ companyId, phoneIndex, toPhone, message }) {
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
}"""

assert needle in src, "anchor sendAutoReply not found"

replacement = """// Try the direct WhatsAppService path first (works cross-process for
// the official Meta Cloud API — dialog360 talks HTTPS, not in-process).
// If we hit "WhatsApp client not found", that means it's a wwebjs
// company and the client lives in the bisnesgpt-wwebjs process — fall
// through to the BullMQ queue that process has a worker for.
function tryLoadQueue() {
  try { return require('../src/services/messaging/queue'); }
  catch (err) {
    console.warn('[leadForms] messaging queue not available:', err.message);
    return null;
  }
}
const messagingQueue = tryLoadQueue();

async function sendAutoReply({ companyId, phoneIndex, toPhone, message }) {
  const chatId = toWaChatId(toPhone);
  if (!chatId) throw new Error('lead has no phone number');

  // Path 1 — direct via WhatsAppService. For official Cloud API
  // companies this is a real HTTPS call to Meta and finishes here.
  // For wwebjs companies it throws "WhatsApp client not found"
  // (the client only exists in the wwebjs process), and we fall
  // through to the queue.
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
      const msg = String(err && err.message || '');
      const looksLikeWwebjsGap = /whatsapp client not found|client not found|bot.*not ready|not initialised/i.test(msg);
      if (!looksLikeWwebjsGap) throw err;
      // else fall through to the queue
    }
  }

  // Path 2 — enqueue for the wwebjs worker.
  if (!messagingQueue || !messagingQueue.addWwebjsMessage) {
    throw new Error('messaging queue not available — cannot route to wwebjs');
  }
  const job = await messagingQueue.addWwebjsMessage({
    companyId,
    phoneIndex,
    messageData: { to: chatId, message },
  });
  return { transport: 'queue', jobId: job.id };
}"""

src = src.replace(needle, replacement, 1)
open(path, 'w', encoding='utf-8').write(src)
print('✔ patched sendAutoReply with queue fallback')
PY

pm2 restart bisnesgpt-api > /dev/null
echo "✔ pm2 restart bisnesgpt-api"
