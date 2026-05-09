import {
  SUPPLEMENT_REVIEW_MAX_ROUNDS,
  isSupplementCategory,
} from "@/features/material-supplement/constants";
import type {
  MaterialCategoryReviewStatus,
  MaterialReviewRunStatus,
  SupplementCategory,
  SupplementSnapshot,
  SupplementSummary,
} from "@/features/material-supplement/types";
import {
  claimMaterialReviewRunStartup,
  getMaterialReviewRunByApplicationAndRunNo,
  getMaterialReviewRunById,
  getLatestMaterialCategoryReview,
  getMaterialSupplementHistoryData,
  getMaterialSupplementSnapshotData,
  getMaterialSupplementSummaryData,
  listMaterialCategoryReviews,
  listMaterialReviewRuns,
  saveMaterialReviewResult,
  updateMaterialReviewRun,
  createMaterialReviewRun,
} from "@/lib/data/store";
import {
  createInitialMaterialReview,
  getMaterialReviewResult,
} from "@/lib/material-review/client";
import {
  MaterialReviewClientError,
  type MaterialReviewJobStatus,
} from "@/lib/material-review/types";
import {
  MaterialSupplementServiceError,
  SUPPLEMENT_EXPERT_ERROR_CODES,
  SUPPLEMENT_INTERNAL_ERROR_CODES,
} from "@/lib/material-supplement/errors";
import {
  adaptMaterialReviewCategoryResult,
  adaptSupplementReviewCallbackCategory,
} from "@/lib/material-supplement/result-adapter";
import { getRemainingSupplementReviewRounds } from "@/lib/material-supplement/status";
import type { supplementReviewCallbackBodySchema } from "@/lib/material-supplement/schemas";
import type { z } from "zod";

const REVIEW_PROCESSING_STATUSES: ReadonlySet<MaterialCategoryReviewStatus> =
  new Set(["QUEUED", "PROCESSING"]);

export function assertSupportedSupplementCategory(
  category: unknown,
): SupplementCategory {
  if (!isSupplementCategory(category)) {
    throw new MaterialSupplementServiceError({
      message: "The supplement category is not supported.",
      status: 400,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_CATEGORY_UNSUPPORTED,
    });
  }

  return category;
}

export async function assertCategoryNotReviewing(input: {
  applicationId: string;
  category: SupplementCategory;
}) {
  const latestReview = await getLatestMaterialCategoryReview(
    input.applicationId,
    input.category,
  );

  if (latestReview && REVIEW_PROCESSING_STATUSES.has(latestReview.status)) {
    throw new MaterialSupplementServiceError({
      message:
        "This category is currently under review. Please wait until the review is complete.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_CATEGORY_REVIEWING,
      details: {
        category: input.category,
      },
    });
  }
}

export async function assertReviewRoundLimit(input: { applicationId: string }) {
  const reviewRuns = await listMaterialReviewRuns(input.applicationId);
  const remainingReviewRounds = getRemainingSupplementReviewRounds(
    reviewRuns.length,
  );

  if (remainingReviewRounds <= 0) {
    throw new MaterialSupplementServiceError({
      message:
        "The supplement review round limit has been reached for this application.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_ROUND_LIMIT_REACHED,
      details: {
        maxRounds: SUPPLEMENT_REVIEW_MAX_ROUNDS,
      },
    });
  }
}

