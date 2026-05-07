import { NextRequest, NextResponse } from "next/server";

import { assertSupplementAccess } from "@/lib/material-supplement/access";
import {
  jsonSupplementServiceError,
  MaterialSupplementServiceError,
} from "@/lib/material-supplement/errors";
import { supplementFileParamsSchema } from "@/lib/material-supplement/schemas";
import { deleteSupplementDraftFile } from "@/lib/material-supplement/upload";

type Params = {
  params: Promise<{ applicationId: string; fileId: string }>;
};

export async function DELETE(request: NextRequest, { params }: Params) {
  const rawParams = await params;
  const parsedParams = supplementFileParamsSchema.parse(rawParams);

  try {
    await assertSupplementAccess({
      request,
      applicationId: parsedParams.applicationId,
    });

    return NextResponse.json(
      await deleteSupplementDraftFile({
        applicationId: parsedParams.applicationId,
        fileId: parsedParams.fileId,
      }),
    );
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      return jsonSupplementServiceError(error);
    }

    throw error;
  }
}
