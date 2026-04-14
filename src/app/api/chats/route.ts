import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, listChats, createChat } from "@/lib/db";

// GET /api/chats — list all chats for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const chats = await listChats(user.id);
    return NextResponse.json({ chats });
  } catch (error) {
    console.error("List chats error:", error);
    return NextResponse.json({ error: "Failed to load chats" }, { status: 500 });
  }
}

// POST /api/chats — create a new chat
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New Chat";
    const chat = await createChat(user.id, title);
    return NextResponse.json({ chat });
  } catch (error) {
    console.error("Create chat error:", error);
    return NextResponse.json({ error: "Failed to create chat" }, { status: 500 });
  }
}
