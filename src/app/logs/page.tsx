import Link from "next/link";
import { cookies } from "next/headers";
import { getUserFromToken, isAdmin } from "@/lib/db";
import LogsClient from "./logs-client";

export default async function LogsPage() {
  const store = await cookies();
  const token = store.get("session")?.value;
  const user = token ? await getUserFromToken(token) : null;

  if (!isAdmin(user)) {
    return (
      <div className="min-h-screen bg-[#08131f] text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold mb-2">Admin access required</h1>
          <p className="text-sm text-neutral-400 mb-6">
            This page is restricted. Sign in with the operator account to view generation logs and registered users.
          </p>
          <Link
            href="/generate"
            className="inline-flex items-center rounded-lg bg-[#f26522] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d9541a] transition-colors"
          >
            Back to app
          </Link>
        </div>
      </div>
    );
  }

  return <LogsClient />;
}
