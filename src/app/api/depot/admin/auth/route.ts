import { NextRequest, NextResponse } from "next/server";
import { adminCount, adminOk, checkPass, depotSql as sql, endAdminSession, hashPass, normPhone, startAdminSession } from "@/lib/depot";

// The first admin account can only be Faeez (the key link was posted in a WhatsApp group).
const OWNER_PHONE = "601121677672";

// POST /api/depot/admin/auth
//   { action: "login", phone, password }
//   { action: "setup", k, name, phone, password }  first admin only, needs the admin key
//   { action: "logout" }
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (b.action === "logout") {
    const res = NextResponse.json({ ok: true });
    await endAdminSession(req, res);
    return res;
  }
  const phone = normPhone(b.phone);
  const password = String(b.password || "");
  if (!phone) return NextResponse.json({ error: "Enter a Malaysian phone number, e.g. 012 345 6789" }, { status: 400 });

  if (b.action === "setup") {
    if (!(await adminOk(b.k)) || (await adminCount()) > 0) return NextResponse.json({ error: "Setup is closed. Log in instead." }, { status: 403 });
    if (phone !== OWNER_PHONE) return NextResponse.json({ error: "The first admin must be Faeez's number" }, { status: 403 });
    const name = String(b.name || "").trim().slice(0, 60);
    if (!name) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Admin password needs at least 8 characters" }, { status: 400 });
    const [a] = await sql`INSERT INTO depot_admins (name, phone, pass_hash) VALUES (${name}, ${phone}, ${hashPass(password)}) RETURNING id`;
    const res = NextResponse.json({ ok: true });
    await startAdminSession(res, Number(a.id));
    return res;
  }

  if (b.action === "login") {
    const [a] = await sql`SELECT id, pass_hash FROM depot_admins WHERE phone = ${phone}`;
    if (!a || !checkPass(password, a.pass_hash as string)) return NextResponse.json({ error: "Wrong phone number or password" }, { status: 401 });
    const res = NextResponse.json({ ok: true });
    await startAdminSession(res, Number(a.id));
    return res;
  }
  return NextResponse.json({ error: "bad action" }, { status: 400 });
}
