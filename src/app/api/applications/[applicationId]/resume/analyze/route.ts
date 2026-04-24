import { NextRequest, NextResponse } from "next/server";

import {
  ApplicationServiceError,
  startInitialAnalysisFromLatestResume,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";
import { getResumeAnalysisErrorMessage } from "@/lib/resume-analysis/client";
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
    const job = await startInitialAnalysisFromLatestResume(applicationId);

    await trackEventFromRequest(request, {
      eventType: "analysis_started",
      applicationId,
      pageName: "apply_result",
      stepName: "analysis_result",
      actionName: "button_click",
      eventStatus: "SUCCESS",
      payload: {
        analysisJobId: job.id,
      },
    });

    return NextResponse.json({
      applicationId,
      analysisJobId: job.id,
      applicationStatus: "CV_ANALYZING",
    });
  } catch (error) {
    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    const message = getResumeAnalysisErrorMessage(error);

    await trackEventFromRequest(request, {
      eventType: "analysis_start_failed",
      applicationId,
      pageName: "apply_resume",
      stepName: "resume_upload",
      actionName: "button_click",
      eventStatus: "FAIL",
      errorCode: "ANALYSIS_START_FAILED",
      errorMessage: message,
    });

    return jsonError(message, 502, {
      code: "ANALYSIS_START_FAILED",
    });
  }
}
