import {
  SUPPLEMENT_REVIEW_MAX_ROUNDS,
  isSupplementCategory,
} from "@/features/material-supplement/constants";
import type {
  MaterialCategoryReviewStatus,
  SupplementCategory,
} from "@/features/material-supplement/types";
import {
  getLatestMaterialCategoryReview,
  listMaterialReviewRuns,
} from "@/lib/data/store";
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
