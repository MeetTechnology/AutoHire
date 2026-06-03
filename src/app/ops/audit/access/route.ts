import { NextRequest, NextResponse } from "next/server";

import {
  createAuditDashboardCookie,
  getAuditDashboardCookieMaxAgeSeconds,
  getAuditDashboardCookieName,
  verifyAuditDashboardToken,
} from "@/lib/audit/auth";
import { isClientHttps } from "@/lib/http";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!verifyAuditDashboardToken(token)) {
    return new NextResponse(null, { status: 404 });
  }

  const response = NextResponse.redirect(new URL("/ops/audit", request.url));
  response.cookies.set({
    name: getAuditDashboardCookieName(),
    value: createAuditDashboardCookie(token!),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && isClientHttps(request),
    path: "/ops/audit",
    maxAge: getAuditDashboardCookieMaxAgeSeconds(),
  });

  return response;
}
