import { NextRequest, NextResponse } from "next/server";

import { resumeConfirmSchema } from "@/features/application/schemas";
import {
  createResumeUploadRecord,
  startInitialAnalysis,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { parseJsonBody, jsonError } from "@/lib/http";
import { getResumeAnalysisErrorMessage } from "@/lib/resume-analysis/client";
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

  const resumeFile = await createResumeUploadRecord({
    applicationId,
    fileName,
    fileType,
    fileSize,
    objectKey,
    screeningPassportFullName,
    screeningContactEmail,
  });
  let job;

  try {
    job = await startInitialAnalysis({
      applicationId,
      fileName,
      resumeFileId: resumeFile.id,
    });
  } catch (error) {
    await trackEventFromRequest(request, {
      eventType: "resume_upload_failed",
      applicationId,
      pageName: "apply_resume",
      stepName: "resume_upload",
      actionName: "upload_confirm",
      eventStatus: "FAIL",
      errorCode: "analysis_trigger_failed",
      errorMessage: getResumeAnalysisErrorMessage(error),
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
    return jsonError(getResumeAnalysisErrorMessage(error), 502, {
      code: "ANALYSIS_START_FAILED",
    });
  }

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

  await trackEventFromRequest(request, {
    eventType: "analysis_started",
    applicationId,
    pageName: "apply_result",
    stepName: "analysis_result",
    actionName: "page_view",
    eventStatus: "SUCCESS",
    payload: {
      analysisJobId: job.id,
    },
  });

  return NextResponse.json({
    applicationId,
    analysisJobId: job.id,
    applicationStatus: "CV_ANALYZING",
  });
}
