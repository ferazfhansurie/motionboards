// Inspect phone_configs for 0210 + figure out which wwebjs session is
// "ready" (the wwebjs process logs say 1 of 9 is connected). We need
// the phone_index that 0210's WA is actually loaded under.
require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});

(async () => {
  // 1. phone_configs for 0210 — what columns exist + their values
  const cols = await p.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'phone_configs' ORDER BY ordinal_position"
  );
  console.log("=== phone_configs columns ===");
  console.log(cols.rows.map((r) => r.column_name).join(", "));

  const cfg = await p.query(
    "SELECT * FROM phone_configs WHERE company_id = $1 ORDER BY phone_index",
    ["0210"]
  );
  console.log(`\n=== phone_configs for 0210 (${cfg.rowCount} rows) ===`);
  cfg.rows.forEach((r) => {
    console.log(JSON.stringify(r, null, 2));
  });

  // 2. companies row — top-level connection columns
  const co = await p.query(
    "SELECT company_id, name, phone_count, phone_1, phone_2, phone_3, status, plan FROM companies WHERE company_id = $1",
    ["0210"]
  );
  console.log(`\n=== companies row for 0210 ===`);
  co.rows.forEach((r) => console.log(JSON.stringify(r, null, 2)));

  // 3. What other companies use wwebjs (so I can confirm the value to set)
  const types = await p.query(
    "SELECT connection_type, COUNT(*) AS n FROM phone_configs GROUP BY connection_type ORDER BY n DESC"
  );
  console.log(`\n=== distinct connection_type values across all phone_configs ===`);
  types.rows.forEach((r) => console.log(`- ${r.connection_type || '(null)'} : ${r.n}`));

  process.exit(0);
})();
