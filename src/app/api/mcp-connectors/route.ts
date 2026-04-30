import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromToken,
  getUserMcpConnectors,
  setUserMcpConnectors,
  type McpConnector,
} from "@/lib/db";

// Per-user MCP connector registry.
//
// Stored as a JSON array on mb_users (see db.ts). The /api/ai-prompt route
// reads this list, filters to enabled entries, and forwards them as
// `mcp_servers` on every Anthropic Claude call. That makes any third-party
// MCP server (Higgsfield, custom internal MCPs, etc.) callable as tools by
// ADletic in the user's chat.
//
// The shape is identical to the Anthropic mcp_servers parameter except
// camelCase here for consistency with the rest of the JSON API; the route
// translates `authorizationToken` → `authorization_token` at request time.

// GET /api/mcp-connectors — list this user's connectors.
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const connectors = await getUserMcpConnectors(user.id);
    return NextResponse.json({
      // Don't echo the bearer token back — it's a secret. UI only needs to
      // know whether one is set (boolean), not its value. If the user wants
      // to rotate it, they paste a fresh one.
      connectors: connectors.map((c) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        hasAuthorizationToken: !!c.authorizationToken,
        enabled: c.enabled,
      })),
    });
  } catch (error) {
    console.error("Get MCP connectors error:", error);
    return NextResponse.json({ error: "Failed to load connectors" }, { status: 500 });
  }
}

// PUT /api/mcp-connectors — replace this user's connectors atomically.
// Body: { connectors: McpConnector[] }
//
// We keep this as a full-replace endpoint instead of per-row CRUD because
// the list is short (<= 16) and the UI shows them all at once. A token
// field with the literal placeholder "__keep__" means "don't change the
// existing token for this id" — lets us avoid round-tripping secrets to
// the client.
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const incoming = Array.isArray(body.connectors) ? body.connectors : null;
    if (!incoming) {
      return NextResponse.json({ error: "Body must include connectors[]" }, { status: 400 });
    }

    // Pull the current list so we can preserve unchanged tokens.
    const existing = await getUserMcpConnectors(user.id);
    const existingTokens = new Map<string, string>();
    for (const c of existing) {
      if (c.authorizationToken) existingTokens.set(c.id, c.authorizationToken);
    }

    const next: McpConnector[] = [];
    for (const raw of incoming) {
      if (!raw || typeof raw !== "object") continue;
      const id = String(raw.id || `mcp_${Date.now()}_${next.length}`);
      const name = String(raw.name || "").trim();
      const url = String(raw.url || "").trim();
      if (!name || !url) continue;
      if (!/^https:\/\//i.test(url)) {
        return NextResponse.json(
          { error: `Connector "${name}" must use https://` },
          { status: 400 },
        );
      }

      // Token handling:
      //   • literal "__keep__" → preserve whatever was stored for this id
      //   • empty / null      → clear the token
      //   • any other string  → save as new token
      let authorizationToken: string | undefined;
      const incomingToken = raw.authorizationToken;
      if (incomingToken === "__keep__") {
        authorizationToken = existingTokens.get(id);
      } else if (typeof incomingToken === "string" && incomingToken.length > 0) {
        authorizationToken = incomingToken;
      } else {
        authorizationToken = undefined;
      }

      next.push({
        id,
        name: name.slice(0, 64),
        url: url.slice(0, 512),
        authorizationToken,
        enabled: raw.enabled !== false,
      });
    }

    await setUserMcpConnectors(user.id, next);

    // Echo back the same shape GET returns — never the actual tokens.
    return NextResponse.json({
      connectors: next.map((c) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        hasAuthorizationToken: !!c.authorizationToken,
        enabled: c.enabled,
      })),
    });
  } catch (error) {
    console.error("Save MCP connectors error:", error);
    return NextResponse.json({ error: "Failed to save connectors" }, { status: 500 });
  }
}
