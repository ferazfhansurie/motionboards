// One-off: create admin@adleticagency.com with RM200 balance and admin role.
// Run with: node --env-file=.env.local scripts/create-admin.mjs
import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "node:crypto";

const EMAIL = "admin@adleticagency.com";
const NAME = "Adletic Admin";
const PASSWORD = "admin123";
const CREDITS_RM = 200;            // in ringgit
const CREDITS = CREDITS_RM * 100;  // store as cents

function hashPassword(p) {
  return createHash("sha256").update(p).digest("hex");
}

const sql = neon(process.env.DATABASE_URL);

const existing = await sql`SELECT id, credits, role FROM mb_users WHERE LOWER(email) = LOWER(${EMAIL})`;
if (existing.length > 0) {
  // User already exists — reset password, top up to RM200, ensure admin role
  const row = existing[0];
  const hash = hashPassword(PASSWORD);
  await sql`UPDATE mb_users SET credits = ${CREDITS}, role = 'admin', password_hash = ${hash} WHERE id = ${row.id}`;
  console.log(`✓ User already existed (${row.id}). Reset password to "${PASSWORD}", credits to RM${CREDITS_RM}, role=admin.`);
} else {
  const id = `user_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const hash = hashPassword(PASSWORD);
  await sql`
    INSERT INTO mb_users (id, name, email, password_hash, credits, role)
    VALUES (${id}, ${NAME}, ${EMAIL.toLowerCase()}, ${hash}, ${CREDITS}, 'admin')
  `;
  console.log(`✓ Created ${EMAIL} (id=${id})`);
  console.log(`  Credits: RM${CREDITS_RM} (${CREDITS} cents)`);
  console.log(`  Role:    admin`);
  console.log(`  Password: ${PASSWORD}  ← CHANGE THIS ON FIRST LOGIN`);
}
