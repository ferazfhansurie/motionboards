import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Inter } from "next/font/google";
import { listSites, SESSION_COOKIE, sessionUser } from "@/lib/depot";
import Join from "./join";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = { title: "FatHopes Video Bot", robots: { index: false, follow: false } };

// /depot: the one link every depot uses. Signed in → straight to your depot's chat.
export default async function Page() {
  const jar = await cookies();
  const user = await sessionUser(jar.get(SESSION_COOKIE)?.value);
  if (user) redirect(`/depot/${user.token}`);
  return <div className={inter.variable}><Join sites={await listSites()} returning={jar.has("depot_reg")} /></div>;
}
