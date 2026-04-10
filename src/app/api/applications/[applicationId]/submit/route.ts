import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(_: Request, { params }: Params) {
  const { applicationId } = await params;

  return NextResponse.json({
    applicationId,
    applicationStatus: "SUBMITTED",
    message: "已收到材料信息，将在 1-3 个工作日内答复。",
  });
}
