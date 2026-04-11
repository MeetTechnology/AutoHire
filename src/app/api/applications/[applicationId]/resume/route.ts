import { NextRequest, NextResponse } from "next/server";

import { resumeConfirmSchema } from "@/features/application/schemas";
import {
  createResumeUploadRecord,
  startInitialAnalysis,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { parseJsonBody, jsonError } from "@/lib/http";
import { validateUpload } from "@/lib/validation/upload";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError("当前会话无权访问该申请。", 403);
  }

  const body = await parseJsonBody(request);
  const parsed = resumeConfirmSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("上传确认参数不合法。", 400, {
      details: parsed.error.flatten(),
    });
  }

  const validation = validateUpload(parsed.data.fileName, parsed.data.fileSize);

  if (!validation.valid) {
    return jsonError("文件不符合上传要求。", 400, { code: validation.reason });
  }

  const resumeFile = await createResumeUploadRecord({
    applicationId,
    ...parsed.data,
  });
  const job = await startInitialAnalysis({
    applicationId,
    fileName: parsed.data.fileName,
    resumeFileId: resumeFile.id,
  });

  return NextResponse.json({
    applicationId,
    analysisJobId: job.id,
    applicationStatus: "CV_ANALYZING",
  });
}
