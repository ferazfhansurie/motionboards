import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/db";
import { neon } from "@neondatabase/serverless";

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

// GET — load boards for authenticated user
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({}, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({}, { status: 401 });

    const rows = await getSql()`SELECT data FROM mb_boards WHERE user_id = ${user.id}`;
    if (rows.length === 0) return NextResponse.json({});

    return NextResponse.json(rows[0].data);
  } catch (error) {
    console.error("Load boards error:", error);
    return NextResponse.json({}, { status: 500 });
  }
}

// POST — save boards for authenticated user
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const data = await req.json();

    await getSql()`
      INSERT INTO mb_boards (user_id, data, updated_at)
      VALUES (${user.id}, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET data = ${JSON.stringify(data)}::jsonb, updated_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save boards error:", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
