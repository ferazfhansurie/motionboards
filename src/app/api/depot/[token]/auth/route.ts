import { NextRequest, NextResponse } from "next/server";
import { checkPass, currentUser, depotSql as sql, endSession, hashPass, normPhone, siteByToken, startSession } from "@/lib/depot";

// POST /api/depot/<token>/auth { action: "register" | "login" | "logout", name?, phone?, password? }
export async function POST(req: NextRequest, ctx: RouteContext<"/api/depot/[token]/auth">) {
  const site = await siteByToken((await ctx.params).token);
  if (!site) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

  if (b.action === "logout") {
    const res = NextResponse.json({ ok: true });
    await endSession(req, res);
    return res;
  }

  const phone = normPhone(b.phone);
  const password = String(b.password || "");
  if (!phone) return fail("Enter a valid Malaysian phone number, e.g. 012-345 6789");

  if (b.action === "register") {
    const name = String(b.name || "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (name.length < 2) return fail("Enter your name");
    if (password.length < 6) return fail("Password must be at least 6 characters");
    const r = await sql`INSERT INTO depot_users (depot, name, phone, pass_hash) VALUES (${site.code}, ${name}, ${phone}, ${hashPass(password)})
      ON CONFLICT (phone) DO NOTHING RETURNING id`;
    if (!r[0]) return fail("This phone number already has an account. Log in instead.", 409);
    const res = NextResponse.json({ ok: true });
    await startSession(res, Number(r[0].id));
    return res;
  }

  if (b.action === "login") {
    const [u] = await sql`SELECT id, depot, pass_hash, disabled FROM depot_users WHERE phone = ${phone}`;
    if (!u || !checkPass(password, u.pass_hash as string)) return fail("Wrong phone number or password", 401);
    if (u.disabled) return fail("This account has been turned off. Please contact Faeez.", 403);
    if (u.depot !== site.code) return fail(`This account is for the ${u.depot} depot. Please open your own depot's link.`, 403);
    const res = NextResponse.json({ ok: true });
    await startSession(res, Number(u.id));
    return res;
  }

  if (b.action === "me") return NextResponse.json({ user: await currentUser(req, site.code) });
  return fail("bad action");
}
