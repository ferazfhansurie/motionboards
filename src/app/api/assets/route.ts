import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, listAssets, createAssetRequest } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const assets = await listAssets(user.id);
    return NextResponse.json({ assets });
  } catch (err) {
    console.error("Assets GET error:", err);
    return NextResponse.json({ error: "Failed to load assets" }, { status: 500 });
  }
}

// Create a real-human character REQUEST. Users don't get an asset_id here —
// an operator verifies the face on the company ByteDance account and fills it
// in later via PATCH. Body carries the reference photos to verify against.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const body = (await req.json()) as {
      name?: string;
      refPhotoIds?: string[];
      note?: string;
      thumbFileId?: string | null;
    };
    const refPhotoIds = Array.isArray(body.refPhotoIds) ? body.refPhotoIds.filter((x) => typeof x === "string") : [];
    if (refPhotoIds.length === 0) {
      return NextResponse.json({ error: "At least one reference photo is required" }, { status: 400 });
    }
    const asset = await createAssetRequest(user.id, {
      name: body.name || "Untitled",
      refPhotoIds,
      note: body.note || "",
      thumbFileId: body.thumbFileId || null,
    });
    return NextResponse.json({ asset });
  } catch (err) {
    console.error("Assets POST error:", err);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
