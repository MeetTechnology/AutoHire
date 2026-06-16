import { NextRequest, NextResponse } from "next/server";

import {
  getAuditDashboardCookieName,
  verifyAuditDashboardCookie,
} from "@/lib/audit/auth";
import { jsonError, parseJsonBody } from "@/lib/http";
import {
  generateInvitationBatch,
  InvitationGenerationConflictError,
  invitationGenerationRequestSchema,
} from "@/lib/invitations/generation";

function isAuthorized(request: NextRequest) {
  return verifyAuditDashboardCookie(
    request.cookies.get(getAuditDashboardCookieName())?.value,
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return jsonError("A valid operations session is required.", 401, {
      code: "OPS_SESSION_REQUIRED",
    });
  }

  const body = await parseJsonBody<unknown>(request);
  const parsed = invitationGenerationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      "The invitation generation request payload is invalid.",
      400,
      {
        code: "INVITATION_GENERATION_INVALID_PAYLOAD",
        details: parsed.error.flatten(),
      },
    );
  }

  try {
    const batch = await generateInvitationBatch(parsed.data);

    return NextResponse.json({ batch });
  } catch (error) {
    if (error instanceof InvitationGenerationConflictError) {
      return jsonError(error.message, 409, {
        code: "INVITATION_GENERATION_IDEMPOTENCY_CONFLICT",
      });
    }

    throw error;
  }
}
