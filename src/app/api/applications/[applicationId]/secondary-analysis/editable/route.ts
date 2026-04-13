import { NextRequest, NextResponse } from "next/server";

import {
  ApplicationServiceError,
  getEditableSecondaryAnalysisSnapshot,
} from "@/lib/application/service";
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

  try {
    const snapshot = await getEditableSecondaryAnalysisSnapshot({
      applicationId,
      runId: request.nextUrl.searchParams.get("runId"),
    });

    return NextResponse.json({
      applicationId,
      ...snapshot,
    });
  } catch (error) {
    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    return jsonError("The editable secondary analysis result could not be loaded.", 502, {
      code: "SECONDARY_ANALYSIS_EDITABLE_FAILED",
    });
  }
}
