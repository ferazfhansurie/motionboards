import { NextRequest, NextResponse } from "next/server";
import { addMessage, depotSql as sql, workerOk } from "@/lib/depot";

// Worker on Faeez's Mac (~/aios/depot-video/worker.mjs). Header x-worker-key.
// GET  -> jobs to edit (queued) or publish (approved), oldest first; also a heartbeat.
// POST { jobId, op: claim|preview|done|fail, ... }
export async function GET(req: NextRequest) {
  if (!(await workerOk(req.headers.get("x-worker-key")))) return NextResponse.json({ error: "no" }, { status: 401 });
  await sql`INSERT INTO depot_state (key, value) VALUES ('worker_seen', ${String(Date.now())})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  const jobs = await sql`SELECT j.*, s.name AS site_name FROM depot_jobs j JOIN depot_sites s ON s.code = j.depot
    WHERE j.status IN ('queued','approved') ORDER BY j.updated_at LIMIT 5`;
  const pending = await sql`SELECT id, kind, depot, manager, instructions, capcut_name, done_version FROM depot_jobs
    WHERE status = 'pending' AND updated_at > now() - interval '2 days'`;
  return NextResponse.json({ jobs, pending });
}

export async function POST(req: NextRequest) {
  if (!(await workerOk(req.headers.get("x-worker-key")))) return NextResponse.json({ error: "no" }, { status: 401 });
  const b = await req.json();
  const id = String(b.jobId);
  const [job] = await sql`SELECT * FROM depot_jobs WHERE id = ${id}`;
  if (!job) return NextResponse.json({ error: "no job" }, { status: 404 });
  const depot = job.depot as string;

  if (b.op === "claim") {
    const r = await sql`UPDATE depot_jobs SET status = CASE WHEN status = 'queued' THEN 'working' ELSE 'publishing' END, updated_at = now()
      WHERE id = ${id} AND status IN ('queued','approved') RETURNING *`;
    return NextResponse.json({ job: r[0] ?? null });
  }
  if (b.op === "preview") {
    const stale = Number(b.version) < (job.version as number);
    await sql`UPDATE depot_jobs SET status = ${stale ? "queued" : "preview"}, done_version = ${Number(b.version)},
      preview_url = ${b.previewUrl}, spec = ${JSON.stringify(b.spec ?? null)}::jsonb, capcut_name = ${b.capcutName ?? null}, updated_at = now()
      WHERE id = ${id}`;
    if (!stale) await addMessage(depot, "bot", String(b.reply || "Here's your preview 👇"), { jobId: id, mediaUrl: b.previewUrl });
    return NextResponse.json({ ok: true, stale });
  }
  if (b.op === "done") {
    await sql`UPDATE depot_jobs SET status = 'done', drive_url = ${b.driveUrl}, updated_at = now() WHERE id = ${id}`;
    await addMessage(depot, "bot", `✅ Approved by Faeez! Your ${job.kind === "poster" ? "poster" : "video"} is on Google Drive:\n${b.driveUrl}`, { jobId: id });
    return NextResponse.json({ ok: true });
  }
  // poster bot needs more details (job stays open, the next message re-queues it) / message wasn't a poster request (job closed)
  if (b.op === "ask" || b.op === "close") {
    await sql`UPDATE depot_jobs SET status = ${b.op === "ask" ? "waiting" : "closed"}, spec = COALESCE(${b.spec ? JSON.stringify(b.spec) : null}::jsonb, spec), updated_at = now() WHERE id = ${id}`;
    if (b.reply) await addMessage(depot, "bot", String(b.reply), { jobId: id });
    return NextResponse.json({ ok: true });
  }
  if (b.op === "fail") {
    await sql`UPDATE depot_jobs SET status = ${b.status === "approved" ? "approved" : "failed"}, note = ${String(b.error || "").slice(0, 500)}, updated_at = now() WHERE id = ${id}`;
    if (b.reply) await addMessage(depot, "bot", String(b.reply), { jobId: id });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "bad op" }, { status: 400 });
}
