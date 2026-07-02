import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, isAdmin, renameAsset, deleteAsset, updateAssetStatus, type AssetStatus } from "@/lib/db";

// PATCH handles two cases:
//   - operator resolves a request: body { status, assetId?, adminNote? } (admin only)
//   - requester/operator renames: body { name }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const { id } = await params;
    const body = (await req.json()) as { name?: string; status?: string; assetId?: string | null; adminNote?: string };
    const admin = isAdmin(user);

    if (body.status) {
      if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      const status = body.status as AssetStatus;
      if (!["pending", "completed", "failed"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      if (status === "completed" && !(body.assetId && body.assetId.trim())) {
        return NextResponse.json({ error: "assetId is required to mark completed" }, { status: 400 });
      }
      const ok = await updateAssetStatus(id, {
        status,
        assetId: body.assetId ? body.assetId.trim() : null,
        adminNote: body.adminNote || "",
      });
      if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    const ok = await renameAsset(id, user.id, body.name || "Untitled", admin);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Asset PATCH error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const { id } = await params;
    const ok = await deleteAsset(id, user.id, isAdmin(user));
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Asset DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
