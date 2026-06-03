import { describe, expect, it } from "vitest";

import { getInvitationAccessBlockReason } from "@/lib/auth/invitation-access";

describe("getInvitationAccessBlockReason", () => {
  const activeInvitation = {
    tokenStatus: "ACTIVE" as const,
    expiredAt: new Date(Date.now() + 60_000),
  };

  it("allows active invitations before expiredAt", () => {
    expect(getInvitationAccessBlockReason(activeInvitation)).toBeNull();
  });

  it("blocks missing invitations", () => {
    expect(getInvitationAccessBlockReason(null)).toBe("NOT_FOUND");
  });

  it("blocks disabled invitations", () => {
    expect(
      getInvitationAccessBlockReason({
        ...activeInvitation,
        tokenStatus: "DISABLED",
      }),
    ).toBe("DISABLED");
  });

  it("blocks invitations marked expired in tokenStatus", () => {
    expect(
      getInvitationAccessBlockReason({
        ...activeInvitation,
        tokenStatus: "EXPIRED",
      }),
    ).toBe("EXPIRED");
  });

  it("blocks invitations past expiredAt", () => {
    expect(
      getInvitationAccessBlockReason({
        ...activeInvitation,
        expiredAt: new Date(Date.now() - 1),
      }),
    ).toBe("EXPIRED");
  });
});
