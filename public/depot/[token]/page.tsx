import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteByToken } from "@/lib/depot";
import DepotChat from "./chat";

export const metadata: Metadata = { title: "FatHopes Video Bot", robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps<"/depot/[token]">) {
  const { token } = await params;
  const site = await siteByToken(token);
  if (!site) notFound();
  return <DepotChat token={token} code={site.code} siteName={site.name} />;
}
