require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const CID = '154593';

  // Overall stats
  const totalMsgs = await sql`SELECT COUNT(*)::int AS n FROM messages WHERE company_id = ${CID}`;
  const fromMe = await sql`SELECT COUNT(*)::int AS n FROM messages WHERE company_id = ${CID} AND from_me = TRUE`;
  const fromCust = await sql`SELECT COUNT(*)::int AS n FROM messages WHERE company_id = ${CID} AND from_me = FALSE`;
  console.log(`total messages: ${totalMsgs[0].n}`);
  console.log(`  bot (from_me=true): ${fromMe[0].n}`);
  console.log(`  customer (from_me=false): ${fromCust[0].n}`);

  const totalContacts = await sql`SELECT COUNT(*)::int AS n FROM contacts WHERE company_id = ${CID}`;
  const contactsWithMsgs = await sql`
    SELECT COUNT(DISTINCT contact_id)::int AS n FROM messages WHERE company_id = ${CID}
  `;
  console.log(`\ntotal contacts: ${totalContacts[0].n}`);
  console.log(`contacts with at least 1 message: ${contactsWithMsgs[0].n}`);
  console.log(`contacts with 0 messages: ${totalContacts[0].n - contactsWithMsgs[0].n}`);

  // Specific UMAQ CLASSIC contact
  console.log('\n--- UMAQ CLASSIC (+60192070806) ---');
  const umaq = await sql`SELECT contact_id, name, phone, last_updated FROM contacts WHERE company_id = ${CID} AND phone LIKE '%192070806%'`;
  console.log(JSON.stringify(umaq, null, 2));

  for (const c of umaq) {
    const msgs = await sql`
      SELECT timestamp, from_me, chat_id, LEFT(content, 80) AS content
      FROM messages WHERE contact_id = ${c.contact_id} ORDER BY timestamp ASC LIMIT 30
    `;
    console.log(`\nmessages for ${c.contact_id} (${msgs.length}):`);
    for (const m of msgs) {
      console.log(`  [${m.timestamp?.toISOString?.().slice(0,16)}] ${m.from_me ? 'BOT ' : 'CUST'} chat=${m.chat_id} "${m.content}"`);
    }
  }

  // Top contacts by msg count — see if sync got some populated more than others
  const top = await sql`
    SELECT contact_id, COUNT(*)::int AS n,
      SUM(CASE WHEN from_me THEN 1 ELSE 0 END)::int AS bot,
      SUM(CASE WHEN NOT from_me THEN 1 ELSE 0 END)::int AS cust
    FROM messages WHERE company_id = ${CID}
    GROUP BY contact_id
    ORDER BY n DESC LIMIT 15
  `;
  console.log('\ntop 15 contacts by msg count (total / bot / cust):');
  for (const t of top) console.log(`  ${t.contact_id}  ${t.n}  (bot=${t.bot} cust=${t.cust})`);
})();
