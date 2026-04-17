import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, getBoardExportJob, deleteBoardExportJob } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/board-exports/:id — single job (used for polling status)
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
    const job = await getBoardExportJob(id, user.id);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (error) {
    console.error("Get board export error:", error);
    return NextResponse.json({ error: "Failed to load export" }, { status: 500 });
  }
}

// DELETE /api/board-exports/:id — remove a job (doesn't delete the underlying file;
// that's handled by the mb_files 14-day TTL sweep).
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
    const ok = await deleteBoardExportJob(id, user.id);
    if (!ok) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete board export error:", error);
    return NextResponse.json({ error: "Failed to delete export" }, { status: 500 });
  }
}
