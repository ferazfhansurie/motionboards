import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, getBoardVersion, deleteBoardVersion } from "@/lib/db";

export const maxDuration = 60;

// GET /api/board-versions/:id — fetch a single snapshot with the full data payload
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
    const version = await getBoardVersion(id, user.id);
    if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
    return NextResponse.json({ version });
  } catch (error) {
    console.error("Get board version error:", error);
    return NextResponse.json({ error: "Failed to load version" }, { status: 500 });
  }
}

// DELETE /api/board-versions/:id — remove a snapshot
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
    const ok = await deleteBoardVersion(id, user.id);
    if (!ok) return NextResponse.json({ error: "Version not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete board version error:", error);
    return NextResponse.json({ error: "Failed to delete version" }, { status: 500 });
  }
}
