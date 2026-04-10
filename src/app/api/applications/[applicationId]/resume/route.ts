import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(_: Request, { params }: Params) {
  const { applicationId } = await params;

  return NextResponse.json({
    applicationId,
    analysisJobId: "stub-job-id",
    applicationStatus: "CV_ANALYZING",
  });
}
