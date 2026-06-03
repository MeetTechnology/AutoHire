import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AuditDashboard } from "@/features/audit/audit-dashboard";
import {
  getAuditDashboardCookieName,
  verifyAuditDashboardCookie,
} from "@/lib/audit/auth";
import {
  getAuditDashboardSummary,
  resolveAuditRange,
} from "@/lib/audit/summary";

type AuditPageProps = {
  searchParams?: Promise<{
    range?: string;
  }>;
};

export default async function AuditPage({ searchParams }: AuditPageProps) {
  await connection();

  const cookieStore = await cookies();
  const isAuthorized = verifyAuditDashboardCookie(
    cookieStore.get(getAuditDashboardCookieName())?.value,
  );

  if (!isAuthorized) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const range = resolveAuditRange(resolvedSearchParams?.range);
  const summary = await getAuditDashboardSummary({ range });

  return <AuditDashboard summary={summary} range={range} />;
}
