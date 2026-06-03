import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getAuditDashboardSummary,
  getAuditRangeStart,
  resolveAuditRange,
} from "@/lib/audit/summary";
import { resetEnvForTests } from "@/lib/env";

describe("audit dashboard summary", () => {
  beforeEach(() => {
    process.env.APP_RUNTIME_MODE = "memory";
    delete process.env.DATABASE_URL;
    resetEnvForTests();
  });

  afterEach(() => {
    delete process.env.APP_RUNTIME_MODE;
    delete process.env.DATABASE_URL;
    resetEnvForTests();
  });

  it("resolves supported ranges and defaults to 30d", () => {
    expect(resolveAuditRange("7d")).toBe("7d");
    expect(resolveAuditRange("30d")).toBe("30d");
    expect(resolveAuditRange("all")).toBe("all");
    expect(resolveAuditRange("bad")).toBe("30d");
    expect(resolveAuditRange(null)).toBe("30d");
  });

  it("computes range start dates", () => {
    const now = new Date("2026-06-03T12:00:00.000Z");

    expect(getAuditRangeStart("all", now)).toBeNull();
    expect(getAuditRangeStart("7d", now)?.toISOString()).toBe(
      "2026-05-27T12:00:00.000Z",
    );
    expect(getAuditRangeStart("30d", now)?.toISOString()).toBe(
      "2026-05-04T12:00:00.000Z",
    );
  });

  it("returns a stable empty state outside Prisma runtime", async () => {
    const summary = await getAuditDashboardSummary({ range: "7d" });

    expect(summary.isAvailable).toBe(false);
    expect(summary.range).toBe("7d");
    expect(summary.totals.applications).toBe(0);
    expect(summary.distributions.applicationStatus).toEqual([]);
    expect(summary.milestones.map((item) => item.value)).toEqual(
      expect.arrayContaining([0]),
    );
  });
});
