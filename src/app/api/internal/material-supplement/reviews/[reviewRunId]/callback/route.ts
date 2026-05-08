import { NextRequest, NextResponse } from "next/server";

import {
  jsonSupplementServiceError,
  MaterialSupplementServiceError,
  SUPPLEMENT_INTERNAL_ERROR_CODES,
} from "@/lib/material-supplement/errors";
import { assertMaterialReviewCallbackAuth } from "@/lib/material-supplement/internal-auth";
import { supplementReviewCallbackBodySchema } from "@/lib/material-supplement/schemas";
import { acceptSupplementReviewCallback } from "@/lib/material-supplement/service";

type Params = {
  params: Promise<{ reviewRunId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { reviewRunId } = await params;

  try {
    const rawBody = await request.text();

    assertMaterialReviewCallbackAuth({
      headers: request.headers,
      rawBody,
    });

    const parsedBody = supplementReviewCallbackBodySchema.safeParse(
      JSON.parse(rawBody),
    );

    if (!parsedBody.success) {
      throw new MaterialSupplementServiceError({
        message: "The supplement review callback payload is invalid.",
        status: 400,
        code: SUPPLEMENT_INTERNAL_ERROR_CODES.SUPPLEMENT_REVIEW_RESULT_INVALID,
        details: parsedBody.error.flatten(),
      });
    }

    return NextResponse.json(
      await acceptSupplementReviewCallback(reviewRunId, parsedBody.data),
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonSupplementServiceError(
        new MaterialSupplementServiceError({
          message: "The supplement review callback payload is invalid.",
          status: 400,
          code: SUPPLEMENT_INTERNAL_ERROR_CODES.SUPPLEMENT_REVIEW_RESULT_INVALID,
        }),
      );
    }

    if (error instanceof MaterialSupplementServiceError) {
      return jsonSupplementServiceError(error);
    }

    throw error;
  }
}
