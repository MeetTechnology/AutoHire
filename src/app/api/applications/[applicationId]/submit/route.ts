import { NextRequest, NextResponse } from "next/server";

import {
  ApplicationServiceError,
  submitApplication,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";
import { trackEventFromRequest } from "@/lib/tracking/service";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError("The current session is not authorized to access this application.", 403);
  }

  try {
    const application = await submitApplication(applicationId);

    if (!application) {
      return jsonError("The application could not be found.", 404);
    }

    await trackEventFromRequest(request, {
      eventType: "application_submitted",
      applicationId,
      pageName: "apply_materials",
      stepName: "submit",
      actionName: "submit_confirm",
      eventStatus: "SUCCESS",
    });

    return NextResponse.json({
      applicationId,
      applicationStatus: application.applicationStatus,
      message:
        "We have received your materials and will respond within 1 to 3 business days.",
    });
  } catch (error) {
    await trackEventFromRequest(request, {
      eventType: "application_submit_failed",
      applicationId,
      pageName: "apply_materials",
      stepName: "submit",
      actionName: "submit_confirm",
      eventStatus: "FAIL",
      errorCode:
        error instanceof ApplicationServiceError ? error.code : "submit_failed",
      errorMessage:
        error instanceof Error ? error.message : "Application submit failed.",
    });
    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    throw error;
  }
}
