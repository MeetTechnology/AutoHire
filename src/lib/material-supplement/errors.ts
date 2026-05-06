import { NextResponse } from "next/server";

export const SUPPLEMENT_EXPERT_ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  APPLICATION_NOT_FOUND: "APPLICATION_NOT_FOUND",
  APPLICATION_NOT_SUBMITTED: "APPLICATION_NOT_SUBMITTED",
  SUPPLEMENT_SUMMARY_LOAD_FAILED: "SUPPLEMENT_SUMMARY_LOAD_FAILED",
  INITIAL_REVIEW_CREATE_FAILED: "INITIAL_REVIEW_CREATE_FAILED",
  MATERIAL_REVIEW_BACKEND_UNAVAILABLE: "MATERIAL_REVIEW_BACKEND_UNAVAILABLE",
  SUPPLEMENT_CATEGORY_UNSUPPORTED: "SUPPLEMENT_CATEGORY_UNSUPPORTED",
  SUPPLEMENT_CATEGORY_REVIEWING: "SUPPLEMENT_CATEGORY_REVIEWING",
  SUPPLEMENT_ROUND_LIMIT_REACHED: "SUPPLEMENT_ROUND_LIMIT_REACHED",
  SUPPLEMENT_FILE_COUNT_EXCEEDED: "SUPPLEMENT_FILE_COUNT_EXCEEDED",
} as const;

export const SUPPLEMENT_INTERNAL_ERROR_CODES = {
  INTERNAL_UNAUTHORIZED: "INTERNAL_UNAUTHORIZED",
  INTERNAL_SIGNATURE_INVALID: "INTERNAL_SIGNATURE_INVALID",
  INTERNAL_TIMESTAMP_INVALID: "INTERNAL_TIMESTAMP_INVALID",
  SUPPLEMENT_REVIEW_RUN_NOT_FOUND: "SUPPLEMENT_REVIEW_RUN_NOT_FOUND",
  SUPPLEMENT_REVIEW_CALLBACK_STALE: "SUPPLEMENT_REVIEW_CALLBACK_STALE",
  SUPPLEMENT_REVIEW_CALLBACK_DUPLICATE: "SUPPLEMENT_REVIEW_CALLBACK_DUPLICATE",
  SUPPLEMENT_REVIEW_RESULT_INVALID: "SUPPLEMENT_REVIEW_RESULT_INVALID",
  SUPPLEMENT_REVIEW_RESULT_SAVE_FAILED: "SUPPLEMENT_REVIEW_RESULT_SAVE_FAILED",
} as const;

export const SUPPLEMENT_ERROR_CODES = {
  ...SUPPLEMENT_EXPERT_ERROR_CODES,
  ...SUPPLEMENT_INTERNAL_ERROR_CODES,
} as const;

export type MaterialSupplementErrorCode =
  (typeof SUPPLEMENT_ERROR_CODES)[keyof typeof SUPPLEMENT_ERROR_CODES];

export type MaterialSupplementErrorDetails = Record<string, unknown>;

export class MaterialSupplementServiceError extends Error {
  status: number;
  code: MaterialSupplementErrorCode;
  details?: MaterialSupplementErrorDetails;

  constructor(input: {
    message: string;
    status: number;
    code: MaterialSupplementErrorCode;
    details?: MaterialSupplementErrorDetails;
  }) {
    super(input.message);
    this.name = "MaterialSupplementServiceError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
  }
}

export function jsonSupplementError(
  message: string,
  status: number,
  code: MaterialSupplementErrorCode,
  details?: MaterialSupplementErrorDetails,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

export function jsonSupplementServiceError(
  error: MaterialSupplementServiceError,
) {
  return jsonSupplementError(
    error.message,
    error.status,
    error.code,
    error.details,
  );
}
