import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/ops/invitations/access/route";
import {
  getAuditDashboardCookieName,
  verifyAuditDashboardCookie,
} from "@/lib/audit/auth";
import { resetEnvForTests } from "@/lib/env";

const originalEnv = { ...process.env };

describe("GET /ops/invitations/access", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUDIT_DASHBOARD_TOKENS: "ops-token",
      AUDIT_DASHBOARD_COOKIE_NAME: "ops_test_cookie",
      AUDIT_DASHBOARD_COOKIE_MAX_AGE_SECONDS: "300",
      INVITE_TOKEN_SECRET: "ops-route-secret",
    };
    resetEnvForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvForTests();
  });

  it("sets a shared /ops audit cookie and redirects for valid tokens", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/ops/invitations/access?token=ops-token",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/ops/invitations",
    );

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${getAuditDashboardCookieName()}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/");

    const cookieValue =
      setCookie.match(
        new RegExp(`${getAuditDashboardCookieName()}=([^;]+)`),
      )?.[1] ?? "";
    expect(verifyAuditDashboardCookie(cookieValue)).toBe(true);
  });

  it("returns 404 without a cookie for invalid tokens", async () => {
    const response = await GET(
      new NextRequest("http://localhost/ops/invitations/access?token=wrong"),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
