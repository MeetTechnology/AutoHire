import { NextRequest, NextResponse } from "next/server";

import { submitApplication } from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError } from "@/lib/http";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError("当前会话无权访问该申请。", 403);
  }

  const application = await submitApplication(applicationId);

  if (!application) {
    return jsonError("申请不存在。", 404);
  }

  return NextResponse.json({
    applicationId,
    applicationStatus: application.applicationStatus,
    message: "已收到材料信息，将在 1-3 个工作日内答复。",
  });
}
