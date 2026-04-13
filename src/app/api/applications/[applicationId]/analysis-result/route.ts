import { NextRequest, NextResponse } from "next/server";

import { getSnapshot, refreshAnalysisState } from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";

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

  await refreshAnalysisState(applicationId);
  const snapshot = await getSnapshot(applicationId);

  if (!snapshot) {
    return jsonError("The application could not be found.", 404);
  }

  return NextResponse.json({
    applicationId,
    eligibilityResult: snapshot.eligibilityResult,
    displaySummary: snapshot.latestResult?.displaySummary ?? null,
    reasonText: snapshot.latestResult?.reasonText ?? null,
    extractedFields: snapshot.latestResult?.extractedFields ?? {},
    missingFields: snapshot.latestResult?.missingFields ?? [],
    applicationStatus: snapshot.applicationStatus,
    resumeAnalysisStatus: snapshot.resumeAnalysisStatus,
  });
}
