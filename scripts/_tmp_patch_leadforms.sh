#!/bin/bash
# Patch routes/leadForms.js with two new endpoints:
#   POST /api/lead-forms/:companyId/discover       — paste a Page or User
#       Access Token, get back the list of Pages owned + each Page's Lead
#       Forms. Replaces the user hunting for Form ID / Page ID across
#       Meta Ads Manager + Page Settings.
#   POST /api/lead-forms/:companyId/auto-subscribe — subscribe a Page to
#       leadgen events using the Page's own Access Token. Fires
#       automatically from the UI when the user picks a Page, so the
#       step-3-missed problem disappears.
#
# Inserts the handlers just before `module.exports = router;` so we
# don't disturb the existing routes. Idempotent.
set -euo pipefail
cd /home/firaz/backend/bisnesgpt-server

if grep -q "/discover'" routes/leadForms.js && grep -q "/auto-subscribe'" routes/leadForms.js; then
  echo "· already patched"
  exit 0
fi

python3 - <<'PY'
import sys, re
path = 'routes/leadForms.js'
src = open(path, 'r', encoding='utf-8').read()
anchor = 'module.exports = router;'
if anchor not in src:
    sys.exit('anchor `module.exports = router;` not found')

snippet = r"""
// ── /api/lead-forms/:companyId/discover ─────────────────────────────
//
// Paste any token (User token from Graph API Explorer OR a Page token)
// → we resolve the Pages the user can manage, then fetch each Page's
// Lead Forms in one round-trip. The UI uses the result to populate
// dropdowns instead of asking for raw IDs.
router.post('/:companyId/discover', async (req, res) => {
  const { accessToken } = req.body || {};
  if (!accessToken) return res.status(400).json({ error: 'accessToken required' });
  try {
    let pages = [];
    // First try as a User token — /me/accounts returns owned pages with
    // per-page tokens included. This is the happy path.
    try {
      const r = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
        params: { access_token: accessToken, fields: 'id,name,access_token,tasks', limit: 100 },
        timeout: 12000,
      });
      pages = (r.data && r.data.data) || [];
    } catch (e) {
      // Not a user token (or no pages_show_list scope) — fall back to
      // assuming it's a Page token and identify the page directly.
      pages = [];
    }
    if (pages.length === 0) {
      const me = await axios.get('https://graph.facebook.com/v19.0/me', {
        params: { access_token: accessToken, fields: 'id,name' },
        timeout: 10000,
      });
      pages = [{ id: me.data.id, name: me.data.name, access_token: accessToken }];
    }

    // Enrich each page with its lead forms. Failures per-page don't
    // poison the whole response — surface them inline.
    const enriched = await Promise.all(pages.map(async (p) => {
      try {
        const formsRes = await axios.get(
          `https://graph.facebook.com/v19.0/${p.id}/leadgen_forms`,
          {
            params: { access_token: p.access_token, fields: 'id,name,status,created_time', limit: 100 },
            timeout: 12000,
          }
        );
        return {
          id: p.id,
          name: p.name,
          access_token: p.access_token,
          forms: (formsRes.data && formsRes.data.data) || [],
        };
      } catch (err) {
        const msg = (err.response && err.response.data && err.response.data.error && err.response.data.error.message)
          || err.message;
        return { id: p.id, name: p.name, access_token: p.access_token, forms: [], error: msg };
      }
    }));

    res.json({ pages: enriched });
  } catch (err) {
    const msg = (err.response && err.response.data && err.response.data.error && err.response.data.error.message)
      || err.message;
    console.error('[leadForms] discover failed:', msg);
    res.status(400).json({ error: msg });
  }
});

// ── /api/lead-forms/:companyId/auto-subscribe ───────────────────────
//
// Subscribe a single Page to the App's `leadgen` field. This is the
// step that's most often missed — webhooks won't fire unless the Page
// itself is subscribed to the App. We do it in the background when the
// user picks a Page in the wizard.
router.post('/:companyId/auto-subscribe', async (req, res) => {
  const { pageId, pageAccessToken } = req.body || {};
  if (!pageId || !pageAccessToken) {
    return res.status(400).json({ error: 'pageId and pageAccessToken required' });
  }
  try {
    const r = await axios.post(
      `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: 'leadgen',
          access_token: pageAccessToken,
        },
        timeout: 12000,
      }
    );
    res.json({ ok: true, success: (r.data && r.data.success) || true });
  } catch (err) {
    const msg = (err.response && err.response.data && err.response.data.error && err.response.data.error.message)
      || err.message;
    console.error('[leadForms] auto-subscribe failed:', msg);
    res.status(400).json({ ok: false, error: msg });
  }
});

"""

src = src.replace(anchor, snippet + anchor, 1)
open(path, 'w', encoding='utf-8').write(src)
print("✔ inserted discover + auto-subscribe handlers")
PY

pm2 restart bisnesgpt-api > /dev/null
echo "✔ pm2 restart bisnesgpt-api"
