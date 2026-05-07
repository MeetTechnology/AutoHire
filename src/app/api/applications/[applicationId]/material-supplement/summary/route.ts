import { NextRequest, NextResponse } from "next/server";

import { assertSupplementAccess } from "@/lib/material-supplement/access";
import {
  jsonSupplementServiceError,
  MaterialSupplementServiceError,
} from "@/lib/material-supplement/errors";
import { getSupplementSummary } from "@/lib/material-supplement/service";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;

  try {
    await assertSupplementAccess({
      request,
      applicationId,
    });

    return NextResponse.json(await getSupplementSummary(applicationId));
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      return jsonSupplementServiceError(error);
    }

    throw error;
  }
}
