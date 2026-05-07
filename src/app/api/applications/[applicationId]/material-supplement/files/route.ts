import { NextRequest, NextResponse } from "next/server";

import { parseJsonBody } from "@/lib/http";
import { assertSupplementAccess } from "@/lib/material-supplement/access";
import {
  jsonSupplementServiceError,
  MaterialSupplementServiceError,
  SUPPLEMENT_EXPERT_ERROR_CODES,
} from "@/lib/material-supplement/errors";
import { supplementConfirmFileRequestSchema } from "@/lib/material-supplement/schemas";
import { confirmSupplementFileUpload } from "@/lib/material-supplement/upload";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;

  try {
    await assertSupplementAccess({
      request,
      applicationId,
    });

    const body = await parseJsonBody(request);
    const parsed = supplementConfirmFileRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new MaterialSupplementServiceError({
        message: "The supplement file confirmation payload is invalid.",
        status: 400,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_CONFIRM_FAILED,
        details: parsed.error.flatten(),
      });
    }

    return NextResponse.json(
      await confirmSupplementFileUpload({
        applicationId,
        ...parsed.data,
      }),
    );
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      return jsonSupplementServiceError(error);
    }

    throw error;
  }
}
