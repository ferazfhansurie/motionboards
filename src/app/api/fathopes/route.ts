import { NextRequest, NextResponse } from "next/server";
import {
  listFathopesMedia,
  createFathopesMedia,
  deleteFathopesMedia,
  getUserFromToken,
} from "@/lib/db";
import { deleteR2Objects } from "@/lib/r2";

// GET /api/fathopes — public list of all gallery media.
export async function GET() {
  try {
    const items = await listFathopesMedia();
    return NextResponse.json({ items });
  } catch (e) {
    console.error("fathopes list error:", e);
    return NextResponse.json({ items: [], error: "Failed to load" }, { status: 500 });
  }
}

async function requireUser(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  return (await getUserFromToken(token)) ?? null;
}

// POST /api/fathopes — register an already-uploaded R2 object (auth required).
// Body: { src, thumb, ratio, category, type, name }
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const b = await req.json().catch(() => ({}));
    if (!b.src || !b.thumb) return NextResponse.json({ error: "Missing src/thumb" }, { status: 400 });
    const item = await createFathopesMedia({
      src: String(b.src),
      thumb: String(b.thumb),
      ratio: Number(b.ratio) || 1,
      category: String(b.category || "Uncategorised"),
      type: b.type === "video" ? "video" : "image",
      name: String(b.name || ""),
    });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("fathopes create error:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

// DELETE /api/fathopes?id=... — remove a row and purge its R2 objects (auth required).
export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const removed = await deleteFathopesMedia(id);
    if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Best-effort R2 cleanup (don't fail the request if a key is already gone).
    await deleteR2Objects([removed.src, removed.thumb]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("fathopes delete error:", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
