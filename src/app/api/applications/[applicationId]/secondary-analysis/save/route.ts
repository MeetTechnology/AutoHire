import { NextRequest, NextResponse } from "next/server";

import { secondaryAnalysisSaveSchema } from "@/features/application/schemas";
import {
  ApplicationServiceError,
  saveEditableSecondaryAnalysisFields,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError, parseJsonBody } from "@/lib/http";

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
  const parsed = secondaryAnalysisSaveSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The secondary analysis save payload is invalid.", 400, {
      details: parsed.error.flatten(),
    });
  }

  try {
    const snapshot = await saveEditableSecondaryAnalysisFields({
      applicationId,
      runId: parsed.data.runId,
      fields: parsed.data.fields,
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

    return jsonError("The secondary analysis fields could not be saved.", 502, {
      code: "SECONDARY_ANALYSIS_SAVE_FAILED",
    });
  }
}
