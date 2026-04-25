import { NextRequest, NextResponse } from "next/server";

import {
  ApplicationServiceError,
  confirmExtractionAndStartEligibilityJudgment,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";
import {
  ResumeAnalysisError,
  getResumeAnalysisErrorMessage,
} from "@/lib/resume-analysis/client";
import { trackEventFromRequest } from "@/lib/tracking/service";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError(
      "The current session is not authorized to access this application.",
      403,
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      extractionRawResponse?: unknown;
    };
    const extractionRawResponse =
      typeof body.extractionRawResponse === "string"
        ? body.extractionRawResponse
        : undefined;

    const result =
      await confirmExtractionAndStartEligibilityJudgment(applicationId, {
        extractionRawResponse,
      });

    await trackEventFromRequest(request, {
      eventType: "resume_extraction_confirmed",
      applicationId,
      pageName: "apply_resume",
      stepName: "resume_extraction",
      actionName: "button_click",
      eventStatus: "SUCCESS",
      payload: {
        analysisJobId: result.analysisJobId,
      },
    });

    return NextResponse.json({
      applicationId,
      ...result,
    });
  } catch (error) {
    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    const message = getResumeAnalysisErrorMessage(error);
    const status =
      error instanceof ResumeAnalysisError && error.httpStatus
        ? error.httpStatus
        : 502;
    const code =
      error instanceof ResumeAnalysisError
        ? error.failureCode
        : "JUDGMENT_START_FAILED";

    await trackEventFromRequest(request, {
      eventType: "eligibility_judgment_start_failed",
      applicationId,
      pageName: "apply_resume",
      stepName: "resume_extraction",
      actionName: "button_click",
      eventStatus: "FAIL",
      errorCode: "JUDGMENT_START_FAILED",
      errorMessage: message,
    });

    return jsonError(message, status, {
      code,
    });
  }
}
