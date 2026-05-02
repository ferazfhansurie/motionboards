require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});
(async () => {
  const r = await p.query("SELECT assistant_instructions FROM companies WHERE company_id = $1", ["0210"]);
  console.log(r.rows[0]?.assistant_instructions || "(none)");
  process.exit(0);
})();
