import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, listFolders, createFolder } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const folders = await listFolders(user.id);
    return NextResponse.json({ folders });
  } catch (err) {
    console.error("Folders GET error:", err);
    return NextResponse.json({ error: "Failed to load folders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const { name } = (await req.json()) as { name?: string };
    const folder = await createFolder(user.id, name || "Untitled");
    return NextResponse.json({ folder });
  } catch (err) {
    console.error("Folders POST error:", err);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}
