import { describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

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
});
