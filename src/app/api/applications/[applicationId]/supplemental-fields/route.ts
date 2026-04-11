import { NextRequest, NextResponse } from "next/server";

import { supplementalFieldsSchema } from "@/features/application/schemas";
import { submitSupplementalFields } from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError, parseJsonBody } from "@/lib/http";

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
  const parsed = supplementalFieldsSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("补充字段格式不正确。", 400, {
      details: parsed.error.flatten(),
    });
  }

  const job = await submitSupplementalFields({
    applicationId,
    fields: parsed.data.fields,
  });

  return NextResponse.json({
    applicationId,
    analysisJobId: job.id,
    applicationStatus: "REANALYZING",
  });
}
