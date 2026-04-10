import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { applicationId } = await params;

  return NextResponse.json({
    applicationId,
    eligibilityResult: "INSUFFICIENT_INFO",
    displaySummary: "当前无法完成资格判断，缺少关键信息。",
    reasonText: "示例结果，后续将由现有简历分析服务返回。",
    extractedFields: {},
    missingFields: [],
  });
}
