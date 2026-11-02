import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminOk } from "@/lib/depot";
import Approvals from "./approvals";

export const metadata: Metadata = { title: "Depot Video Approvals", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: PageProps<"/depot/admin">) {
  const k = (await searchParams).k;
  if (typeof k !== "string" || !(await adminOk(k))) notFound();
  return <Approvals k={k} />;
}
