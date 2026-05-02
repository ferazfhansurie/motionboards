import type { NextRequest } from "next/server";
import { getUserFromApiKey, getUserFromToken, type User } from "./db";

/**
 * Resolve the caller from an incoming request. Accepts EITHER:
 *
 *   1. Session cookie: `Cookie: session=<token>`  (browser)
 *   2. Bearer API key:  `Authorization: Bearer mb_xxx`  (MCP / scripts / automations)
 *
 * Returns the User if either path resolves, or `null` if the caller is anonymous.
 */
export async function requireUser(req: NextRequest): Promise<User | null> {
  // Bearer takes precedence — explicit headers are intentional, cookies are ambient.
  const auth = req.headers.get("authorization");
  if (auth) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const token = match[1].trim();
      if (token) {
        const user = await getUserFromApiKey(token);
        if (user) return user;
        return null; // Bearer was provided but invalid — don't silently fall through to cookie
      }
    }
  }

  const cookieToken = req.cookies.get("session")?.value;
  if (cookieToken) {
    const user = await getUserFromToken(cookieToken);
    if (user) return user;
  }

  return null;
}
