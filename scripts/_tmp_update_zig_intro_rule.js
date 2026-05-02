// Zig's existing prompt says "intro only once per conversation". The
// lead-form auto-reply now sends Zig's hook BEFORE the bot ever
// fires, so when the user replies the bot's "first reply" rule must
// NOT re-introduce. Tighten the rule explicitly so the AI looks at
// the conversation history and detects an already-sent intro.
require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});

const OLD_INTRO_BLOCK =
`## Introduction — ONLY ONCE per conversation

Send this intro as your VERY FIRST reply only. Never repeat it again in the same conversation, even if they go quiet and come back later. Uses 1 "||".

"Hi, Zig here from Adletic Agency
||
we built MotionBoards — every AI video model (Sora, Veo, Nano Banana, Seedance, Kling) on one canvas, just RM10/month limited time. What kind of content tuan nak buat?"

After this, NEVER re-send the intro. NEVER re-ask what they do unless genuinely needed.`;

const NEW_INTRO_BLOCK =
`## Introduction — at MOST ONCE per conversation

Look at the conversation history BEFORE composing your reply.

If there is ANY prior from-me message in this thread that already mentions
"Zig" + "Adletic" OR "MotionBoards", the intro has already been delivered
(usually by the Facebook lead-form auto-reply that fires the moment the
lead submits). DO NOT re-introduce yourself. DO NOT re-pitch MotionBoards
from scratch. Just respond conversationally to whatever the user said,
treating it as mid-conversation.

ONLY when the thread has zero prior from-me messages, send this intro as
your very first reply. Uses 1 "||":

"Hi, Zig here from Adletic Agency
||
we built MotionBoards — every AI video model (Sora, Veo, Nano Banana, Seedance, Kling) on one canvas, just RM10/month limited time. What kind of content tuan nak buat?"

After the intro, NEVER re-send it. NEVER re-ask what they do unless genuinely needed.`;

(async () => {
  try {
    // Pull current text, run a string replace, push back. Sync both
    // companies.assistant_instructions and the active variation row.
    const cur = await p.query(
      "SELECT id, assistant_instructions FROM companies WHERE company_id = $1",
      ["0210"]
    );
    if (cur.rowCount === 0) {
      console.error("no row for 0210");
      process.exit(1);
    }
    const before = cur.rows[0].assistant_instructions;
    if (!before.includes(OLD_INTRO_BLOCK)) {
      console.error("OLD_INTRO_BLOCK not found verbatim — prompt may have been edited");
      console.error("first 60 chars of '## Introduction' section in current prompt:");
      const idx = before.indexOf("## Introduction");
      console.error(before.substr(idx, 200));
      process.exit(1);
    }
    const after = before.replace(OLD_INTRO_BLOCK, NEW_INTRO_BLOCK);

    await p.query(
      "UPDATE companies SET assistant_instructions = $1, updated_at = now() WHERE company_id = $2",
      [after, "0210"]
    );
    console.log(`✔ companies.assistant_instructions updated (len ${before.length} → ${after.length})`);

    const v = await p.query(
      "UPDATE split_test_variations SET instructions = $1 WHERE company_id = $2 AND is_active = true RETURNING id, name",
      [after, "0210"]
    );
    console.log(`✔ split_test_variations active row updated (${v.rowCount} row): ${v.rows.map(r => r.name).join(", ")}`);
  } catch (e) {
    console.error("ERROR", e.message);
    process.exit(1);
  }
  process.exit(0);
})();
