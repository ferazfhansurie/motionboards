import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { addMessage, adminOk, depotSql as sql, hashPass, publicJob } from "@/lib/depot";

// Faeez's approvals page. Key in ?k= (GET) or body.k (POST).
export async function GET(req: NextRequest) {
  if (!(await adminOk(req.nextUrl.searchParams.get("k")))) return NextResponse.json({ error: "no" }, { status: 401 });
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
  return NextResponse.json({ jobs: jobs.map(publicJob), sites, users });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (!(await adminOk(b.k))) return NextResponse.json({ error: "no" }, { status: 401 });
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
    await addMessage(job.depot as string, "bot", "Faeez approved it ✅\n\nUploading to Google Drive now…", { jobId: job.id as string });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "change") {
    const note = String(b.note || "").trim().slice(0, 1000);
    if (!note) return NextResponse.json({ error: "Write what to change" }, { status: 400 });
    await sql`UPDATE depot_jobs SET instructions = instructions || ${JSON.stringify([{ text: note, at: new Date().toISOString(), by: "Faeez" }])}::jsonb,
      version = version + 1, status = CASE WHEN status = 'working' THEN 'working' ELSE 'queued' END, note = ${note}, updated_at = now() WHERE id = ${job.id}`;
    await addMessage(job.depot as string, "bot", `Faeez asked for a change ✏️\n\n"${note}"\n\nI'm fixing it now and will send a new preview.`, { jobId: job.id as string });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "bad action" }, { status: 400 });
}
