import { NextRequest, NextResponse } from "next/server";

import { getSecondaryAnalysisSnapshot } from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";
import { getPublicResumeAnalysisErrorMessage } from "@/lib/resume-analysis/client";
import { syncAutoSecondaryForApplication } from "@/lib/resume-analysis/direct-secondary";

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

  try {
    await syncAutoSecondaryForApplication(applicationId).catch(() => null);
    const snapshot = await getSecondaryAnalysisSnapshot({
      applicationId,
      runId: request.nextUrl.searchParams.get("runId"),
    });

    return NextResponse.json({
      applicationId,
      ...snapshot,
    });
  } catch (error) {
    return jsonError(
      getPublicResumeAnalysisErrorMessage(error, "analysis"),
      502,
      {
        code: "SECONDARY_ANALYSIS_RESULT_FAILED",
      },
    );
  }
}
