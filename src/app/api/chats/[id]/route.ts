import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, getChat, updateChat, deleteChat, type ChatMessage } from "@/lib/db";

// GET /api/chats/:id — fetch a single chat with full message history
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const chat = await getChat(id, user.id);
    if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    return NextResponse.json({ chat });
  } catch (error) {
    console.error("Get chat error:", error);
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 });
  }
}

// PATCH /api/chats/:id — update title or append/replace messages
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const updates: { title?: string; messages?: ChatMessage[] } = {};
    if (typeof body.title === "string") updates.title = body.title;
    if (Array.isArray(body.messages)) updates.messages = body.messages as ChatMessage[];

    const chat = await updateChat(id, user.id, updates);
    if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    return NextResponse.json({ chat });
  } catch (error) {
    console.error("Update chat error:", error);
    return NextResponse.json({ error: "Failed to update chat" }, { status: 500 });
  }
}

// DELETE /api/chats/:id — delete a chat
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const ok = await deleteChat(id, user.id);
    if (!ok) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete chat error:", error);
    return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}
