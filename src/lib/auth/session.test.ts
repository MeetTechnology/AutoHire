import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSessionToken,
  getSessionMaxAgeSeconds,
  verifySessionToken,
} from "@/lib/auth/session";

describe("session token helpers", () => {
  it("creates and verifies a signed session token", () => {
    const token = createSessionToken({
      applicationId: "app_1",
      expertId: "expert_1",
      invitationId: "inv_1",
    });

    expect(verifySessionToken(token)).toMatchObject({
      applicationId: "app_1",
      expertId: "expert_1",
      invitationId: "inv_1",
    });
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("broken")).toBeNull();
  });

  it("rejects tokens after the configured max age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const token = createSessionToken({
      applicationId: "app_1",
      expertId: "expert_1",
      invitationId: "inv_1",
    });

    vi.advanceTimersByTime(getSessionMaxAgeSeconds() * 1000 + 1);

    expect(verifySessionToken(token)).toBeNull();

    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
