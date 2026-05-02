// Replace the existing Motionboards form's auto_reply_template on 0210
// with Zig's opening-hook copy. Keep the same {{name}} token so the
// lead's name from the FB form payload still substitutes in.
require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});

const NEW_TEMPLATE =
  "Hi {{name}}! Zig here from Adletic Agency.\n\n" +
  "We just got your details from FB — thanks for reaching out.\n\n" +
  "Quick context: we built MotionBoards — every AI video model (Sora, " +
  "Veo, Nano Banana, Seedance, Kling) in one canvas. RM10/month limited " +
  "time (was RM100).\n\n" +
  "What kind of content tuan nak buat — ads, social posts, or storyboards?\n\n" +
  "Reply here and I'll walk you through it.";

(async () => {
  try {
    const r = await p.query(
      "UPDATE lead_form_subscriptions SET auto_reply_template = $1, updated_at = now() " +
      "WHERE company_id = $2 AND label = 'Motionboards' RETURNING id, label, LENGTH(auto_reply_template) AS len",
      [NEW_TEMPLATE, "0210"]
    );
    console.log(`✔ updated ${r.rowCount} row(s):`);
    r.rows.forEach((row) => {
      console.log(`  - ${row.id} ${row.label} (len=${row.len})`);
    });
  } catch (e) {
    console.error("ERROR", e.message);
    process.exit(1);
  }
  process.exit(0);
})();
