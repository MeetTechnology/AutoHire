import { createHmac, timingSafeEqual } from "node:crypto";

import { getEnv } from "@/lib/env";

export type SessionPayload = {
  invitationId: string;
  applicationId: string;
  expertId: string;
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

function isSessionPayloadExpired(issuedAt: unknown, maxAgeSeconds: number) {
  if (typeof issuedAt !== "number" || !Number.isFinite(issuedAt)) {
    return true;
  }

  return Date.now() - issuedAt > maxAgeSeconds * 1000;
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

export function getSessionCookieName() {
  return getEnv().SESSION_COOKIE_NAME;
}

export function getSessionMaxAgeSeconds() {
  return getEnv().SESSION_COOKIE_MAX_AGE_SECONDS;
}

export function createSessionToken(payload: Omit<SessionPayload, "issuedAt">) {
  const fullPayload: SessionPayload = {
    ...payload,
    issuedAt: Date.now(),
  };
  const encodedPayload = encode(JSON.stringify(fullPayload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  try {
    const expected = sign(encodedPayload);

    if (!timingSafeStringEqual(signature, expected)) {
      return null;
    }

    const payload = JSON.parse(decode(encodedPayload)) as SessionPayload;

    if (isSessionPayloadExpired(payload.issuedAt, getSessionMaxAgeSeconds())) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
