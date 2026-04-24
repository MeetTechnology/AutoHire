import { NextRequest, NextResponse } from "next/server";

import { resumeConfirmSchema } from "@/features/application/schemas";
import {
  ApplicationServiceError,
  createResumeUploadRecord,
  getSnapshot,
  removeLatestResumeUpload,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { parseJsonBody, jsonError } from "@/lib/http";
import { trackEventFromRequest } from "@/lib/tracking/service";
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
  const parsed = resumeConfirmSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The upload confirmation payload is invalid.", 400, {
      details: parsed.error.flatten(),
    });
  }

  const validation = validateUpload(parsed.data.fileName, parsed.data.fileSize);

  const {
    uploadId,
    screeningPassportFullName,
    screeningContactEmail,
    screeningWorkEmail,
    screeningPhoneNumber,
    fileName,
    fileType,
    fileSize,
    objectKey,
  } = parsed.data;

  if (!validation.valid) {
    await trackEventFromRequest(request, {
      eventType: "resume_upload_failed",
      applicationId,
      pageName: "apply_resume",
      stepName: "resume_upload",
      actionName: "upload_confirm",
      eventStatus: "FAIL",
      errorCode: validation.reason,
      upload: {
        uploadId,
        kind: "resume",
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
    const resumeFile = await createResumeUploadRecord({
      applicationId,
      fileName,
      fileType,
      fileSize,
      objectKey,
      screeningPassportFullName,
      screeningContactEmail,
      screeningWorkEmail,
      screeningPhoneNumber,
    });

    await trackEventFromRequest(request, {
      eventType: "resume_upload_confirmed",
      applicationId,
      pageName: "apply_resume",
      stepName: "resume_upload",
      actionName: "upload_confirm",
      eventStatus: "SUCCESS",
      upload: {
        uploadId,
        kind: "resume",
        fileName,
        fileExt: fileName.split(".").pop()?.toLowerCase() ?? null,
        fileSize,
        objectKey,
      },
    });

    return NextResponse.json({
      applicationId,
      applicationStatus: "CV_UPLOADED",
      latestResumeFile: {
        id: resumeFile.id,
        fileName: resumeFile.fileName,
        fileType: resumeFile.fileType,
        fileSize: resumeFile.fileSize,
        uploadedAt: resumeFile.uploadedAt.toISOString(),
      },
    });
  } catch (error) {
    await trackEventFromRequest(request, {
      eventType: "resume_upload_failed",
      applicationId,
      pageName: "apply_resume",
      stepName: "resume_upload",
      actionName: "upload_confirm",
      eventStatus: "FAIL",
      errorCode:
        error instanceof ApplicationServiceError
          ? error.code
          : "upload_confirm_failed",
      errorMessage:
        error instanceof Error ? error.message : "Resume upload confirm failed.",
      upload: {
        uploadId,
        kind: "resume",
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

export async function DELETE(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError(
      "The current session is not authorized to access this application.",
      403,
    );
  }

  try {
    await removeLatestResumeUpload(applicationId);
    const snapshot = await getSnapshot(applicationId);
    return NextResponse.json({
      applicationId,
      applicationStatus: snapshot?.applicationStatus ?? "INTRO_VIEWED",
      latestResumeFile: snapshot?.latestResumeFile ?? null,
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
