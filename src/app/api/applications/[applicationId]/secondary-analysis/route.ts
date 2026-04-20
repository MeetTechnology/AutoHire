import { NextRequest, NextResponse } from "next/server";

import {
  ApplicationServiceError,
  startSecondaryAnalysis,
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
    const secondary = await startSecondaryAnalysis(applicationId);

    await trackEventFromRequest(request, {
      eventType: "secondary_analysis_triggered",
      applicationId,
      pageName: "apply_result",
      stepName: "secondary_analysis",
      actionName: "submit_confirm",
      eventStatus: "SUCCESS",
      payload: {
        runId: secondary.runId,
      },
    });

    return NextResponse.json(
      {
        applicationId,
        runId: secondary.runId,
        status: secondary.status,
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    return jsonError(getResumeAnalysisErrorMessage(error), 502, {
      code: "SECONDARY_ANALYSIS_START_FAILED",
    });
  }
}
