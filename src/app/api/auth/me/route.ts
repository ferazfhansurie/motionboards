import { NextRequest, NextResponse } from "next/server";
import { getSubscription } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const subscription = await getSubscription(user.id);
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, credits: user.credits, role: user.role },
    subscription,
  });
}
