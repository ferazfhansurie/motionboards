#!/bin/bash
# Apply the lead-forms migration, install routes/leadForms.js, patch
# server.js to mount it, and pm2-restart bisnesgpt-api so the new
# routes go live. Idempotent — safe to re-run.
set -euo pipefail
cd /home/firaz/backend/bisnesgpt-server

# 1. Migration — apply via the same pool the server uses.
echo "→ applying migration"
node - <<'JS'
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const sql = fs.readFileSync('/tmp/lead_forms_migration.sql', 'utf8');
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});
  try {
    await p.query(sql);
    console.log('  ✔ migration applied');
  } catch (e) {
    console.error('  ✖ migration failed:', e.message);
    process.exit(1);
  }
  process.exit(0);
})();
JS

# 2. Drop the route file in place.
echo "→ installing routes/leadForms.js"
cp /tmp/leadForms.js routes/leadForms.js
echo "  ✔ written: $(wc -l < routes/leadForms.js) lines"

# 3. Patch server.js — add require + two app.use lines if not already there.
echo "→ patching server.js mount"
if ! grep -q "require('./routes/leadForms')" server.js; then
  # Insert after the templatesRouter mount (well-known anchor).
  python3 - <<'PY'
import re, sys, io
path = 'server.js'
src = open(path, 'r', encoding='utf-8').read()
needle = 'app.use("/api/templates", templatesRouter);'
if needle not in src:
    sys.exit('anchor app.use("/api/templates", ...) not found')
patch = (
  needle + '\n'
  '\n'
  '// Lead Forms — Facebook Lead Ads → bisnesgpt auto-reply (added)\n'
  'const leadFormsRouter = require("./routes/leadForms");\n'
  'app.use("/api/lead-forms", leadFormsRouter);\n'
  'app.use("/webhook/leadgen", leadFormsRouter.webhookRouter);\n'
)
src = src.replace(needle, patch, 1)
open(path, 'w', encoding='utf-8').write(src)
PY
  echo "  ✔ server.js patched"
else
  echo "  · server.js already patched"
fi

# 4. Restart the api process so the new routes take effect.
echo "→ pm2 restart bisnesgpt-api"
pm2 restart bisnesgpt-api > /dev/null

echo "✔ lead-forms install complete"
