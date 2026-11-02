import { NextRequest, NextResponse } from "next/server";
import { checkPass, depotSql as sql, hashPass, normPhone, startSession } from "@/lib/depot";

// POST /api/depot/auth { action: "register" | "login", depot?, name?, phone, password }
// The one shared link (/depot): staff pick their depot when they register; login finds it from the account.
// Returns the depot's chat token so the page can send them to /depot/<token>.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
  const phone = normPhone(b.phone);
  const password = String(b.password || "");

  if (b.action === "register") {
    const [site] = await sql`SELECT code, token FROM depot_sites WHERE code = ${String(b.depot || "")}`;
    if (!site) return fail("Pick your depot");
    const name = String(b.name || "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (name.length < 2) return fail("Enter your name");
    if (!phone) return fail("Enter a valid Malaysian phone number, e.g. 012-345 6789");
    if (password.length < 6) return fail("Password must be at least 6 characters");
    const r = await sql`INSERT INTO depot_users (depot, name, phone, pass_hash) VALUES (${site.code}, ${name}, ${phone}, ${hashPass(password)})
      ON CONFLICT (phone) DO NOTHING RETURNING id`;
    if (!r[0]) return fail("This phone number already has an account. Log in instead.", 409);
    const res = NextResponse.json({ ok: true, token: site.token });
    await startSession(res, Number(r[0].id));
    return res;
  }

  if (b.action === "login") {
    if (!phone) return fail("Enter a valid Malaysian phone number, e.g. 012-345 6789");
    const [u] = await sql`SELECT u.id, u.pass_hash, u.disabled, d.token FROM depot_users u JOIN depot_sites d ON d.code = u.depot WHERE u.phone = ${phone}`;
    if (!u || !checkPass(password, u.pass_hash as string)) return fail("Wrong phone number or password", 401);
    if (u.disabled) return fail("This account has been turned off. Please contact Faeez.", 403);
    const res = NextResponse.json({ ok: true, token: u.token });
    await startSession(res, Number(u.id));
    return res;
  }
  return fail("bad action");
}
