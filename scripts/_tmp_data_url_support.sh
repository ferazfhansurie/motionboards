#!/bin/bash
# Make /_internal/wwebjs-send accept BOTH data: URLs (uploaded files
# converted to base64 data URLs by the frontend) and regular https://
# URLs. data: URLs go straight into a MessageMedia(mime, base64) so
# uploaded images don't need any public hosting at all.
#
# Also bump express body limits on the api process so a 4 MB base64
# payload (~5.4 MB JSON) doesn't get rejected by the default 100 KB.
set -euo pipefail
cd /home/firaz/backend/bisnesgpt-server

python3 - <<'PY'
path = 'routes/leadForms.js'
src = open(path, 'r', encoding='utf-8').read()

old_block = '''    // If imageUrl supplied, send the image with the text as caption.
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
    }'''

new_block = '''    // Image attachment — accept BOTH data: URLs (uploaded file converted
    // to base64 by the frontend FileReader) AND regular http(s) URLs.
    //
    //   • data:image/png;base64,iVBORw…  → parse mime + base64 directly
    //     into a MessageMedia. No outbound HTTP needed; works for any
    //     image the user can pick on their device.
    //   • https://example.com/foo.jpg     → MessageMedia.fromUrl(...)
    //     fetches the bytes server-side.
    //
    // If anything in the media path explodes (bad mime, fetch fail, etc.)
    // we fall back to text-only so a broken upload doesn't kill delivery.
    const { imageUrl } = req.body || {};
    let sent;
    const trimmedImage = imageUrl && String(imageUrl).trim();
    if (trimmedImage) {
      try {
        const wweb = require('whatsapp-web.js');
        let media;
        if (trimmedImage.startsWith('data:')) {
          // Match `data:<mime>;base64,<data>` — anything else we treat as
          // malformed and fall through to text-only.
          const m = /^data:([^;,]+);base64,(.+)$/.exec(trimmedImage);
          if (!m) throw new Error('malformed data: URL — must be base64-encoded');
          const [, mime, b64] = m;
          media = new wweb.MessageMedia(mime, b64, 'attachment');
        } else {
          media = await wweb.MessageMedia.fromUrl(trimmedImage, { unsafeMime: true });
        }
        sent = await client.sendMessage(recipientId, media, { caption: message });
      } catch (mediaErr) {
        console.warn('[leadForms _internal/wwebjs-send] image attach failed, sending text-only:', mediaErr.message);
        sent = await client.sendMessage(recipientId, message);
      }
    } else {
      sent = await client.sendMessage(recipientId, message);
    }'''

if new_block not in src:
    if old_block not in src:
        raise SystemExit('anchor for image-attach block not found')
    src = src.replace(old_block, new_block, 1)
    print('  ✔ data: URL handling added')
else:
    print('  · already patched')

open(path, 'w', encoding='utf-8').write(src)
PY

# Bump express body limit on server.js so 4 MB base64 payloads fit.
# Idempotent — only changes if the default is still in place.
echo "→ checking express body limits"
python3 - <<'PY'
import re
path = 'server.js'
src = open(path, 'r', encoding='utf-8').read()
changes = 0

# Replace `app.use(express.json());` with `app.use(express.json({ limit: '8mb' }));`
def bump(pattern, replacement):
    global src, changes
    new = re.sub(pattern, replacement, src, count=1)
    if new != src:
        src = new
        changes += 1

bump(r"app\.use\(express\.json\(\)\)", "app.use(express.json({ limit: '8mb' }))")
bump(r"app\.use\(express\.urlencoded\(\{\s*extended:\s*true\s*\}\)\)",
     "app.use(express.urlencoded({ extended: true, limit: '8mb' }))")

open(path, 'w', encoding='utf-8').write(src)
print(f'  body-limit bumps applied: {changes}')
PY

pm2 restart bisnesgpt-api > /dev/null
pm2 restart bisnesgpt-wwebjs > /dev/null
echo "✔ data:URL support deployed"
