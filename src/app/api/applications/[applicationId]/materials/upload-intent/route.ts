import { NextRequest, NextResponse } from "next/server";

import { uploadIntentSchema } from "@/features/application/schemas";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError, parseJsonBody } from "@/lib/http";
import { trackEventFromRequest } from "@/lib/tracking/service";
import { createObjectKey, createUploadIntent } from "@/lib/upload/service";
import { validateUpload } from "@/lib/validation/upload";

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

  if (access.application.applicationStatus !== "MATERIALS_IN_PROGRESS") {
    return jsonError(
      "Supporting materials can only be uploaded after the detailed analysis is complete.",
      409,
      {
        code: "MATERIALS_STAGE_NOT_READY",
      },
    );
  }

  const body = await parseJsonBody(request);
  const parsed = uploadIntentSchema.safeParse(body);

  if (!parsed.success || !parsed.data.category) {
    return jsonError("The material upload request payload is invalid.", 400, {
      details: parsed.success
        ? { category: ["Material category is required."] }
        : parsed.error.flatten(),
    });
  }

  const validation = validateUpload(
    parsed.data.fileName,
    parsed.data.fileSize,
    { category: parsed.data.category },
  );

  if (!validation.valid) {
    await trackEventFromRequest(request, {
      eventType: "material_upload_failed",
      applicationId,
      pageName: "apply_materials",
      stepName: "materials",
      actionName: "intent_create",
      eventStatus: "FAIL",
      errorCode: validation.reason,
      upload: {
        uploadId: parsed.data.uploadId,
        kind: "material",
        category: parsed.data.category,
        fileName: parsed.data.fileName,
        fileExt: parsed.data.fileName.split(".").pop()?.toLowerCase() ?? null,
        fileSize: parsed.data.fileSize,
        failureStage: "intent",
      },
    });
    return jsonError("The file does not meet the upload requirements.", 400, {
      code: validation.reason,
    });
  }

  const objectKey = createObjectKey({
    applicationId,
    fileName: parsed.data.fileName,
    category: parsed.data.category,
    kind: "materials",
  });

  try {
    const intent = await createUploadIntent({
      fileType: parsed.data.fileType,
      objectKey,
      requestOrigin: request.nextUrl.origin,
    });

    await trackEventFromRequest(request, {
      eventType: "material_upload_intent_created",
      applicationId,
      pageName: "apply_materials",
      stepName: "materials",
      actionName: "intent_create",
      eventStatus: "SUCCESS",
      upload: {
        uploadId: parsed.data.uploadId,
        kind: "material",
        category: parsed.data.category,
        fileName: parsed.data.fileName,
        fileExt: parsed.data.fileName.split(".").pop()?.toLowerCase() ?? null,
        fileSize: parsed.data.fileSize,
        objectKey,
      },
    });

    return NextResponse.json(intent);
  } catch {
    await trackEventFromRequest(request, {
      eventType: "material_upload_failed",
      applicationId,
      pageName: "apply_materials",
      stepName: "materials",
      actionName: "intent_create",
      eventStatus: "FAIL",
      errorCode: "upload_intent_failed",
      upload: {
        uploadId: parsed.data.uploadId,
        kind: "material",
        category: parsed.data.category,
        fileName: parsed.data.fileName,
        fileExt: parsed.data.fileName.split(".").pop()?.toLowerCase() ?? null,
        fileSize: parsed.data.fileSize,
        failureStage: "intent",
        objectKey,
      },
    });
    return jsonError("Unable to create the material upload intent.", 502, {
      code: "UPLOAD_INTENT_FAILED",
    });
  }
}
