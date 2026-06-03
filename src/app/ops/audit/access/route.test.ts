import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/ops/audit/access/route";
import {
  getAuditDashboardCookieName,
  verifyAuditDashboardCookie,
} from "@/lib/audit/auth";
import { resetEnvForTests } from "@/lib/env";

describe("GET /ops/audit/access", () => {
  beforeEach(() => {
    process.env.AUDIT_DASHBOARD_TOKENS = "audit-token";
    process.env.AUDIT_DASHBOARD_COOKIE_NAME = "audit_test_cookie";
    process.env.AUDIT_DASHBOARD_COOKIE_MAX_AGE_SECONDS = "300";
    process.env.INVITE_TOKEN_SECRET = "audit-route-secret";
    resetEnvForTests();
  });

  afterEach(() => {
    delete process.env.AUDIT_DASHBOARD_TOKENS;
    delete process.env.AUDIT_DASHBOARD_COOKIE_NAME;
    delete process.env.AUDIT_DASHBOARD_COOKIE_MAX_AGE_SECONDS;
    delete process.env.INVITE_TOKEN_SECRET;
    resetEnvForTests();
  });

  it("sets an HttpOnly audit cookie and redirects for valid tokens", async () => {
    const response = await GET(
      new NextRequest("http://localhost/ops/audit/access?token=audit-token"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/ops/audit");

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${getAuditDashboardCookieName()}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/ops/audit");

    const cookieValue =
      setCookie.match(new RegExp(`${getAuditDashboardCookieName()}=([^;]+)`))?.[1] ??
      "";
    expect(verifyAuditDashboardCookie(cookieValue)).toBe(true);
  });

  it("returns 404 without a cookie for missing or invalid tokens", async () => {
    const missing = await GET(
      new NextRequest("http://localhost/ops/audit/access"),
    );
    const invalid = await GET(
      new NextRequest("http://localhost/ops/audit/access?token=wrong"),
    );

    expect(missing.status).toBe(404);
    expect(missing.headers.get("set-cookie")).toBeNull();
    expect(invalid.status).toBe(404);
    expect(invalid.headers.get("set-cookie")).toBeNull();
  });
});
