import { NextRequest, NextResponse } from "next/server";

import { assertSupplementAccess } from "@/lib/material-supplement/access";
import {
  jsonSupplementServiceError,
  MaterialSupplementServiceError,
} from "@/lib/material-supplement/errors";
import { getSupplementReviewRun } from "@/lib/material-supplement/service";

type Params = {
  params: Promise<{ applicationId: string; reviewRunId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { applicationId, reviewRunId } = await params;

  try {
    await assertSupplementAccess({
      request,
      applicationId,
    });

    return NextResponse.json(
      await getSupplementReviewRun(applicationId, reviewRunId),
    );
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      return jsonSupplementServiceError(error);
    }

    throw error;
  }
}
