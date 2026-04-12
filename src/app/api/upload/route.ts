import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, putFile } from "@/lib/db";

export const maxDuration = 60;

// POST /api/upload — accepts a multipart file upload, stores it as bytea in Neon
// (mb_files), and returns an absolute URL pointing at /api/files/:id.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const { id } = await putFile(buffer, mimeType, user.id);

    const url = `${req.nextUrl.origin}/api/files/${id}`;
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    const msg = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
