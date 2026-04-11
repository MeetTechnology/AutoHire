import { NextRequest, NextResponse } from "next/server";

import { refreshAnalysisState } from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError("当前会话无权访问该申请。", 403);
  }

  const status = await refreshAnalysisState(applicationId);

  if (!status) {
    return jsonError("尚未创建分析任务。", 404);
  }

  return NextResponse.json({
    applicationId,
    ...status,
  });
}
