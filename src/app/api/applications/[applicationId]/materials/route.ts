import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { applicationId } = await params;

  return NextResponse.json({
    applicationId,
    identity: [],
    employment: [],
    education: [],
    honor: [],
    patent: [],
    project: [],
  });
}

export async function POST(request: Request, { params }: Params) {
  const { applicationId } = await params;
  const body = await request.json().catch(() => null);

  return NextResponse.json({
    applicationId,
    received: body,
    message: "Materials upload metadata endpoint placeholder",
  });
}
