import { NextRequest, NextResponse } from "next/server";

import { writeMockObject } from "@/lib/storage/object-store";

export async function PUT(request: NextRequest) {
  const objectKey = request.nextUrl.searchParams.get("key");

  if (!objectKey) {
    return NextResponse.json(
      { error: "Mock storage key is required." },
      { status: 400 },
    );
  }

  await writeMockObject(objectKey, await request.arrayBuffer());

  return new NextResponse(null, { status: 204 });
}
