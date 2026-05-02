// One-off: add credits to a user. Usage:
//   node --env-file=.env.local scripts/topup.mjs <email> <ringgit>
// e.g. node --env-file=.env.local scripts/topup.mjs admin@adleticagency.com 500
import { neon } from "@neondatabase/serverless";

const [email, ringgitArg] = process.argv.slice(2);
if (!email || !ringgitArg) {
  console.error("usage: node --env-file=.env.local scripts/topup.mjs <email> <ringgit>");
  process.exit(1);
}
const ringgit = Number(ringgitArg);
if (!Number.isFinite(ringgit) || ringgit <= 0) {
  console.error(`invalid ringgit amount: ${ringgitArg}`);
  process.exit(1);
}
const cents = Math.round(ringgit * 100);

const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  UPDATE mb_users
  SET credits = credits + ${cents}
  WHERE LOWER(email) = LOWER(${email})
  RETURNING id, email, credits
`;
if (rows.length === 0) {
  console.error(`no user with email ${email}`);
  process.exit(1);
}
const u = rows[0];
console.log(`✓ Added RM${ringgit.toFixed(2)} to ${u.email}`);
console.log(`  New balance: RM${(u.credits / 100).toFixed(2)} (${u.credits} cents)`);
