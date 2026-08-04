import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listConnections, workspaceForUser } from "@/lib/tickloop";

export async function GET(req: NextRequest) {
  const user = await requireUser(req); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const workspace = await workspaceForUser(user.id, `${user.name}'s workspace`);
  return NextResponse.json({ workspace, connections: await listConnections(workspace.id as string) });
}
