require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});
(async () => {
  const r = await p.query(
    "SELECT id, label, fb_form_id, is_active FROM lead_form_subscriptions WHERE company_id = '0210'"
  );
  console.log(JSON.stringify(r.rows, null, 2));
  process.exit(0);
})();
