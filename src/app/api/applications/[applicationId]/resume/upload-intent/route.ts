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

  const body = await parseJsonBody(request);
  const parsed = uploadIntentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The upload request payload is invalid.", 400, {
      details: parsed.error.flatten(),
    });
  }

  const validation = validateUpload(parsed.data.fileName, parsed.data.fileSize);

  if (!validation.valid) {
    await trackEventFromRequest(request, {
      eventType: "resume_upload_failed",
      applicationId,
      pageName: "apply_resume",
      stepName: "resume_upload",
      actionName: "intent_create",
      eventStatus: "FAIL",
      errorCode: validation.reason,
      upload: {
        uploadId: parsed.data.uploadId,
        kind: "resume",
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
    kind: "resume",
  });

  try {
    const intent = await createUploadIntent({
      fileType: parsed.data.fileType,
      objectKey,
      requestOrigin: request.nextUrl.origin,
    });

    await trackEventFromRequest(request, {
      eventType: "resume_upload_intent_created",
      applicationId,
      pageName: "apply_resume",
      stepName: "resume_upload",
      actionName: "intent_create",
      eventStatus: "SUCCESS",
      upload: {
        uploadId: parsed.data.uploadId,
        kind: "resume",
        fileName: parsed.data.fileName,
        fileExt: parsed.data.fileName.split(".").pop()?.toLowerCase() ?? null,
        fileSize: parsed.data.fileSize,
        objectKey,
      },
    });

    return NextResponse.json(intent);
  } catch {
    await trackEventFromRequest(request, {
      eventType: "resume_upload_failed",
      applicationId,
      pageName: "apply_resume",
      stepName: "resume_upload",
      actionName: "intent_create",
      eventStatus: "FAIL",
      errorCode: "upload_intent_failed",
      upload: {
        uploadId: parsed.data.uploadId,
        kind: "resume",
        fileName: parsed.data.fileName,
        fileExt: parsed.data.fileName.split(".").pop()?.toLowerCase() ?? null,
        fileSize: parsed.data.fileSize,
        failureStage: "intent",
        objectKey,
      },
    });

    return jsonError("Unable to create the upload intent.", 502, {
      code: "UPLOAD_INTENT_FAILED",
    });
  }
}
