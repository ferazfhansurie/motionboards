import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, listUserFiles, deleteUserFile } from "@/lib/db";

// GET /api/media?from=YYYY-MM-DD&to=YYYY-MM-DD&before=<createdAt>&limit=40
// Returns the current user's uploaded + generated media (everything in
// mb_files) sorted newest-first, with cursor pagination so the library stays
// snappy even for power users with hundreds of outputs.
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "40"), 1), 100);
    const before = searchParams.get("before");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Normalize date strings (YYYY-MM-DD) to ISO start/end bounds so the
    // filter catches rows created anywhere during that day in UTC.
    const from = fromParam ? new Date(`${fromParam}T00:00:00Z`).toISOString() : null;
    const to = toParam ? new Date(`${toParam}T23:59:59.999Z`).toISOString() : null;

    const { files, nextCursor } = await listUserFiles(user.id, {
      limit,
      before: before || null,
      from,
      to,
    });
    return NextResponse.json({ files, nextCursor });
  } catch (err) {
    console.error("Media GET error:", err);
    return NextResponse.json({ error: "Failed to load media" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const ok = await deleteUserFile(id, user.id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Media DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
