import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  await request.arrayBuffer();

  return new NextResponse(null, { status: 204 });
}
