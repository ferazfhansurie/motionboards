import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listWaContacts, workspaceForUser } from "@/lib/tickloop";

export async function GET(req: NextRequest) {
  const user = await requireUser(req); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  return NextResponse.json({ contacts: await listWaContacts(workspace.id as string) });
}
