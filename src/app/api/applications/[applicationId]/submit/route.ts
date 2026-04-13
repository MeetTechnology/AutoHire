import { NextRequest, NextResponse } from "next/server";

import { submitApplication } from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError("The current session is not authorized to access this application.", 403);
  }

  const application = await submitApplication(applicationId);

  if (!application) {
    return jsonError("The application could not be found.", 404);
  }

  return NextResponse.json({
    applicationId,
    applicationStatus: application.applicationStatus,
    message:
      "We have received your materials and will respond within 1 to 3 business days.",
  });
}
