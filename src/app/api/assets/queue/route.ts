import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, isAdmin, listAllAssetRequests, getUserByEmail, adminCreateAsset } from "@/lib/db";

// Operator-only fulfillment queue: every real-human request across all users.
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const assets = await listAllAssetRequests();
    return NextResponse.json({ assets });
  } catch (err) {
    console.error("Assets queue GET error:", err);
    return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
  }
}

// Operator adds an EXISTING (already-verified) ByteDance group directly into a
// target account's library as Ready. Body: { email, name, assetId, refPhotoIds }.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const body = (await req.json()) as { email?: string; name?: string; assetId?: string; refPhotoIds?: string[] };
    if (!body.email?.trim()) return NextResponse.json({ error: "Assign-to email is required" }, { status: 400 });
    if (!body.assetId?.trim()) return NextResponse.json({ error: "asset_id is required" }, { status: 400 });
    const target = await getUserByEmail(body.email.trim());
    if (!target) return NextResponse.json({ error: `No account found for ${body.email.trim()}` }, { status: 404 });
    const refPhotoIds = Array.isArray(body.refPhotoIds) ? body.refPhotoIds.filter((x) => typeof x === "string") : [];
    const asset = await adminCreateAsset(target.id, {
      name: body.name || "Untitled",
      assetId: body.assetId.trim(),
      refPhotoIds,
    });
    return NextResponse.json({ asset });
  } catch (err) {
    console.error("Assets queue POST error:", err);
    return NextResponse.json({ error: "Failed to add group" }, { status: 500 });
  }
}
