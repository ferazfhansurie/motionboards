require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});
(async () => {
  try {
    const r = await p.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%instruct%' OR table_name ILIKE '%assistant%' OR table_name ILIKE '%compan%' OR table_name ILIKE '%split%') ORDER BY table_name"
    );
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (e) { console.error("ERROR", e.message); }
  process.exit(0);
})();
