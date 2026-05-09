import { describe, expect, it } from "vitest";

import {
  countPendingSupplementRequests,
  countSatisfiedSupplementRequests,
  deriveMaterialSupplementStatus,
  deriveSupplementCategoryState,
  filterVisibleLatestSupplementRequests,
  getRemainingSupplementReviewRounds,
  toHistoricalSupplementRequestStatus,
} from "@/lib/material-supplement/status";

describe("material supplement status helpers", () => {
  it("returns NOT_STARTED when no latest run exists", () => {
    expect(
      deriveMaterialSupplementStatus({
        latestRun: null,
        latestCategoryReviews: [],
        latestRequests: [],
      }),
    ).toBe("NOT_STARTED");
  });

  it("returns REVIEWING when the latest run is queued or processing", () => {
    expect(
      deriveMaterialSupplementStatus({
        latestRun: { status: "PROCESSING" },
        latestCategoryReviews: [],
        latestRequests: [],
      }),
    ).toBe("REVIEWING");
  });

  it("returns REVIEWING when a latest category review is queued or processing", () => {
    expect(
      deriveMaterialSupplementStatus({
        latestRun: { status: "FAILED" },
        latestCategoryReviews: [{ status: "QUEUED" }],
        latestRequests: [],
      }),
    ).toBe("REVIEWING");
  });

  it("returns SUPPLEMENT_REQUIRED when only pending latest requests exist", () => {
    expect(
      deriveMaterialSupplementStatus({
        latestRun: { status: "COMPLETED" },
        latestCategoryReviews: [{ status: "COMPLETED" }],
        latestRequests: [{ status: "PENDING", isSatisfied: false }],
      }),
    ).toBe("SUPPLEMENT_REQUIRED");
  });

  it("returns PARTIALLY_SATISFIED when pending and satisfied latest requests coexist", () => {
    expect(
      deriveMaterialSupplementStatus({
        latestRun: { status: "COMPLETED" },
        latestCategoryReviews: [{ status: "COMPLETED" }],
        latestRequests: [
          { status: "PENDING", isSatisfied: false },
          { status: "SATISFIED", isSatisfied: true },
        ],
      }),
    ).toBe("PARTIALLY_SATISFIED");
  });

  it("returns SATISFIED when only satisfied latest requests exist", () => {
    expect(
      deriveMaterialSupplementStatus({
        latestRun: { status: "COMPLETED" },
        latestCategoryReviews: [{ status: "COMPLETED" }],
        latestRequests: [{ status: "SATISFIED", isSatisfied: true }],
      }),
    ).toBe("SATISFIED");
  });

  it("returns NO_SUPPLEMENT_REQUIRED when a completed latest result has no latest requests", () => {
    expect(
      deriveMaterialSupplementStatus({
        latestRun: { status: "COMPLETED" },
        latestCategoryReviews: [],
        latestRequests: [],
      }),
    ).toBe("NO_SUPPLEMENT_REQUIRED");
  });

  it("falls back to NOT_STARTED when the latest run failed and no usable latest results exist", () => {
    expect(
      deriveMaterialSupplementStatus({
        latestRun: { status: "FAILED" },
        latestCategoryReviews: [{ status: "FAILED" }],
        latestRequests: [],
      }),
    ).toBe("NOT_STARTED");
  });

  it("derives category REVIEW_FAILED when the latest category review failed", () => {
    expect(
      deriveSupplementCategoryState({
        latestReview: { status: "FAILED" },
        latestRequests: [],
      }),
    ).toEqual({
      status: "REVIEW_FAILED",
      isReviewing: false,
    });
  });

  it("derives every category display state from latest review and request data", () => {
    expect(
      deriveSupplementCategoryState({
        latestReview: null,
        latestRequests: [],
      }),
    ).toEqual({
      status: "NOT_STARTED",
      isReviewing: false,
    });
    expect(
      deriveSupplementCategoryState({
        latestReview: { status: "QUEUED" },
        latestRequests: [],
      }),
    ).toEqual({
      status: "REVIEWING",
      isReviewing: true,
    });
    expect(
      deriveSupplementCategoryState({
        latestReview: { status: "PROCESSING" },
        latestRequests: [],
      }),
    ).toEqual({
      status: "REVIEWING",
      isReviewing: true,
    });
    expect(
      deriveSupplementCategoryState({
        latestReview: { status: "COMPLETED" },
        latestRequests: [{ status: "PENDING", isSatisfied: false }],
      }),
    ).toEqual({
      status: "SUPPLEMENT_REQUIRED",
      isReviewing: false,
    });
    expect(
      deriveSupplementCategoryState({
        latestReview: { status: "COMPLETED" },
        latestRequests: [
          { status: "PENDING", isSatisfied: false },
          { status: "SATISFIED", isSatisfied: true },
        ],
      }),
    ).toEqual({
      status: "PARTIALLY_SATISFIED",
      isReviewing: false,
    });
    expect(
      deriveSupplementCategoryState({
        latestReview: { status: "COMPLETED" },
        latestRequests: [{ status: "SATISFIED", isSatisfied: true }],
      }),
    ).toEqual({
      status: "SATISFIED",
      isReviewing: false,
    });
    expect(
      deriveSupplementCategoryState({
        latestReview: { status: "COMPLETED" },
        latestRequests: [],
      }),
    ).toEqual({
      status: "NO_SUPPLEMENT_REQUIRED",
      isReviewing: false,
    });
    expect(
      deriveSupplementCategoryState({
        latestReview: { status: "FAILED" },
        latestRequests: [],
      }),
    ).toEqual({
      status: "REVIEW_FAILED",
      isReviewing: false,
    });
  });

  it("derives all satisfied requests as satisfied and hides them from the main view", () => {
    const requests = [
      { status: "SATISFIED", isSatisfied: true },
      { status: "SATISFIED", isSatisfied: true },
    ] as const;

    expect(
      deriveMaterialSupplementStatus({
        latestRun: { status: "COMPLETED" },
        latestCategoryReviews: [{ status: "COMPLETED" }],
        latestRequests: requests,
      }),
    ).toBe("SATISFIED");
    expect(
      deriveSupplementCategoryState({
        latestReview: { status: "COMPLETED" },
        latestRequests: requests,
      }),
    ).toEqual({
      status: "SATISFIED",
      isReviewing: false,
    });
    expect(filterVisibleLatestSupplementRequests(requests)).toEqual([]);
  });

  it("hides satisfied latest requests from the main view while keeping them countable", () => {
    const requests = [
      { status: "SATISFIED", isSatisfied: true },
      { status: "PENDING", isSatisfied: false },
    ] as const;

    expect(filterVisibleLatestSupplementRequests(requests)).toEqual([
      { status: "PENDING", isSatisfied: false },
    ]);
    expect(countPendingSupplementRequests(requests)).toBe(1);
    expect(countSatisfiedSupplementRequests(requests)).toBe(1);
  });

  it("keeps satisfied requests satisfied when moving them to history", () => {
    expect(
      toHistoricalSupplementRequestStatus({
        status: "SATISFIED",
        isSatisfied: true,
      }),
    ).toBe("SATISFIED");
    expect(
      toHistoricalSupplementRequestStatus({
        status: "PENDING",
        isSatisfied: false,
      }),
    ).toBe("HISTORY_ONLY");
  });

  it("computes remaining rounds from the application run count", () => {
    expect(getRemainingSupplementReviewRounds(0)).toBe(3);
    expect(getRemainingSupplementReviewRounds(1)).toBe(2);
    expect(getRemainingSupplementReviewRounds(3)).toBe(0);
    expect(getRemainingSupplementReviewRounds(9)).toBe(0);
  });
});
