import { NextRequest, NextResponse } from "next/server";
import { addMessage, depotSql as sql, newJobId, publicJob, siteByToken, workerSeen } from "@/lib/depot";

// GET  /api/depot/<token>?after=<msgId>  -> { site, messages, jobs, workerOnline }
// POST /api/depot/<token> { name, text?, videoUrl?, action?: "submit", jobId? }
export async function GET(req: NextRequest, ctx: RouteContext<"/api/depot/[token]">) {
  const site = await siteByToken((await ctx.params).token);
  if (!site) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const after = Number(req.nextUrl.searchParams.get("after") || 0);
  const messages = await sql`SELECT id, job_id, role, author, text, media_url, created_at FROM depot_messages
    WHERE depot = ${site.code} AND id > ${after} ORDER BY id DESC LIMIT 200`;
  const jobs = await sql`SELECT * FROM depot_jobs WHERE depot = ${site.code} ORDER BY created_at DESC LIMIT 30`;
  const used = await sql`SELECT count(*)::int AS n FROM depot_jobs WHERE depot = ${site.code}
    AND (created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date = (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date`;
  return NextResponse.json({
    site: { code: site.code, name: site.name, limit: site.dailyLimit, usedToday: used[0].n },
    messages: messages.reverse(), jobs: jobs.map(publicJob),
    workerOnline: Date.now() - (await workerSeen()) < 120_000,
  });
}

const OPEN = ["queued", "working", "preview", "pending", "rejected", "failed"];

export async function POST(req: NextRequest, ctx: RouteContext<"/api/depot/[token]">) {
  const site = await siteByToken((await ctx.params).token);
  if (!site) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 40) || "Depot";
  const text = String(b.text || "").trim().slice(0, 1000);
  const videoUrl = typeof b.videoUrl === "string" && b.videoUrl.startsWith("https://") ? b.videoUrl : null;
  const now = new Date().toISOString();

  if (b.action === "submit" && b.jobId) {
    const r = await sql`UPDATE depot_jobs SET status = 'pending', updated_at = now()
      WHERE id = ${b.jobId} AND depot = ${site.code} AND status IN ('preview','rejected') RETURNING id`;
    if (!r[0]) return NextResponse.json({ error: "This video can't be sent for approval right now" }, { status: 409 });
    await addMessage(site.code, "user", "✅ Looks good, send to Faeez for approval", { jobId: b.jobId, author: name });
    await addMessage(site.code, "bot", "Sent to Faeez for approval 👍 You'll get the Google Drive link here once he approves.", { jobId: b.jobId });
    return NextResponse.json({ ok: true });
  }

  if (videoUrl) {
    const used = await sql`SELECT count(*)::int AS n FROM depot_jobs WHERE depot = ${site.code}
      AND (created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date = (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date`;
    if (Number(used[0].n) >= site.dailyLimit) {
      await addMessage(site.code, "bot", `You've reached today's limit of ${site.dailyLimit} videos for ${site.code}. Please send it again tomorrow 🙏`);
      return NextResponse.json({ ok: true, limited: true });
    }
    const id = newJobId();
    const instr = [{ text: text || "Add captions", at: now }];
    await sql`INSERT INTO depot_jobs (id, depot, manager, status, video_url, instructions)
      VALUES (${id}, ${site.code}, ${name}, 'queued', ${videoUrl}, ${JSON.stringify(instr)}::jsonb)`;
    await addMessage(site.code, "user", text, { jobId: id, author: name, mediaUrl: videoUrl });
    const online = Date.now() - (await workerSeen()) < 120_000;
    await addMessage(site.code, "bot", online
      ? "Got your video 🎬 I'm editing it now. The preview will be here in a few minutes."
      : "Got your video 🎬 The editor is offline right now, so it will start as soon as it's back on. I'll post the preview here.", { jobId: id });
    return NextResponse.json({ ok: true, jobId: id });
  }

  if (!text) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  const open = await sql`SELECT id, status FROM depot_jobs WHERE depot = ${site.code} AND status = ANY(${OPEN})
    ORDER BY created_at DESC LIMIT 1`;
  await addMessage(site.code, "user", text, { jobId: (open[0]?.id as string) ?? null, author: name });
  if (!open[0]) {
    await addMessage(site.code, "bot", "Send me a video first 🎬 Tap the 📎 button, pick your video, and tell me what to add (for example: \"add captions\" or \"add title KUTIP MINYAK at the start\").");
    return NextResponse.json({ ok: true });
  }
  await sql`UPDATE depot_jobs SET instructions = instructions || ${JSON.stringify([{ text, at: now }])}::jsonb,
    version = version + 1, status = CASE WHEN status = 'working' THEN 'working' ELSE 'queued' END, updated_at = now()
    WHERE id = ${open[0].id}`;
  await addMessage(site.code, "bot", "Okay, making that change now ✏️ The new preview will be here shortly.", { jobId: open[0].id as string });
  return NextResponse.json({ ok: true, jobId: open[0].id });
}
