import {
  SUPPLEMENT_REVIEW_MAX_ROUNDS,
  isSupplementCategory,
} from "@/features/material-supplement/constants";
import type {
  MaterialCategoryReviewStatus,
  SupplementCategory,
  SupplementSummary,
} from "@/features/material-supplement/types";
import {
  claimMaterialReviewRunStartup,
  getMaterialReviewRunByApplicationAndRunNo,
  getLatestMaterialCategoryReview,
  getMaterialSupplementSummaryData,
  listMaterialReviewRuns,
  updateMaterialReviewRun,
  createMaterialReviewRun,
} from "@/lib/data/store";
import {
  createInitialMaterialReview,
} from "@/lib/material-review/client";
import { MaterialReviewClientError } from "@/lib/material-review/types";
import {
  MaterialSupplementServiceError,
  SUPPLEMENT_EXPERT_ERROR_CODES,
} from "@/lib/material-supplement/errors";
import { getRemainingSupplementReviewRounds } from "@/lib/material-supplement/status";

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

export type EnsureInitialSupplementReviewResult = {
  applicationId: string;
  reviewRunId: string;
  runNo: number;
  status: string;
  created: boolean;
};

const INITIAL_SUPPLEMENT_REVIEW_RUN_NO = 1;
const INITIAL_REVIEW_STARTUP_CLAIMABLE_STATUSES: ReadonlyArray<"QUEUED" | "FAILED"> =
  ["QUEUED", "FAILED"];

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
