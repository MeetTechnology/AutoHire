import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  return NextResponse.json({
    message: "Expert session endpoint placeholder",
    tokenPresent: Boolean(token),
  });
}
