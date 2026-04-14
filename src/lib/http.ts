import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Whether the client-facing request is served over HTTPS.
 * Honors `x-forwarded-proto` so TLS-terminated deployments still set `Secure` cookies.
 */
export function isClientHttps(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  if (forwarded === "https") {
    return true;
  }

  if (forwarded === "http") {
    return false;
  }

  return request.nextUrl.protocol === "https:";
}

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