export async function getSupplementSummary(applicationId: string) {
  try {
    const summary = await getMaterialSupplementSummaryData(applicationId);

    return {
      applicationId: summary.applicationId,
      materialSupplementStatus: summary.materialSupplementStatus,
      latestReviewRunId: summary.latestReviewRunId,
      latestReviewedAt: summary.latestReviewedAt,
      pendingRequestCount: summary.pendingRequestCount,
      satisfiedRequestCount: summary.satisfiedRequestCount,
      remainingReviewRounds: summary.remainingReviewRounds,
      supportedCategories: summary.supportedCategories,
    } satisfies SupplementSummary;
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    throw new MaterialSupplementServiceError({
      message: "Failed to load the material supplement summary.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_SUMMARY_LOAD_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}

export async function getSupplementSnapshot(applicationId: string) {
  try {
    return (await getMaterialSupplementSnapshotData(
      applicationId,
    )) satisfies SupplementSnapshot;
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    throw new MaterialSupplementServiceError({
      message: "Failed to load the material supplement snapshot.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_SNAPSHOT_LOAD_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}

export type SupplementHistoryFilters = {
  category?: SupplementCategory;
  runNo?: number;
};

export async function getSupplementHistory(
  applicationId: string,
  filters?: SupplementHistoryFilters,
) {
  try {
    return await getMaterialSupplementHistoryData(applicationId, filters);
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    throw new MaterialSupplementServiceError({
      message: "Failed to load the material supplement history.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_HISTORY_LOAD_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}

export type SupplementReviewRunResult = {
  reviewRunId: string;
  applicationId: string;
  runNo: number;
  status: MaterialReviewRunStatus;
  triggerType: string;
  triggeredCategory: SupplementCategory | null;
  startedAt: string | null;
  finishedAt: string | null;
  categories: Array<{
    category: SupplementCategory;
    status: MaterialCategoryReviewStatus;
    isLatest: boolean;
  }>;
};

export type SyncSupplementReviewRunResult = {
  reviewRunId: string;
  status: MaterialReviewRunStatus;
  synced: boolean;
  updatedCategories: SupplementCategory[];
};

export type AcceptSupplementReviewCallbackResult = {
  reviewRunId: string;
  accepted: true;
  status: MaterialReviewRunStatus;
  updatedCategories: SupplementCategory[];
};

type SupplementReviewCallbackBody = z.infer<
  typeof supplementReviewCallbackBodySchema
>;

function toIsoString(value: Date | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function assertKnownReviewStatus(
  status: MaterialReviewJobStatus,
): MaterialReviewRunStatus {
  if (
    status !== "QUEUED" &&
    status !== "PROCESSING" &&
    status !== "COMPLETED" &&
    status !== "FAILED"
  ) {
    throw new MaterialSupplementServiceError({
      message: "The material review result status is invalid.",
      status: 502,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_RESULT_INVALID,
    });
  }

  return status;
}

function mapMaterialReviewClientError(error: MaterialReviewClientError) {
  if (error.failureCode === "RESULT_INVALID") {
    return new MaterialSupplementServiceError({
      message: "The material review result payload is invalid.",
      status: 502,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_RESULT_INVALID,
      details: { failureCode: error.failureCode },
    });
  }

  if (
    error.failureCode === "CONFIG_ERROR" ||
    error.failureCode === "BACKEND_UNAVAILABLE" ||
    error.failureCode === "NETWORK_ERROR" ||
    error.failureCode === "TIMEOUT" ||
    error.failureCode === "HTTP_ERROR" ||
    error.failureCode === "RESULT_NOT_READY"
  ) {
    return new MaterialSupplementServiceError({
      message: "The material review backend is currently unavailable.",
      status: 503,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.MATERIAL_REVIEW_BACKEND_UNAVAILABLE,
      details: { failureCode: error.failureCode },
    });
  }

  return new MaterialSupplementServiceError({
    message: "Failed to sync the supplement review result.",
    status: 500,
    code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_SYNC_FAILED,
    details: { failureCode: error.failureCode },
  });
}

export async function getSupplementReviewRun(
  applicationId: string,
  reviewRunId: string,
): Promise<SupplementReviewRunResult> {
  try {
    const reviewRun = await getMaterialReviewRunById(reviewRunId);

    if (!reviewRun || reviewRun.applicationId !== applicationId) {
      throw new MaterialSupplementServiceError({
        message: "The supplement review run could not be found.",
        status: 404,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_RUN_NOT_FOUND,
        details: { reviewRunId },
      });
    }

    const categories = await listMaterialCategoryReviews(applicationId, {
      reviewRunId,
    });

    return {
      reviewRunId: reviewRun.id,
      applicationId: reviewRun.applicationId,
      runNo: reviewRun.runNo,
      status: reviewRun.status as MaterialReviewRunStatus,
      triggerType: reviewRun.triggerType,
      triggeredCategory:
        (reviewRun.triggeredCategory as SupplementCategory | null) ?? null,
      startedAt: toIsoString(reviewRun.startedAt),
      finishedAt: toIsoString(reviewRun.finishedAt),
      categories: categories.map((category) => ({
        category: category.category as SupplementCategory,
        status: category.status as MaterialCategoryReviewStatus,
        isLatest: category.isLatest,
      })),
    };
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    throw new MaterialSupplementServiceError({
      message: "Failed to load the supplement review run status.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_STATUS_LOAD_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}

export async function syncSupplementReviewRun(
  applicationId: string,
  reviewRunId: string,
): Promise<SyncSupplementReviewRunResult> {
  const reviewRun = await getMaterialReviewRunById(reviewRunId);

  if (!reviewRun || reviewRun.applicationId !== applicationId) {
    throw new MaterialSupplementServiceError({
      message: "The supplement review run could not be found.",
      status: 404,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_RUN_NOT_FOUND,
      details: { reviewRunId },
    });
  }

  if (!reviewRun.externalRunId) {
    throw new MaterialSupplementServiceError({
      message: "The supplement review run has no external review task.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_SYNC_FAILED,
      details: { reviewRunId },
    });
  }

  try {
    const result = await getMaterialReviewResult({
      externalRunId: reviewRun.externalRunId,
    });
    const status = assertKnownReviewStatus(result.status);
    const syncedResult = await saveMaterialReviewResult({
      applicationId,
      reviewRunId,
      status,
      startedAt: result.startedAt ? new Date(result.startedAt) : undefined,
      finishedAt: result.finishedAt ? new Date(result.finishedAt) : undefined,
      categories:
        status === "COMPLETED"
          ? result.categories.map(adaptMaterialReviewCategoryResult)
          : [],
    });

    if (!syncedResult) {
      throw new MaterialSupplementServiceError({
        message: "The supplement review run could not be found.",
        status: 404,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_RUN_NOT_FOUND,
        details: { reviewRunId },
      });
    }

    return {
      reviewRunId,
      status: syncedResult.reviewRun.status as MaterialReviewRunStatus,
      synced: syncedResult.updatedCategories.length > 0,
      updatedCategories: syncedResult.updatedCategories,
    };
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    if (error instanceof MaterialReviewClientError) {
      throw mapMaterialReviewClientError(error);
    }

    throw new MaterialSupplementServiceError({
      message: "Failed to sync the supplement review result.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_SYNC_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}

export async function acceptSupplementReviewCallback(
  reviewRunId: string,
  payload: SupplementReviewCallbackBody,
): Promise<AcceptSupplementReviewCallbackResult> {
  const reviewRun = await getMaterialReviewRunById(reviewRunId);

  if (!reviewRun) {
    throw new MaterialSupplementServiceError({
      message: "The supplement review run could not be found.",
      status: 404,
      code: SUPPLEMENT_INTERNAL_ERROR_CODES.SUPPLEMENT_REVIEW_RUN_NOT_FOUND,
      details: { reviewRunId },
    });
  }

  if (
    reviewRun.externalRunId !== null &&
    reviewRun.externalRunId !== payload.externalRunId
  ) {
    throw new MaterialSupplementServiceError({
      message: "The supplement review callback is stale.",
      status: 409,
      code: SUPPLEMENT_INTERNAL_ERROR_CODES.SUPPLEMENT_REVIEW_CALLBACK_STALE,
      details: {
        reviewRunId,
        externalRunId: payload.externalRunId,
      },
    });
  }

  const status = assertKnownReviewStatus(payload.status);
  const externalRunIdPatch =
    reviewRun.externalRunId === null
      ? { externalRunId: payload.externalRunId }
      : {};

  try {
    if (status !== "COMPLETED") {
      if (reviewRun.status === "COMPLETED") {
        return {
          reviewRunId,
          accepted: true,
          status: "COMPLETED",
          updatedCategories: [],
        };
      }

      const updatedRun = await updateMaterialReviewRun(reviewRunId, {
        ...externalRunIdPatch,
        status,
        finishedAt: payload.finishedAt ? new Date(payload.finishedAt) : null,
        errorMessage:
          status === "FAILED" ? "Callback marked run failed." : null,
      });

      if (!updatedRun) {
        throw new MaterialSupplementServiceError({
          message: "The supplement review run could not be found.",
          status: 404,
          code: SUPPLEMENT_INTERNAL_ERROR_CODES.SUPPLEMENT_REVIEW_RUN_NOT_FOUND,
          details: { reviewRunId },
        });
      }

      return {
        reviewRunId,
        accepted: true,
        status: updatedRun.status as MaterialReviewRunStatus,
        updatedCategories: [],
      };
    }

    if (reviewRun.externalRunId === null) {
      await updateMaterialReviewRun(reviewRunId, externalRunIdPatch);
    }

    const savedResult = await saveMaterialReviewResult({
      applicationId: reviewRun.applicationId,
      reviewRunId,
      status,
      finishedAt: payload.finishedAt ? new Date(payload.finishedAt) : null,
      categories: payload.categories.map(adaptSupplementReviewCallbackCategory),
    });

    if (!savedResult) {
      throw new MaterialSupplementServiceError({
        message: "The supplement review run could not be found.",
        status: 404,
        code: SUPPLEMENT_INTERNAL_ERROR_CODES.SUPPLEMENT_REVIEW_RUN_NOT_FOUND,
        details: { reviewRunId },
      });
    }

    return {
      reviewRunId,
      accepted: true,
      status: savedResult.reviewRun.status as MaterialReviewRunStatus,
      updatedCategories: savedResult.updatedCategories,
    };
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    throw new MaterialSupplementServiceError({
      message: "Failed to save the supplement review callback result.",
      status: 500,
      code: SUPPLEMENT_INTERNAL_ERROR_CODES.SUPPLEMENT_REVIEW_RESULT_SAVE_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}

export type EnsureInitialSupplementReviewResult = {
  applicationId: string;
  reviewRunId: string;
  runNo: number;
  status: string;
  created: boolean;
};

const INITIAL_SUPPLEMENT_REVIEW_RUN_NO = 1;
const INITIAL_REVIEW_STARTUP_CLAIMABLE_STATUSES: ReadonlyArray<
  "QUEUED" | "FAILED"
> = ["QUEUED", "FAILED"];

export async function ensureInitialSupplementReview(
  applicationId: string,
): Promise<EnsureInitialSupplementReviewResult> {
  const existingRun = await getMaterialReviewRunByApplicationAndRunNo(
    applicationId,
    INITIAL_SUPPLEMENT_REVIEW_RUN_NO,
  );
  let reviewRun = existingRun;

  if (!reviewRun) {
    try {
      reviewRun = await createMaterialReviewRun({
        applicationId,
        runNo: INITIAL_SUPPLEMENT_REVIEW_RUN_NO,
        triggerType: "INITIAL_SUBMISSION",
      });
    } catch (error) {
      throw new MaterialSupplementServiceError({
        message: "Failed to create the initial supplement review run.",
        status: 500,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.INITIAL_REVIEW_CREATE_FAILED,
        details: error instanceof Error ? { cause: error.message } : undefined,
      });
    }
  }

  if (
    reviewRun.externalRunId !== null ||
    !INITIAL_REVIEW_STARTUP_CLAIMABLE_STATUSES.includes(
      reviewRun.status as "QUEUED" | "FAILED",
    )
  ) {
    return {
      applicationId,
      reviewRunId: reviewRun.id,
      runNo: reviewRun.runNo,
      status: reviewRun.status,
      created: false,
    };
  }

  const claimedRun = await claimMaterialReviewRunStartup(reviewRun.id, [
    ...INITIAL_REVIEW_STARTUP_CLAIMABLE_STATUSES,
  ]);

  if (!claimedRun) {
    const currentRun = await getMaterialReviewRunByApplicationAndRunNo(
      applicationId,
      INITIAL_SUPPLEMENT_REVIEW_RUN_NO,
    );

    if (!currentRun) {
      throw new MaterialSupplementServiceError({
        message: "Failed to create the initial supplement review run.",
        status: 500,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.INITIAL_REVIEW_CREATE_FAILED,
      });
    }

    return {
      applicationId,
      reviewRunId: currentRun.id,
      runNo: currentRun.runNo,
      status: currentRun.status,
      created: false,
    };
  }

  try {
    const review = await createInitialMaterialReview({ applicationId });
    const updatedRun = await updateMaterialReviewRun(claimedRun.id, {
      status: review.status,
      externalRunId: review.externalRunId,
      startedAt: review.startedAt ? new Date(review.startedAt) : null,
      finishedAt: review.finishedAt ? new Date(review.finishedAt) : null,
      errorMessage: null,
    });

    if (!updatedRun) {
      throw new MaterialSupplementServiceError({
        message: "Failed to update the initial supplement review run.",
        status: 500,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.INITIAL_REVIEW_CREATE_FAILED,
      });
    }

    return {
      applicationId,
      reviewRunId: updatedRun.id,
      runNo: updatedRun.runNo,
      status: updatedRun.status,
      created: true,
    };
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    if (error instanceof MaterialReviewClientError) {
      await updateMaterialReviewRun(claimedRun.id, {
        status: "FAILED",
        errorMessage: error.message,
        externalRunId: null,
        finishedAt: null,
      });

      throw new MaterialSupplementServiceError({
        message: "The material review backend is currently unavailable.",
        status: 503,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.MATERIAL_REVIEW_BACKEND_UNAVAILABLE,
        details: {
          failureCode: error.failureCode,
        },
      });
    }

    throw new MaterialSupplementServiceError({
      message: "Failed to create the initial supplement review run.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.INITIAL_REVIEW_CREATE_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}
