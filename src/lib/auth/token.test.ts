import { describe, expect, it } from "vitest";

import {
  generateInvitePlaintextToken,
  hashInviteToken,
  hashInviteTokenCandidates,
} from "@/lib/auth/token";

describe("invite token helpers", () => {
  it("generates 64 character random hex plaintext tokens", () => {
    const token = generateInvitePlaintextToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes invite tokens with supported algorithms", () => {
    expect(hashInviteToken("abc", "SHA256")).toHaveLength(64);
    expect(hashInviteToken("abc", "SHA384")).toHaveLength(96);
    expect(hashInviteToken("abc", "SHA512")).toHaveLength(128);
  });

  it("builds lookup candidates in compatibility order", () => {
    expect(
      hashInviteTokenCandidates("abc").map((item) => item.hashAlgorithm),
    ).toEqual(["SHA256", "SHA384", "SHA512"]);
  });
});
