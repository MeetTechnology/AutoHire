import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { getEnv } from "@/lib/env";

type AuditCookiePayload = {
  digest: string;
  issuedAt: number;
};

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getEnv().INVITE_TOKEN_SECRET)
    .update(value)
    .digest("base64url");
}

function getAllowedTokenDigests() {
  return getEnv()
    .AUDIT_DASHBOARD_TOKENS.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(createAuditTokenDigest);
}

function isCookiePayloadExpired(issuedAt: unknown) {
  if (typeof issuedAt !== "number" || !Number.isFinite(issuedAt)) {
    return true;
  }

  return (
    Date.now() - issuedAt >
    getEnv().AUDIT_DASHBOARD_COOKIE_MAX_AGE_SECONDS * 1000
  );
}

export function getAuditDashboardCookieName() {
  return getEnv().AUDIT_DASHBOARD_COOKIE_NAME;
}

export function getAuditDashboardCookieMaxAgeSeconds() {
  return getEnv().AUDIT_DASHBOARD_COOKIE_MAX_AGE_SECONDS;
}

export function createAuditTokenDigest(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function verifyAuditDashboardToken(token: string | null | undefined) {
  if (!token) {
    return false;
  }

  const tokenDigest = createAuditTokenDigest(token);
  return getAllowedTokenDigests().some((allowedDigest) =>
    timingSafeStringEqual(tokenDigest, allowedDigest),
  );
}

export function createAuditDashboardCookie(token: string) {
  const payload: AuditCookiePayload = {
    digest: createAuditTokenDigest(token),
    issuedAt: Date.now(),
  };
  const encodedPayload = encode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyAuditDashboardCookie(
  cookieValue: string | undefined | null,
) {
  if (!cookieValue) {
    return false;
  }

  const [encodedPayload, signature] = cookieValue.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = sign(encodedPayload);

  if (!timingSafeStringEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(decode(encodedPayload)) as AuditCookiePayload;

    if (isCookiePayloadExpired(payload.issuedAt)) {
      return false;
    }

    return getAllowedTokenDigests().some((allowedDigest) =>
      timingSafeStringEqual(payload.digest, allowedDigest),
    );
  } catch {
    return false;
  }
}
