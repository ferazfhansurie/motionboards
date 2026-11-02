import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminCount, adminFromCookie, adminOk } from "@/lib/depot";
import Approvals from "./approvals";
import AdminLogin from "./login";

export const metadata: Metadata = { title: "Depot Video Admin", robots: { index: false, follow: false } };

// Admin accounts only. The admin key (?k=) is used once, to create the first admin.
export default async function Page({ searchParams }: PageProps<"/depot/admin">) {
  const admin = await adminFromCookie((await cookies()).get(ADMIN_COOKIE)?.value);
  if (admin) return <Approvals me={admin.name} />;
  const k = (await searchParams).k;
  const setupKey = typeof k === "string" && (await adminCount()) === 0 && (await adminOk(k)) ? k : null;
  return <AdminLogin setupKey={setupKey} />;
}
