// Snapshot of all wwebjs phones — see which is connected and where 0210 stands.
require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});
(async () => {
  const r = await p.query(
    `SELECT p.company_id, p.phone_index, p.connection_type, p.wwebjs_enabled, p.wwebjs_status,
            p.status, p.display_phone_number, c.name AS company_name, p.updated_at
     FROM phone_configs p
     LEFT JOIN companies c ON c.company_id = p.company_id
     WHERE p.connection_type = 'wwebjs' OR p.wwebjs_enabled = true
     ORDER BY p.company_id, p.phone_index`
  );
  console.log(`=== wwebjs-enabled phones (${r.rowCount}) ===`);
  r.rows.forEach((row) => {
    console.log(
      `- ${row.company_id} (${row.company_name}) ph=${row.phone_index} ${row.display_phone_number || '(no number)'}\n` +
      `  connection_type=${row.connection_type} wwebjs_enabled=${row.wwebjs_enabled} wwebjs_status=${row.wwebjs_status} status=${row.status}\n` +
      `  updated_at=${row.updated_at?.toISOString?.()}`
    );
  });
  process.exit(0);
})();
