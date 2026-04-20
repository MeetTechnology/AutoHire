import { NextRequest, NextResponse } from "next/server";

import { confirmIntro } from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";
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

  const application = await confirmIntro(applicationId);

  if (!application) {
    return jsonError("The application could not be found.", 404);
  }

  await trackEventFromRequest(request, {
    eventType: "start_apply_clicked",
    applicationId,
    pageName: "apply_entry",
    stepName: "intro",
    actionName: "button_click",
    eventStatus: "SUCCESS",
    payload: {
      currentStep: application.currentStep,
    },
  });

  return NextResponse.json({
    applicationId,
    applicationStatus: application.applicationStatus,
    currentStep: application.currentStep,
  });
}
