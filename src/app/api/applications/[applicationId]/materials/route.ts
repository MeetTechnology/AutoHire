import { NextRequest, NextResponse } from "next/server";

import { materialConfirmSchema } from "@/features/application/schemas";
import {
  addMaterialRecord,
  getMaterialsByCategory,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError, parseJsonBody } from "@/lib/http";
import { validateUpload } from "@/lib/validation/upload";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError(
      "The current session is not authorized to access this application.",
      403,
    );
  }

  return NextResponse.json(await getMaterialsByCategory(applicationId));
}

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
  const parsed = materialConfirmSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The material upload confirmation payload is invalid.", 400, {
      details: parsed.error.flatten(),
    });
  }

  const validation = validateUpload(parsed.data.fileName, parsed.data.fileSize);

  if (!validation.valid) {
    return jsonError("The file does not meet the upload requirements.", 400, {
      code: validation.reason,
    });
  }

  await addMaterialRecord({
    applicationId,
    ...parsed.data,
  });

  return NextResponse.json(await getMaterialsByCategory(applicationId));
}
