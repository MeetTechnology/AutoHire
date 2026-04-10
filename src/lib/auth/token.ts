import { createHash, timingSafeEqual } from "node:crypto";

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function compareTokenHash(token: string, expectedHash: string) {
  const actual = hashInviteToken(token);

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expectedHash));
}
