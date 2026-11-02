import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, r2Config } from "@/lib/r2";
import { currentAdmin, depotSql as sql } from "@/lib/depot";

// GET /api/depot/templates/<id> -> the template file as a download (admins only)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin(req))) return NextResponse.json({ error: "Please log in again" }, { status: 401 });
  const [t] = await sql`SELECT file_url, filename, name FROM depot_templates WHERE id = ${Number((await ctx.params).id)}`;
  if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  const cfg = r2Config();
  const key = String(t.file_url).slice(cfg.publicBase.length + 1);
  const ext = key.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
  const fname = String(t.filename || `${t.name}${ext}`).replace(/["\\\r\n]/g, "");
  const url = await getSignedUrl(r2Client(), new GetObjectCommand({ Bucket: cfg.bucket, Key: key,
    ResponseContentDisposition: `attachment; filename="${fname.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fname)}` }), { expiresIn: 600 });
  return NextResponse.redirect(url, 302);
}
