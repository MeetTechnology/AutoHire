import { NextRequest, NextResponse } from "next/server";

import { materialConfirmSchema } from "@/features/application/schemas";
import {
  ApplicationServiceError,
  addMaterialRecord,
  getMaterialsByCategory,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError, parseJsonBody } from "@/lib/http";
import { trackEventFromRequest } from "@/lib/tracking/service";
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

  try {
    return NextResponse.json(await getMaterialsByCategory(applicationId));
  } catch (error) {
    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    throw error;
  }
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

  const validation = validateUpload(
    parsed.data.fileName,
    parsed.data.fileSize,
    { category: parsed.data.category },
  );
  const { uploadId, category, fileName, fileType, fileSize, objectKey } =
    parsed.data;

  if (!validation.valid) {
    await trackEventFromRequest(request, {
      eventType: "material_upload_failed",
      applicationId,
      pageName: "apply_materials",
      stepName: "materials",
      actionName: "upload_confirm",
      eventStatus: "FAIL",
      errorCode: validation.reason,
      upload: {
        uploadId,
        kind: "material",
        category,
        fileName,
        fileExt: fileName.split(".").pop()?.toLowerCase() ?? null,
        fileSize,
        failureStage: "confirm",
        objectKey,
      },
    });
    return jsonError("The file does not meet the upload requirements.", 400, {
      code: validation.reason,
    });
  }

  try {
    await addMaterialRecord({
      applicationId,
      category,
      fileName,
      fileType,
      fileSize,
      objectKey,
    });

    await trackEventFromRequest(request, {
      eventType: "material_upload_confirmed",
      applicationId,
      pageName: "apply_materials",
      stepName: "materials",
      actionName: "upload_confirm",
      eventStatus: "SUCCESS",
      upload: {
        uploadId,
        kind: "material",
        category,
        fileName,
        fileExt: fileName.split(".").pop()?.toLowerCase() ?? null,
        fileSize,
        objectKey,
      },
    });

    return NextResponse.json(await getMaterialsByCategory(applicationId));
  } catch (error) {
    await trackEventFromRequest(request, {
      eventType: "material_upload_failed",
      applicationId,
      pageName: "apply_materials",
      stepName: "materials",
      actionName: "upload_confirm",
      eventStatus: "FAIL",
      errorCode:
        error instanceof ApplicationServiceError ? error.code : "upload_confirm_failed",
      errorMessage:
        error instanceof Error ? error.message : "Material upload confirm failed.",
      upload: {
        uploadId,
        kind: "material",
        category,
        fileName,
        fileExt: fileName.split(".").pop()?.toLowerCase() ?? null,
        fileSize,
        failureStage: "confirm",
        objectKey,
      },
    });
    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    throw error;
  }
}
