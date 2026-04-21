import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, isAdmin, listUsers } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const users = await listUsers();
    // Strip passwordHash before returning to the client.
    const safe = users.map(({ passwordHash: _ph, ...rest }) => rest);
    return NextResponse.json({ users: safe });
  } catch (err) {
    console.error("Users list error:", err);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
