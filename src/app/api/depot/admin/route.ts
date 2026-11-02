import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { addMessage, currentAdmin, depotSql as sql, hashPass, normPhone, publicJob } from "@/lib/depot";

const OPEN = ["queued", "working", "preview", "pending", "rejected", "failed"];

// The admin page: signed-in admin accounts only (depot_admin cookie).
export async function GET(req: NextRequest) {
  if (!(await currentAdmin(req))) return NextResponse.json({ error: "Please log in again" }, { status: 401 });
  const chat = req.nextUrl.searchParams.get("chat");
  if (chat) { // one person's full chat, oldest first
    const messages = await sql`SELECT id, role, author, text, media_url, job_id, created_at FROM depot_messages
      WHERE user_id = ${Number(chat)} ORDER BY id DESC LIMIT 300`;
    return NextResponse.json({ messages: messages.reverse() });
  }
  const jobs = await sql`SELECT * FROM depot_jobs ORDER BY updated_at DESC LIMIT 100`;
  const sites = await sql`SELECT code, name, token, daily_limit FROM depot_sites ORDER BY code`;
  const users = await sql`SELECT u.id, u.depot, u.name, u.phone, u.disabled, u.created_at, u.last_seen,
    (SELECT count(*)::int FROM depot_jobs j WHERE j.user_id = u.id) AS videos,
    (SELECT max(m.created_at) FROM depot_messages m WHERE m.user_id = u.id) AS last_msg,
    (SELECT m.text FROM depot_messages m WHERE m.user_id = u.id ORDER BY m.id DESC LIMIT 1) AS last_text
    FROM depot_users u ORDER BY last_msg DESC NULLS LAST, u.depot, u.name`;
  const admins = await sql`SELECT id, name, phone, last_seen FROM depot_admins ORDER BY id`;
  return NextResponse.json({ jobs: jobs.map(publicJob), sites, users, admins });
}

export async function POST(req: NextRequest) {
  const admin = await currentAdmin(req);
  if (!admin) return NextResponse.json({ error: "Please log in again" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  // reply in someone's chat; with asEdit it also goes to their latest open video as a change
  if (b.action === "reply") {
    const [u] = await sql`SELECT id, depot FROM depot_users WHERE id = ${Number(b.userId)}`;
    if (!u) return NextResponse.json({ error: "No such person" }, { status: 404 });
    const text = String(b.text || "").trim().slice(0, 2000);
    const videoUrl = typeof b.videoUrl === "string" && b.videoUrl.startsWith("https://") ? b.videoUrl : null;
    if (!text && !videoUrl) return NextResponse.json({ error: "Empty message" }, { status: 400 });
    const userId = Number(u.id), depot = u.depot as string;
    if (b.asEdit) {
      if (!text) return NextResponse.json({ error: "Write the change" }, { status: 400 });
      const [open] = await sql`SELECT id FROM depot_jobs WHERE user_id = ${userId} AND status = ANY(${OPEN}) ORDER BY created_at DESC LIMIT 1`;
      if (!open) return NextResponse.json({ error: "They have no video in progress to change" }, { status: 409 });
      await sql`UPDATE depot_jobs SET instructions = instructions || ${JSON.stringify([{ text, at: new Date().toISOString(), by: admin.name }])}::jsonb,
        version = version + 1, status = CASE WHEN status = 'working' THEN 'working' ELSE 'queued' END, updated_at = now() WHERE id = ${open.id}`;
      await addMessage(depot, "admin", text, { jobId: open.id as string, author: admin.name, mediaUrl: videoUrl });
      await addMessage(depot, "bot", "Okay, making that change now ✏️\n\nThe new preview will be here shortly.", { jobId: open.id as string });
      return NextResponse.json({ ok: true });
    }
    await addMessage(depot, "admin", text, { userId, author: admin.name, mediaUrl: videoUrl });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "admin_add") {
    const phone = normPhone(b.phone), name = String(b.name || "").trim().slice(0, 60), pw = String(b.password || "");
    if (!name || !phone) return NextResponse.json({ error: "Enter a name and a Malaysian phone number" }, { status: 400 });
    if (pw.length < 8) return NextResponse.json({ error: "Admin password needs at least 8 characters" }, { status: 400 });
    const r = await sql`INSERT INTO depot_admins (name, phone, pass_hash) VALUES (${name}, ${phone}, ${hashPass(pw)}) ON CONFLICT (phone) DO NOTHING RETURNING id`;
    if (!r[0]) return NextResponse.json({ error: "That phone is already an admin" }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "admin_remove") {
    if (Number(b.adminId) === admin.id) return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 });
    await sql`DELETE FROM depot_admins WHERE id = ${Number(b.adminId)}`;
    return NextResponse.json({ ok: true });
  }
  if (b.action === "user_off" || b.action === "user_on") {
    const off = b.action === "user_off";
    await sql`UPDATE depot_users SET disabled = ${off} WHERE id = ${Number(b.userId)}`;
    if (off) await sql`DELETE FROM depot_sessions WHERE user_id = ${Number(b.userId)}`;
    return NextResponse.json({ ok: true });
  }
  if (b.action === "user_reset") {
    const pw = String(randomInt(100000, 1000000));
    await sql`UPDATE depot_users SET pass_hash = ${hashPass(pw)} WHERE id = ${Number(b.userId)}`;
    await sql`DELETE FROM depot_sessions WHERE user_id = ${Number(b.userId)}`;
    return NextResponse.json({ ok: true, password: pw });
  }
  const [job] = await sql`SELECT * FROM depot_jobs WHERE id = ${String(b.jobId)}`;
  if (!job) return NextResponse.json({ error: "no job" }, { status: 404 });
  if (b.action === "approve") {
    const r = await sql`UPDATE depot_jobs SET status = 'approved', updated_at = now()
      WHERE id = ${job.id} AND status IN ('pending','preview','rejected') RETURNING id`;
    if (!r[0]) return NextResponse.json({ error: `Can't approve a video that is ${job.status}` }, { status: 409 });
    await addMessage(job.depot as string, "bot", `${admin.name} approved it ✅\n\nUploading to Google Drive now…`, { jobId: job.id as string });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "change") {
    const note = String(b.note || "").trim().slice(0, 1000);
    if (!note) return NextResponse.json({ error: "Write what to change" }, { status: 400 });
    await sql`UPDATE depot_jobs SET instructions = instructions || ${JSON.stringify([{ text: note, at: new Date().toISOString(), by: admin.name }])}::jsonb,
      version = version + 1, status = CASE WHEN status = 'working' THEN 'working' ELSE 'queued' END, note = ${note}, updated_at = now() WHERE id = ${job.id}`;
    await addMessage(job.depot as string, "bot", `${admin.name} asked for a change ✏️\n\n"${note}"\n\nI'm fixing it now and will send a new preview.`, { jobId: job.id as string });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "bad action" }, { status: 400 });
}
