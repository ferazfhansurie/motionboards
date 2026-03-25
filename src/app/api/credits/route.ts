import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, addCredits } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = await getUserFromToken(token);
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { userId, amount } = await req.json();
    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: "Valid userId and amount required" }, { status: 400 });
    }

    const user = await addCredits(userId, Math.round(amount));
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, credits: user.credits },
    });
  } catch (error) {
    console.error("Credits error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
