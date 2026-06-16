import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const INVITE_HASH_ALGORITHMS = ["SHA256", "SHA384", "SHA512"] as const;

export type InviteHashAlgorithm = (typeof INVITE_HASH_ALGORITHMS)[number];

const NODE_HASH_ALGORITHMS = {
  SHA256: "sha256",
  SHA384: "sha384",
  SHA512: "sha512",
} as const satisfies Record<InviteHashAlgorithm, string>;

export function generateInvitePlaintextToken() {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(
  token: string,
  algorithm: InviteHashAlgorithm = "SHA256",
) {
  return createHash(NODE_HASH_ALGORITHMS[algorithm])
    .update(token)
    .digest("hex");
}

export function hashInviteTokenCandidates(token: string) {
  return INVITE_HASH_ALGORITHMS.map((algorithm) => ({
    hashAlgorithm: algorithm,
    tokenHash: hashInviteToken(token, algorithm),
  }));
}

export function compareTokenHash(token: string, expectedHash: string) {
  const actual = hashInviteToken(token);

  if (actual.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expectedHash));
}
