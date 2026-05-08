import { createHmac, timingSafeEqual } from "node:crypto";

import {
  MaterialSupplementServiceError,
  SUPPLEMENT_INTERNAL_ERROR_CODES,
} from "@/lib/material-supplement/errors";
import {
  getSupplementCallbackHeaders,
  supplementCallbackHeadersSchema,
} from "@/lib/material-supplement/schemas";

const CALLBACK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

function getCallbackSecret() {
  return process.env.MATERIAL_REVIEW_CALLBACK_SECRET?.trim() ?? "";
}

export function createMaterialReviewCallbackSignature(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
}) {
  return createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex");
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function assertMaterialReviewCallbackAuth(input: {
  headers: Headers;
  rawBody: string;
  now?: Date;
}) {
  const secret = getCallbackSecret();

  if (!secret) {
    throw new MaterialSupplementServiceError({
      message: "The internal callback secret is not configured.",
      status: 401,
      code: SUPPLEMENT_INTERNAL_ERROR_CODES.INTERNAL_UNAUTHORIZED,
    });
  }

  const rawHeaders = getSupplementCallbackHeaders(input.headers);

  if (
    !rawHeaders["x-material-review-signature"].trim() ||
    !rawHeaders["x-material-review-timestamp"].trim()
  ) {
    throw new MaterialSupplementServiceError({
      message: "The internal callback authentication headers are missing.",
      status: 401,
      code: SUPPLEMENT_INTERNAL_ERROR_CODES.INTERNAL_UNAUTHORIZED,
    });
  }

  const parsedHeaders = supplementCallbackHeadersSchema.safeParse(rawHeaders);

  if (!parsedHeaders.success) {
    throw new MaterialSupplementServiceError({
      message: "The internal callback timestamp is invalid.",
      status: 401,
      code: SUPPLEMENT_INTERNAL_ERROR_CODES.INTERNAL_TIMESTAMP_INVALID,
      details: parsedHeaders.error.flatten(),
    });
  }

  const timestamp = parsedHeaders.data["x-material-review-timestamp"];
  const timestampDate = new Date(timestamp);
  const now = input.now ?? new Date();

  if (
    !Number.isFinite(timestampDate.getTime()) ||
    Math.abs(now.getTime() - timestampDate.getTime()) >
      CALLBACK_TIMESTAMP_TOLERANCE_MS
  ) {
    throw new MaterialSupplementServiceError({
      message: "The internal callback timestamp is invalid or expired.",
      status: 401,
      code: SUPPLEMENT_INTERNAL_ERROR_CODES.INTERNAL_TIMESTAMP_INVALID,
    });
  }

  const expectedSignature = createMaterialReviewCallbackSignature({
    secret,
    timestamp,
    rawBody: input.rawBody,
  });

  if (
    !timingSafeStringEqual(
      parsedHeaders.data["x-material-review-signature"],
      expectedSignature,
    )
  ) {
    throw new MaterialSupplementServiceError({
      message: "The internal callback signature is invalid.",
      status: 401,
      code: SUPPLEMENT_INTERNAL_ERROR_CODES.INTERNAL_SIGNATURE_INVALID,
    });
  }
}
