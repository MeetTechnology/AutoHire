import { NextRequest, NextResponse } from "next/server";

import { supplementalFieldsSchema } from "@/features/application/schemas";
import { submitSupplementalFields } from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError, parseJsonBody } from "@/lib/http";
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

  const body = await parseJsonBody(request);
  const parsed = supplementalFieldsSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The supplemental field payload is invalid.", 400, {
      details: parsed.error.flatten(),
    });
  }

  let job;

  try {
    job = await submitSupplementalFields({
      applicationId,
      fields: parsed.data.fields,
    });
  } catch (error) {
    return jsonError(getResumeAnalysisErrorMessage(error), 502, {
      code: "REANALYSIS_START_FAILED",
    });
  }

  await trackEventFromRequest(request, {
    eventType: "supplemental_submitted",
    applicationId,
    pageName: "apply_result",
    stepName: "supplemental",
    actionName: "submit_confirm",
    eventStatus: "SUCCESS",
    payload: {
      analysisJobId: job.id,
    },
  });

  return NextResponse.json({
    applicationId,
    analysisJobId: job.id,
    applicationStatus: "REANALYZING",
  });
}
