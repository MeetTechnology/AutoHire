import { NextRequest, NextResponse } from "next/server";

import {
  getAuditDashboardCookieName,
  verifyAuditDashboardCookie,
} from "@/lib/audit/auth";
import { jsonError } from "@/lib/http";
import {
  buildInvitationGenerationWorkbook,
  getInvitationGenerationBatchSummary,
} from "@/lib/invitations/generation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const isAuthorized = verifyAuditDashboardCookie(
    request.cookies.get(getAuditDashboardCookieName())?.value,
  );

  if (!isAuthorized) {
    return jsonError("A valid operations session is required.", 401, {
      code: "OPS_SESSION_REQUIRED",
    });
  }

  const { batchId } = await params;
  const batch = await getInvitationGenerationBatchSummary(batchId);

  if (!batch) {
    return jsonError("The invitation generation batch was not found.", 404, {
      code: "INVITATION_GENERATION_BATCH_NOT_FOUND",
    });
  }

  const workbook = buildInvitationGenerationWorkbook(batch);
  const filename = `invitation-tokens-${batch.id}.xlsx`;

  return new NextResponse(new Uint8Array(workbook), {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
