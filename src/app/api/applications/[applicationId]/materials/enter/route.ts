import { NextRequest, NextResponse } from "next/server";

import {
  ApplicationServiceError,
  enterMaterialsStage,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";

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

  try {
    const application = await enterMaterialsStage(applicationId);

    if (!application) {
      return jsonError("The application could not be found.", 404);
    }

    return NextResponse.json({
      applicationId,
      applicationStatus: application.applicationStatus,
      currentStep: application.currentStep,
      nextRoute: "/apply/materials",
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
