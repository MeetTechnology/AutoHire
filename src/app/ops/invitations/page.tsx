import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { InvitationGeneratorPanel } from "@/features/invitations/components/invitation-generator-panel";
import {
  getAuditDashboardCookieName,
  verifyAuditDashboardCookie,
} from "@/lib/audit/auth";

export default async function InvitationsPage() {
  await connection();

  const cookieStore = await cookies();
  const isAuthorized = verifyAuditDashboardCookie(
    cookieStore.get(getAuditDashboardCookieName())?.value,
  );

  if (!isAuthorized) {
    notFound();
  }

  return <InvitationGeneratorPanel />;
}
