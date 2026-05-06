import type { NextRequest } from "next/server";

import { requireApplicationSession } from "@/lib/auth/access";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { validateSessionAccess } from "@/lib/application/service";
import { getApplicationById } from "@/lib/data/store";
import {
  MaterialSupplementServiceError,
  SUPPLEMENT_EXPERT_ERROR_CODES,
} from "@/lib/material-supplement/errors";

export async function assertSupplementAccess(input: {
  request: NextRequest;
  applicationId: string;
}) {
  const access = await requireApplicationSession(
    input.request,
    input.applicationId,
  );

  if (access) {
    if (access.application.applicationStatus !== "SUBMITTED") {
      throw new MaterialSupplementServiceError({
        message:
          "The application has not been finally submitted and cannot enter the supplement flow.",
        status: 409,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.APPLICATION_NOT_SUBMITTED,
      });
    }

    return access;
  }

  const sessionCookie = input.request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(sessionCookie);

  if (!session) {
    throw new MaterialSupplementServiceError({
      message: "The current session is missing or invalid.",
      status: 401,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.UNAUTHORIZED,
    });
  }

  if (session.applicationId !== input.applicationId) {
    throw new MaterialSupplementServiceError({
      message: "The current session is not authorized to access this application.",
      status: 403,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.FORBIDDEN,
    });
  }

  const application = await getApplicationById(input.applicationId);

  if (!application) {
    throw new MaterialSupplementServiceError({
      message: "The application could not be found.",
      status: 404,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.APPLICATION_NOT_FOUND,
    });
  }

  const validated = await validateSessionAccess({
    applicationId: input.applicationId,
    invitationId: session.invitationId,
  });

  if (!validated) {
    throw new MaterialSupplementServiceError({
      message: "The current session is not authorized to access this application.",
      status: 403,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.FORBIDDEN,
    });
  }

  if (application.applicationStatus !== "SUBMITTED") {
    throw new MaterialSupplementServiceError({
      message:
        "The application has not been finally submitted and cannot enter the supplement flow.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.APPLICATION_NOT_SUBMITTED,
    });
  }

  return {
    application,
    session,
  };
}
