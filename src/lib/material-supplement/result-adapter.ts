import {
  SUPPLEMENT_CATEGORY_LABELS,
  isSupplementCategory,
} from "@/features/material-supplement/constants";
import type {
  MaterialCategoryReviewStatus,
  MaterialReviewRunStatus,
  SupplementCategory,
  SupplementRequestStatus,
} from "@/features/material-supplement/types";
import type {
  MaterialCategoryReviewResult,
  MaterialReviewJobStatus,
  MaterialReviewResultPayload,
} from "@/lib/material-review/types";
import {
  MaterialSupplementServiceError,
  SUPPLEMENT_EXPERT_ERROR_CODES,
  SUPPLEMENT_INTERNAL_ERROR_CODES,
  type MaterialSupplementErrorCode,
} from "@/lib/material-supplement/errors";

type AdapterRequestInput = {
  title: string;
  reason?: string | null;
  suggestedMaterials?: string[] | string | null;
  aiMessage?: string | null;
  status?: SupplementRequestStatus;
};

type AdapterCategoryInput = {
  category: unknown;
  status: MaterialReviewJobStatus;
  aiMessage?: string | null;
  resultPayload: MaterialReviewResultPayload | null | undefined;
  reviewedAt?: string | null;
};

export type AdaptedMaterialReviewCategoryResult = {
  category: SupplementCategory;
  status: MaterialCategoryReviewStatus;
  aiMessage: string | null;
  resultPayload: Record<string, unknown>;
  requests: Array<{
    title: string;
    reason?: string | null;
    suggestedMaterials?: string[] | string | null;
    aiMessage?: string | null;
    status?: SupplementRequestStatus;
    isSatisfied?: boolean;
    satisfiedAt?: Date | null;
  }>;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

function createInvalidResultError(input: {
  message: string;
  code: MaterialSupplementErrorCode;
  details?: Record<string, unknown>;
}) {
  return new MaterialSupplementServiceError({
    message: input.message,
    status: 502,
    code: input.code,
    details: input.details,
  });
}

function assertSupportedCategory(
  category: unknown,
  invalidCode: MaterialSupplementErrorCode,
): SupplementCategory {
  if (!isSupplementCategory(category)) {
    throw createInvalidResultError({
      message: "The material review result category is unsupported.",
      code: invalidCode,
      details: { category },
    });
  }

  return category;
}

function assertKnownReviewStatus(
  status: MaterialReviewJobStatus,
  invalidCode: MaterialSupplementErrorCode,
): MaterialReviewRunStatus {
  if (
    status !== "QUEUED" &&
    status !== "PROCESSING" &&
    status !== "COMPLETED" &&
    status !== "FAILED"
  ) {
    throw createInvalidResultError({
      message: "The material review result status is invalid.",
      code: invalidCode,
      details: { status },
    });
  }

  return status;
}

function assertValidPayload(
  payload: MaterialReviewResultPayload | null | undefined,
  category: SupplementCategory,
  invalidCode: MaterialSupplementErrorCode,
) {
  if (
    typeof payload?.supplementRequired !== "boolean" ||
    !Array.isArray(payload.requests)
  ) {
    throw createInvalidResultError({
      message: "The material review result payload is invalid.",
      code: invalidCode,
      details: { category },
    });
  }

  if (payload.supplementRequired && payload.requests.length === 0) {
    throw createInvalidResultError({
      message: "The material review result payload has no supplement requests.",
      code: invalidCode,
      details: { category },
    });
  }

  return payload;
}

function toRecordPayload(
  payload: MaterialReviewResultPayload,
): Record<string, unknown> {
  return {
    supplementRequired: payload.supplementRequired,
    requests: payload.requests,
  };
}

function buildSatisfiedRequest(input: {
  category: SupplementCategory;
  aiMessage: string | null;
}) {
  const label = SUPPLEMENT_CATEGORY_LABELS[input.category];

  return {
    title: `${label} complete`,
    reason: `No supplement is required for ${label}.`,
    suggestedMaterials: null,
    aiMessage: input.aiMessage,
    status: "SATISFIED" as const,
    isSatisfied: true,
  };
}

function adaptCategoryResult(input: {
  result: AdapterCategoryInput;
  invalidCode: MaterialSupplementErrorCode;
  preserveRequestStatus: boolean;
}): AdaptedMaterialReviewCategoryResult {
  const category = assertSupportedCategory(
    input.result.category,
    input.invalidCode,
  );
  const status = assertKnownReviewStatus(input.result.status, input.invalidCode);
  const resultPayload = assertValidPayload(
    input.result.resultPayload,
    category,
    input.invalidCode,
  );
  const aiMessage = input.result.aiMessage ?? null;
  const requests = resultPayload.supplementRequired
    ? resultPayload.requests.map((request: AdapterRequestInput) => {
        const requestStatus = input.preserveRequestStatus
          ? (request.status ?? "PENDING")
          : "PENDING";

        return {
          title: request.title,
          reason: request.reason ?? null,
          suggestedMaterials: request.suggestedMaterials ?? null,
          aiMessage: request.aiMessage ?? aiMessage,
          status: requestStatus,
          isSatisfied: requestStatus === "SATISFIED",
        };
      })
    : [
        buildSatisfiedRequest({
          category,
          aiMessage,
        }),
      ];

  return {
    category,
    status,
    aiMessage,
    resultPayload: toRecordPayload(resultPayload),
    requests,
    finishedAt: input.result.reviewedAt
      ? new Date(input.result.reviewedAt)
      : undefined,
  };
}

export function adaptMaterialReviewCategoryResult(
  result: MaterialCategoryReviewResult,
) {
  return adaptCategoryResult({
    result,
    invalidCode: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_RESULT_INVALID,
    preserveRequestStatus: false,
  });
}

export function adaptSupplementReviewCallbackCategory(
  result: AdapterCategoryInput,
) {
  return adaptCategoryResult({
    result,
    invalidCode:
      SUPPLEMENT_INTERNAL_ERROR_CODES.SUPPLEMENT_REVIEW_RESULT_INVALID,
    preserveRequestStatus: true,
  });
}

