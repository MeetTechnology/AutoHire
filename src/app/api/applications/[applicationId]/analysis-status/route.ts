import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { applicationId } = await params;

  return NextResponse.json({
    applicationId,
    jobStatus: "queued",
    stageText: "正在等待分析任务开始",
    progressMessage: "后续这里会轮询现有简历分析服务的异步任务状态。",
  });
}
