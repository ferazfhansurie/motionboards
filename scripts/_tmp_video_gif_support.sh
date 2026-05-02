#!/bin/bash
# Make /_internal/wwebjs-send animate GIFs properly: when the uploaded
# media is video/* (MP4 or WebM), send with `sendVideoAsGif: true` so
# WhatsApp displays it as an animated GIF (loop, no audio control).
# Static images and image/gif still go through as MessageMedia
# unchanged — note that whatsapp-web.js often renders raw image/gif
# as a still image, which is why MP4-as-GIF is the canonical path.
set -euo pipefail
cd /home/firaz/backend/bisnesgpt-server

python3 - <<'PY'
path = 'routes/leadForms.js'
src = open(path, 'r', encoding='utf-8').read()

# Anchor: the single sendMessage line that handles the media path. We
# need to inspect the media's mimetype and pass sendVideoAsGif when it's
# video/*.
old = """        sent = await client.sendMessage(recipientId, media, { caption: message });
      } catch (mediaErr) {
        console.warn('[leadForms _internal/wwebjs-send] image attach failed, sending text-only:', mediaErr.message);"""

new = """        // WhatsApp animates GIFs only when sent as MP4 with
        // sendVideoAsGif: true. Static images and (best-effort)
        // image/gif go through unchanged.
        const mediaMime = (media && media.mimetype) || '';
        const sendOpts = { caption: message };
        if (mediaMime.startsWith('video/')) {
          sendOpts.sendVideoAsGif = true;
        }
        sent = await client.sendMessage(recipientId, media, sendOpts);
      } catch (mediaErr) {
        console.warn('[leadForms _internal/wwebjs-send] image attach failed, sending text-only:', mediaErr.message);"""

if new not in src:
    if old not in src:
        raise SystemExit('anchor for sendMessage media call not found')
    src = src.replace(old, new, 1)
    print('  ✔ video/* → sendVideoAsGif path added')
else:
    print('  · already patched')

open(path, 'w', encoding='utf-8').write(src)
PY

pm2 restart bisnesgpt-wwebjs > /dev/null
echo "✔ wwebjs restarted with video-as-gif support"
