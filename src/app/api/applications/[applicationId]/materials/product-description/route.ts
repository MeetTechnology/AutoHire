import { NextRequest, NextResponse } from "next/server";

import { productInnovationDescriptionSchema } from "@/features/application/schemas";
import {
  ApplicationServiceError,
  saveProductInnovationDescription,
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
  const parsed = productInnovationDescriptionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The product description payload is invalid.", 400, {
      details: parsed.error.flatten(),
    });
  }

  try {
    await saveProductInnovationDescription({
      applicationId,
      description: parsed.data.description,
    });

    return NextResponse.json({
      productInnovationDescription: parsed.data.description,
    });
  } catch (error) {
    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    throw error;
  }
}
