// Confirm where the Motionboards form was saved + show what 765943 has.
require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});

(async () => {
  const subs = await p.query(
    `SELECT id, company_id, fb_form_id, fb_page_id, label, is_active, created_at
     FROM lead_form_subscriptions
     ORDER BY created_at DESC LIMIT 20`
  );
  console.log("=== all lead_form_subscriptions (newest first) ===");
  subs.rows.forEach(r => {
    console.log(`- company_id=${r.company_id} label="${r.label}" form=${r.fb_form_id} page=${r.fb_page_id} active=${r.is_active} created=${r.created_at?.toISOString?.()}`);
  });

  const ent = await p.query(
    `SELECT id, company_id, fb_form_id, full_name, delivery_status, created_at
     FROM lead_form_entries ORDER BY created_at DESC LIMIT 10`
  );
  console.log("\n=== recent lead_form_entries ===");
  ent.rows.forEach(r => {
    console.log(`- company_id=${r.company_id} form=${r.fb_form_id} name=${r.full_name} status=${r.delivery_status} ${r.created_at?.toISOString?.()}`);
  });

  // Also figure out which user maps to 765943 vs 0210, so we can tell the user
  // why their view shows a different company.
  const cos = await p.query(
    `SELECT company_id, name, email, status FROM companies
     WHERE company_id IN ('0210','765943')`
  );
  console.log("\n=== companies 0210 and 765943 ===");
  cos.rows.forEach(r => {
    console.log(`- company_id=${r.company_id} name="${r.name}" email=${r.email} status=${r.status}`);
  });

  process.exit(0);
})();
