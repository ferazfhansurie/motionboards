import { NextRequest, NextResponse } from "next/server";
import { addMessage, currentUser, depotSql as sql, newJobId, publicJob, siteByToken, workerSeen } from "@/lib/depot";

const HELP = `I edit videos and make event posters for you 🎬🖼️

Videos: tap 📎, pick your video, and tell me what to add.
Example: "add captions in BM and title JOM KITAR SEMULA at the start"

Posters: just tell me the date and the places.
Example: "poster kutipan Sabtu ni, Pasar Malam Kuah 4-8 malam, Masjid Al-Hana 9-12 pagi"`;
// greetings / questions about the bot, so they don't become edit instructions
const isChat = (t: string) =>
  /^(hi+|hai+|hello+|helo+|hey+|salam|assalamualaikum|test|testing|ok|okay|thanks?|thank you|terima kasih|tq)\b[\s!.?]*$/i.test(t.trim()) ||
  /(what can (you|u)|wat can|apa (yang )?(boleh|awak boleh|kau boleh)|how (do|to) (i )?use|macam mana (nak )?guna|help|tolong terangkan)/i.test(t);

// GET  /api/depot/<token>  -> { site, user, messages, jobs, workerOnline } (messages/jobs only when signed in)
// POST /api/depot/<token> { text?, videoUrl?, action?: "submit", jobId? }  (signed in)
export async function GET(req: NextRequest, ctx: RouteContext<"/api/depot/[token]">) {
  const site = await siteByToken((await ctx.params).token);
  if (!site) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const used = await sql`SELECT count(*)::int AS n FROM depot_jobs WHERE depot = ${site.code}
    AND (created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date = (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date`;
  const base = { site: { code: site.code, name: site.name, limit: site.dailyLimit, usedToday: used[0].n }, workerOnline: Date.now() - (await workerSeen()) < 120_000 };
  const user = await currentUser(req, site.code);
  if (!user) return NextResponse.json({ ...base, user: null, messages: [], jobs: [] });
  const messages = await sql`SELECT id, job_id, role, author, text, media_url, created_at FROM depot_messages
    WHERE user_id = ${user.id} ORDER BY id DESC LIMIT 200`;
  const jobs = await sql`SELECT * FROM depot_jobs WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 30`;
  const templates = await sql`SELECT id, name, note, file_url, content_type FROM depot_templates ORDER BY id DESC`;
  return NextResponse.json({ ...base, user: { name: user.name, phone: user.phone }, messages: messages.reverse(), jobs: jobs.map(publicJob), templates });
}

const OPEN = ["queued", "working", "preview", "pending", "rejected", "failed", "waiting"];
const POSTER = /\b(poster|posters|flyer|risalah|brosur|banner)\b/i;

export async function POST(req: NextRequest, ctx: RouteContext<"/api/depot/[token]">) {
  const site = await siteByToken((await ctx.params).token);
  if (!site) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const user = await currentUser(req, site.code);
  if (!user) return NextResponse.json({ error: "Please log in again" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = user.name;
  const text = String(b.text || "").trim().slice(0, 1000);
  const videoUrl = typeof b.videoUrl === "string" && b.videoUrl.startsWith("https://") ? b.videoUrl : null;
  const now = new Date().toISOString();

  if (b.action === "submit" && b.jobId) {
    const r = await sql`UPDATE depot_jobs SET status = 'pending', updated_at = now()
      WHERE id = ${b.jobId} AND user_id = ${user.id} AND status IN ('preview','rejected') RETURNING id`;
    if (!r[0]) return NextResponse.json({ error: "This video can't be sent for approval right now" }, { status: 409 });
    await addMessage(site.code, "user", "✅ Looks good, send to Faeez for approval", { jobId: b.jobId, author: name });
    await addMessage(site.code, "bot", "Sent to Faeez for approval 👍\n\nYou'll get the Google Drive link here once he approves.", { jobId: b.jobId });
    return NextResponse.json({ ok: true });
  }

  if (videoUrl) {
    const used = await sql`SELECT count(*)::int AS n FROM depot_jobs WHERE depot = ${site.code}
      AND (created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date = (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date`;
    if (Number(used[0].n) >= site.dailyLimit) {
      await addMessage(site.code, "bot", `You've reached today's limit of ${site.dailyLimit} videos for ${site.code}.\n\nPlease send it again tomorrow 🙏`, { userId: user.id });
      return NextResponse.json({ ok: true, limited: true });
    }
    const id = newJobId();
    const instr = [{ text: text || "Add captions", at: now }];
    await sql`INSERT INTO depot_jobs (id, depot, manager, status, video_url, instructions, user_id)
      VALUES (${id}, ${site.code}, ${name}, 'queued', ${videoUrl}, ${JSON.stringify(instr)}::jsonb, ${user.id})`;
    await addMessage(site.code, "user", text, { jobId: id, author: name, mediaUrl: videoUrl });
    const online = Date.now() - (await workerSeen()) < 120_000;
    await addMessage(site.code, "bot", online
      ? "Got your video 🎬\n\nI'm editing it now. The preview will be here in a few minutes."
      : "Got your video 🎬\n\nThe editor is offline right now, so it will start as soon as it's back on. I'll post the preview here.", { jobId: id });
    return NextResponse.json({ ok: true, jobId: id });
  }

  if (!text) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  const open = await sql`SELECT id, status, kind FROM depot_jobs WHERE user_id = ${user.id} AND status = ANY(${OPEN})
    ORDER BY created_at DESC LIMIT 1`;
  // no open job (or asking for a poster while a video is open): this message starts a poster job; the worker's AI
  // makes the poster, asks for missing details, or answers if it wasn't a poster request
  if (!isChat(text) && (!open[0] || (POSTER.test(text) && open[0].kind !== "poster"))) {
    const id = newJobId();
    await sql`INSERT INTO depot_jobs (id, depot, manager, status, kind, instructions, user_id)
      VALUES (${id}, ${site.code}, ${name}, 'queued', 'poster', ${JSON.stringify([{ text, at: now }])}::jsonb, ${user.id})`;
    await addMessage(site.code, "user", text, { jobId: id, author: name });
    const online = Date.now() - (await workerSeen()) < 120_000;
    if (!online) await addMessage(site.code, "bot", "Got it 👍\n\nThe editor is offline right now, I'll answer as soon as it's back on.", { jobId: id });
    return NextResponse.json({ ok: true, jobId: id });
  }
  await addMessage(site.code, "user", text, { jobId: (open[0]?.id as string) ?? null, author: name, userId: user.id });
  if (!open[0] || isChat(text)) {
    await addMessage(site.code, "bot", open[0] ? HELP : `${HELP}\n\nSend me a video or tell me about your event 👇`, { userId: user.id });
    return NextResponse.json({ ok: true });
  }
  await sql`UPDATE depot_jobs SET instructions = instructions || ${JSON.stringify([{ text, at: now }])}::jsonb,
    version = version + 1, status = CASE WHEN status = 'working' THEN 'working' ELSE 'queued' END, updated_at = now()
    WHERE id = ${open[0].id}`;
  if (open[0].status !== "waiting") await addMessage(site.code, "bot", "Okay, making that change now ✏️\n\nThe new preview will be here shortly.", { jobId: open[0].id as string });
  return NextResponse.json({ ok: true, jobId: open[0].id });
}
