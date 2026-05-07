import { NextRequest, NextResponse } from "next/server";

import { parseJsonBody } from "@/lib/http";
import { assertSupplementAccess } from "@/lib/material-supplement/access";
import {
  jsonSupplementServiceError,
  MaterialSupplementServiceError,
  SUPPLEMENT_EXPERT_ERROR_CODES,
} from "@/lib/material-supplement/errors";
import {
  supplementBatchParamsSchema,
  supplementConfirmUploadBatchRequestSchema,
} from "@/lib/material-supplement/schemas";
import { confirmSupplementUploadBatch } from "@/lib/material-supplement/upload";

type Params = {
  params: Promise<{ applicationId: string; batchId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const rawParams = await params;
  const parsedParams = supplementBatchParamsSchema.parse(rawParams);

  try {
    await assertSupplementAccess({
      request,
      applicationId: parsedParams.applicationId,
    });

    const body = await parseJsonBody(request);
    const parsed = supplementConfirmUploadBatchRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new MaterialSupplementServiceError({
        message: "The supplement upload batch confirmation payload is invalid.",
        status: 400,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_TRIGGER_FAILED,
        details: parsed.error.flatten(),
      });
    }

    return NextResponse.json(
      await confirmSupplementUploadBatch({
        applicationId: parsedParams.applicationId,
        uploadBatchId: parsedParams.batchId,
        category: parsed.data.category,
      }),
    );
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      return jsonSupplementServiceError(error);
    }

    throw error;
  }
}
