import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listWaMessages, workspaceForUser } from "@/lib/tickloop";

export async function GET(req: NextRequest) {
  const user = await requireUser(req); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Missing phone." }, { status: 400 });
  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  return NextResponse.json({ messages: await listWaMessages(workspace.id as string, phone) });
}
