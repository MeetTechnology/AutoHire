import { SUPPLEMENT_REVIEW_MAX_ROUNDS } from "@/features/material-supplement/constants";
import type {
  MaterialCategoryReviewStatus,
  MaterialReviewRunStatus,
  MaterialSupplementStatus,
  SupplementCategoryDisplayStatus,
  SupplementRequestStatus,
} from "@/features/material-supplement/types";

type ReviewRunLike = {
  status: MaterialReviewRunStatus;
};

type CategoryReviewLike = {
  status: MaterialCategoryReviewStatus;
};

type SupplementRequestLike = {
  status: SupplementRequestStatus;
  isSatisfied: boolean;
};

export type DerivedSupplementCategoryState = {
  status: SupplementCategoryDisplayStatus;
  isReviewing: boolean;
};

function isReviewProcessing(status: MaterialReviewRunStatus | MaterialCategoryReviewStatus) {
  return status === "QUEUED" || status === "PROCESSING";
}

export function isSupplementRequestPending(request: SupplementRequestLike) {
  return !request.isSatisfied && request.status !== "SATISFIED";
}

export function isSupplementRequestSatisfied(request: SupplementRequestLike) {
  return request.isSatisfied || request.status === "SATISFIED";
}

export function countPendingSupplementRequests(
  requests: readonly SupplementRequestLike[],
) {
  return requests.filter(isSupplementRequestPending).length;
}

export function countSatisfiedSupplementRequests(
  requests: readonly SupplementRequestLike[],
) {
  return requests.filter(isSupplementRequestSatisfied).length;
}

export function filterVisibleLatestSupplementRequests<T extends SupplementRequestLike>(
  requests: readonly T[],
) {
  return requests.filter((request) => !isSupplementRequestSatisfied(request));
}

export function toHistoricalSupplementRequestStatus(
  request: Pick<SupplementRequestLike, "isSatisfied" | "status">,
) {
  if (request.isSatisfied || request.status === "SATISFIED") {
    return "SATISFIED" satisfies SupplementRequestStatus;
  }

  return "HISTORY_ONLY" satisfies SupplementRequestStatus;
}

export function getRemainingSupplementReviewRounds(runCount: number) {
  return Math.max(0, SUPPLEMENT_REVIEW_MAX_ROUNDS - runCount);
}

export function deriveMaterialSupplementStatus(input: {
  latestRun: ReviewRunLike | null;
  latestCategoryReviews: readonly CategoryReviewLike[];
  latestRequests: readonly SupplementRequestLike[];
}): MaterialSupplementStatus {
  if (!input.latestRun) {
    return "NOT_STARTED";
  }

  if (
    isReviewProcessing(input.latestRun.status) ||
    input.latestCategoryReviews.some((review) => isReviewProcessing(review.status))
  ) {
    return "REVIEWING";
  }

  const pendingCount = countPendingSupplementRequests(input.latestRequests);
  const satisfiedCount = countSatisfiedSupplementRequests(input.latestRequests);

  if (pendingCount > 0 && satisfiedCount > 0) {
    return "PARTIALLY_SATISFIED";
  }

  if (pendingCount > 0) {
    return "SUPPLEMENT_REQUIRED";
  }

  if (satisfiedCount > 0) {
    return "SATISFIED";
  }

  if (
    input.latestRun.status === "COMPLETED" ||
    input.latestCategoryReviews.some((review) => review.status === "COMPLETED")
  ) {
    return "NO_SUPPLEMENT_REQUIRED";
  }

  return "NOT_STARTED";
}

export function deriveSupplementCategoryState(input: {
  latestReview: CategoryReviewLike | null;
  latestRequests: readonly SupplementRequestLike[];
}): DerivedSupplementCategoryState {
  if (!input.latestReview) {
    return {
      status: "NOT_STARTED",
      isReviewing: false,
    };
  }

  if (isReviewProcessing(input.latestReview.status)) {
    return {
      status: "REVIEWING",
      isReviewing: true,
    };
  }

  if (input.latestReview.status === "FAILED") {
    return {
      status: "REVIEW_FAILED",
      isReviewing: false,
    };
  }

  const pendingCount = countPendingSupplementRequests(input.latestRequests);
  const satisfiedCount = countSatisfiedSupplementRequests(input.latestRequests);

  if (pendingCount > 0 && satisfiedCount > 0) {
    return {
      status: "PARTIALLY_SATISFIED",
      isReviewing: false,
    };
  }

  if (pendingCount > 0) {
    return {
      status: "SUPPLEMENT_REQUIRED",
      isReviewing: false,
    };
  }

  if (satisfiedCount > 0) {
    return {
      status: "SATISFIED",
      isReviewing: false,
    };
  }

  return {
    status: "NO_SUPPLEMENT_REQUIRED",
    isReviewing: false,
  };
}
