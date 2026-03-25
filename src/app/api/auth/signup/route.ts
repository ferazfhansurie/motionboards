import { NextRequest, NextResponse } from "next/server";
import { createUser, createSession } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const user = await createUser(name, email, password);
    if (!user) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const session = await createSession(user.id);
    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, credits: user.credits, role: user.role },
    });
    res.cookies.set("session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
