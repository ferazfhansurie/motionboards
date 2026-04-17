import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, listBoardVersions, createBoardVersion } from "@/lib/db";

// Large snapshots can take a moment to serialize + write
export const maxDuration = 60;

// GET /api/board-versions — list the user's snapshots (without the heavy data field)
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const versions = await listBoardVersions(user.id);
    return NextResponse.json({ versions });
  } catch (error) {
    console.error("List board versions error:", error);
    return NextResponse.json({ error: "Failed to load versions" }, { status: 500 });
  }
}

// POST /api/board-versions — create a new snapshot
//
// Body: { data, label? }
//   data: same shape as /api/boards ({ boards, activeBoardId, selectedModelId })
//   label: optional human-readable tag; defaults to timestamp
//
// Accepts gzipped bodies via Content-Encoding: gzip so huge canvases
// (many boards, long prompts) stay under Vercel's 4.5MB request limit.
// JSON typically compresses ~85% — a 4MB snapshot becomes ~600KB.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Decompress if the client sent a gzipped body
    let body: { data?: unknown; label?: string };
    const encoding = req.headers.get("content-encoding");
    if (encoding === "gzip" && req.body) {
      try {
        const decompressed = req.body.pipeThrough(new DecompressionStream("gzip"));
        const text = await new Response(decompressed).text();
        body = JSON.parse(text);
      } catch (err) {
        console.error("Failed to decompress snapshot body:", err);
        return NextResponse.json({ error: "Malformed gzipped body" }, { status: 400 });
      }
    } else {
      body = await req.json();
    }
    if (!body?.data) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const data = body.data as { boards?: unknown[] };
    const boards = Array.isArray(data.boards) ? data.boards : [];
    const itemCount = boards.reduce(
      (sum: number, b: { items?: unknown[] }) => sum + (Array.isArray(b.items) ? b.items.length : 0),
      0
    );
    const boardCount = boards.length;

    const label = (typeof body.label === "string" && body.label.trim())
      ? body.label.trim().slice(0, 80)
      : `Auto ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;

    const version = await createBoardVersion(user.id, body.data, label, itemCount, boardCount);
    // Don't ship the full snapshot data back — just the summary
    return NextResponse.json({
      version: {
        id: version.id,
        label: version.label,
        itemCount: version.itemCount,
        boardCount: version.boardCount,
        createdAt: version.createdAt,
      },
    });
  } catch (error) {
    console.error("Create board version error:", error);
    return NextResponse.json({ error: "Failed to save version" }, { status: 500 });
  }
}
