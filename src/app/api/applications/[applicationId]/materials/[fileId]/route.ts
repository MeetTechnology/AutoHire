import { NextRequest, NextResponse } from "next/server";

import {
  getMaterialsByCategory,
  removeMaterialRecord,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";

type Params = {
  params: Promise<{ applicationId: string; fileId: string }>;
};

export async function DELETE(request: NextRequest, { params }: Params) {
  const { applicationId, fileId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError(
      "The current session is not authorized to access this application.",
      403,
    );
  }

  const material = await removeMaterialRecord(applicationId, fileId);

  if (!material) {
    return jsonError("The material could not be found.", 404);
  }

  return NextResponse.json(await getMaterialsByCategory(applicationId));
}
