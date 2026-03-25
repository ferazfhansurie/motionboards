import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/db";

// Settings are now admin-only. Regular users don't need API keys.
export async function GET(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const user = token ? await getUserFromToken(token) : null;
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Return user info instead of API keys
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, credits: user.credits, role: user.role },
  });
}
