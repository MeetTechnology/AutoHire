import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { applicationId } = await params;
  const body = await request.json().catch(() => null);

  return NextResponse.json({
    applicationId,
    received: body,
    analysisJobId: "stub-reanalysis-job-id",
    applicationStatus: "REANALYZING",
  });
}
