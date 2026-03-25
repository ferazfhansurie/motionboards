import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, addCredits } from "@/lib/db";
import { neon } from "@neondatabase/serverless";

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = await getUserFromToken(token);
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { email, credits } = await req.json();
    if (!email || !credits || credits <= 0) {
      return NextResponse.json({ error: "Email and credits amount required" }, { status: 400 });
    }

    // Find user by email
    const rows = await getSql()`SELECT id FROM mb_users WHERE LOWER(email) = LOWER(${email})`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = await addCredits(rows[0].id as string, credits);
    return NextResponse.json({ success: true, user: { email, credits: user?.credits } });
  } catch (error) {
    console.error("Topup error:", error);
    return NextResponse.json({ error: "Topup failed" }, { status: 500 });
  }
}
