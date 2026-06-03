import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAuditDashboardCookie,
  getAuditDashboardCookieMaxAgeSeconds,
  verifyAuditDashboardCookie,
  verifyAuditDashboardToken,
} from "@/lib/audit/auth";
import { resetEnvForTests } from "@/lib/env";

describe("audit dashboard auth helpers", () => {
  beforeEach(() => {
    process.env.AUDIT_DASHBOARD_TOKENS = "alpha-token, beta-token";
    process.env.AUDIT_DASHBOARD_COOKIE_MAX_AGE_SECONDS = "60";
    process.env.INVITE_TOKEN_SECRET = "audit-test-secret";
    resetEnvForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.AUDIT_DASHBOARD_TOKENS;
    delete process.env.AUDIT_DASHBOARD_COOKIE_MAX_AGE_SECONDS;
    delete process.env.INVITE_TOKEN_SECRET;
    resetEnvForTests();
  });

  it("rejects empty and unknown URL tokens", () => {
    expect(verifyAuditDashboardToken(null)).toBe(false);
    expect(verifyAuditDashboardToken("")).toBe(false);
    expect(verifyAuditDashboardToken("wrong-token")).toBe(false);
  });

  it("accepts configured URL tokens", () => {
    expect(verifyAuditDashboardToken("alpha-token")).toBe(true);
    expect(verifyAuditDashboardToken("beta-token")).toBe(true);
  });

  it("creates a cookie that verifies without storing the raw token", () => {
    const cookie = createAuditDashboardCookie("alpha-token");

    expect(cookie).not.toContain("alpha-token");
    expect(verifyAuditDashboardCookie(cookie)).toBe(true);
  });

  it("rejects tampered cookies", () => {
    const cookie = createAuditDashboardCookie("alpha-token");

    expect(verifyAuditDashboardCookie(`${cookie}x`)).toBe(false);
  });

  it("rejects cookies after max age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T00:00:00.000Z"));

    const cookie = createAuditDashboardCookie("alpha-token");
    vi.advanceTimersByTime(getAuditDashboardCookieMaxAgeSeconds() * 1000 + 1);

    expect(verifyAuditDashboardCookie(cookie)).toBe(false);
  });
});
