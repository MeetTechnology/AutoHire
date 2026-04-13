import { NextRequest, NextResponse } from "next/server";

import { resumeConfirmSchema } from "@/features/application/schemas";
import {
  createResumeUploadRecord,
  startInitialAnalysis,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { parseJsonBody, jsonError } from "@/lib/http";
import { getResumeAnalysisErrorMessage } from "@/lib/resume-analysis/client";
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

  if (!validation.valid) {
    return jsonError("The file does not meet the upload requirements.", 400, {
      code: validation.reason,
    });
  }

  const resumeFile = await createResumeUploadRecord({
    applicationId,
    ...parsed.data,
  });
  let job;

  try {
    job = await startInitialAnalysis({
      applicationId,
      fileName: parsed.data.fileName,
      resumeFileId: resumeFile.id,
    });
  } catch (error) {
    return jsonError(getResumeAnalysisErrorMessage(error), 502, {
      code: "ANALYSIS_START_FAILED",
    });
  }

  return NextResponse.json({
    applicationId,
    analysisJobId: job.id,
    applicationStatus: "CV_ANALYZING",
  });
}
