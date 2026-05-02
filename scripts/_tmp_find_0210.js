// Find every place "0210" might be stored — companies, split_test_variations,
// any other table with that company-style id. Print enough context to know
// exactly which row holds the AI assistant instructions to update.
require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});

(async () => {
  try {
    // 1. List candidate tables that might hold company-scoped instructions.
    const tables = await p.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' " +
      "AND (table_name ILIKE '%instruct%' OR table_name ILIKE '%assistant%' " +
      "OR table_name ILIKE '%compan%' OR table_name ILIKE '%split%' " +
      "OR table_name ILIKE '%prompt%' OR table_name ILIKE '%bot%') ORDER BY table_name"
    );
    console.log("=== candidate tables ===");
    console.log(tables.rows.map((r) => r.table_name).join("\n"));

    // 2. Look in split_test_variations for company_id 0210.
    const variations = await p.query(
      "SELECT id, company_id, name, is_active, LEFT(instructions, 200) AS preview, " +
      "LENGTH(instructions) AS len, created_at FROM split_test_variations " +
      "WHERE company_id = $1 ORDER BY is_active DESC, created_at DESC",
      ["0210"]
    );
    console.log("\n=== split_test_variations for 0210 (" + variations.rowCount + " rows) ===");
    variations.rows.forEach((r) => {
      console.log(`- id=${r.id} active=${r.is_active} name="${r.name}" len=${r.len}`);
      console.log(`  preview: ${r.preview?.replace(/\n/g, " ⏎ ").slice(0, 180)}`);
    });

    // 3. Check companies table for the row's metadata.
    const companies = await p.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='companies' AND table_schema='public' ORDER BY ordinal_position"
    );
    console.log("\n=== companies columns ===");
    console.log(companies.rows.map((r) => r.column_name).join(", "));

    const co = await p.query(
      "SELECT * FROM companies WHERE id = $1 LIMIT 1",
      ["0210"]
    );
    console.log("\n=== companies row for 0210 ===");
    if (co.rowCount === 0) {
      console.log("(no row)");
    } else {
      const row = co.rows[0];
      // Print a compact view — only string-y columns, truncated.
      Object.entries(row).forEach(([k, v]) => {
        const display = typeof v === "string" ? (v.length > 200 ? v.slice(0, 200) + "…" : v) : v;
        console.log(`${k}: ${JSON.stringify(display)?.slice(0, 220)}`);
      });
    }

  } catch (e) {
    console.error("ERROR", e.message);
  }
  process.exit(0);
})();
