import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/db";

// GET /api/api-keys — list this user's API keys (safe metadata only,
// never echoes the full token).
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const keys = await listApiKeys(user.id);
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
    })),
  });
}

// POST /api/api-keys — create a new API key. Returns the FULL plaintext
// token exactly once. The caller must surface it to the user immediately
// because it cannot be retrieved later.
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name : "";

  const result = await createApiKey(user.id, name);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    apiKey: {
      id: result.apiKey.id,
      name: result.apiKey.name,
      prefix: result.apiKey.prefix,
      createdAt: result.apiKey.createdAt,
    },
    fullKey: result.fullKey,
  });
}

// DELETE /api/api-keys?id=apikey_xxx — soft-revoke a key.
export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const ok = await revokeApiKey(user.id, id);
  if (!ok) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
