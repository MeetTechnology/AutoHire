import { NextRequest, NextResponse } from "next/server";

import { refreshAnalysisState } from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { getApplicationById, getLatestAnalysisJob } from "@/lib/data/store";
import { jsonError } from "@/lib/http";
import { trackEventFromRequest } from "@/lib/tracking/service";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError(
      "The current session is not authorized to access this application.",
      403,
    );
  }

  const previousApplication = await getApplicationById(applicationId);
  const previousJob = await getLatestAnalysisJob(applicationId);
  const status = await refreshAnalysisState(applicationId);

  if (!status) {
    return jsonError("No analysis job has been created yet.", 404);
  }

  if (
    status.jobStatus === "COMPLETED" &&
    !previousApplication?.analysisCompletedAt
  ) {
    await trackEventFromRequest(request, {
      eventType: "analysis_completed",
      applicationId,
      pageName: "apply_result",
      stepName: "analysis_result",
      actionName: "page_view",
      eventStatus: "SUCCESS",
    });
  }

  if (status.jobStatus === "FAILED" && previousJob?.jobStatus !== "FAILED") {
    await trackEventFromRequest(request, {
      eventType: "analysis_failed",
      applicationId,
      pageName: "apply_result",
      stepName: "analysis_result",
      actionName: "page_view",
      eventStatus: "FAIL",
      errorCode: "analysis_trigger_failed",
      errorMessage: status.errorMessage ?? null,
    });
  }

  return NextResponse.json({
    applicationId,
    ...status,
  });
}
