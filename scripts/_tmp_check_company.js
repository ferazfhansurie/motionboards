// Inspect the 0210 company row (matched by company_id, not id) and confirm
// where the live assistant instructions actually load from. The bot
// dispatcher might prefer split_test_variations.instructions for the
// active variation, OR companies.assistant_instructions — we need to know
// which to update so the change actually takes effect.
require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});

(async () => {
  try {
    const co = await p.query(
      "SELECT id, company_id, name, status, plan, phone_count, " +
      "       LEFT(assistant_instructions, 240) AS preview, " +
      "       LENGTH(assistant_instructions) AS len " +
      "FROM companies WHERE company_id = $1",
      ["0210"]
    );
    console.log(`=== companies WHERE company_id = '0210' (${co.rowCount} rows) ===`);
    co.rows.forEach((r) => {
      console.log(`id=${r.id}`);
      console.log(`company_id=${r.company_id}`);
      console.log(`name=${r.name}`);
      console.log(`status=${r.status} plan=${r.plan} phone_count=${r.phone_count}`);
      console.log(`assistant_instructions: len=${r.len}`);
      console.log(`preview: ${(r.preview || "").replace(/\n/g, " ⏎ ")}`);
    });

    // Also resolve the active variation pretty-printed.
    const active = await p.query(
      "SELECT id, name, is_active, LENGTH(instructions) AS len, " +
      "       LEFT(instructions, 400) AS preview " +
      "FROM split_test_variations WHERE company_id = $1 AND is_active = true",
      ["0210"]
    );
    console.log(`\n=== active split_test_variation for 0210 ===`);
    active.rows.forEach((r) => {
      console.log(`id=${r.id} name="${r.name}" len=${r.len}`);
      console.log(`preview:\n${r.preview}`);
    });
  } catch (e) {
    console.error("ERROR", e.message);
  }
  process.exit(0);
})();
