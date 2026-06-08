import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromToken,
  listFathopesChats,
  getFathopesChat,
  upsertFathopesChat,
  deleteFathopesChat,
} from "@/lib/db";

async function requireUser(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  return (await getUserFromToken(token)) ?? null;
}

// GET /api/fathopes/chats          -> list the user's threads
// GET /api/fathopes/chats?id=...   -> one thread (with full data)
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const chat = await getFathopesChat(id, user.id);
    if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ chat });
  }
  const chats = await listFathopesChats(user.id);
  return NextResponse.json({ chats });
}

// POST /api/fathopes/chats  -> create or update a thread.
// Body: { id?, title, data }
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const b = await req.json().catch(() => ({}));
    const saved = await upsertFathopesChat(user.id, { id: b.id, title: String(b.title || "New chat"), data: b.data ?? {} });
    return NextResponse.json({ chat: saved });
  } catch (e) {
    console.error("fathopes chat save error:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

// DELETE /api/fathopes/chats?id=...
export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ok = await deleteFathopesChat(id, user.id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
