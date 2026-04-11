import { NextResponse } from "next/server";

export function jsonError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      error: message,
      ...extra,
    },
    { status },
  );
}

export async function parseJsonBody<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
