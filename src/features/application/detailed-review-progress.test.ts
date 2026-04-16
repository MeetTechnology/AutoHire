import { describe, expect, it } from "vitest";

import {
  getDetailedReviewProgressSummary,
  isDetailedReviewReadyForUi,
  shouldShowDetailedReviewStartedNotice,
} from "./detailed-review-progress";

describe("getDetailedReviewProgressSummary", () => {
  it("returns compact progress for an incomplete run", () => {
    expect(
      getDetailedReviewProgressSummary(
        {
          id: "run-1",
          status: "processing",
          totalPrompts: 9,
          completedPrompts: 4,
          failedPromptIds: [],
          errorMessage: null,
        },
        "processing",
      ),
    ).toEqual({
      completedPrompts: 4,
      totalPrompts: 9,
      progressLabel: "4/9",
      statusValue: "processing",
      isComplete: false,
    });
  });

  it("clamps completed prompts at the total", () => {
    expect(
      getDetailedReviewProgressSummary(
        {
          id: "run-1",
          status: "completed",
          totalPrompts: 9,
          completedPrompts: 12,
          failedPromptIds: [],
          errorMessage: null,
        },
        "completed",
      ),
    )?.toMatchObject({
      completedPrompts: 9,
      progressLabel: "9/9",
      isComplete: true,
    });
  });
});

describe("isDetailedReviewReadyForUi", () => {
  it("waits for prompt completion before showing the ready state", () => {
    const progress = getDetailedReviewProgressSummary(
      {
        id: "run-1",
        status: "processing",
        totalPrompts: 9,
        completedPrompts: 8,
        failedPromptIds: [],
        errorMessage: null,
      },
      "processing",
    );

    expect(isDetailedReviewReadyForUi("SECONDARY_REVIEW", progress)).toBe(false);
  });

  it("allows the ready state once all prompts complete", () => {
    const progress = getDetailedReviewProgressSummary(
      {
        id: "run-1",
        status: "completed",
        totalPrompts: 9,
        completedPrompts: 9,
        failedPromptIds: [],
        errorMessage: null,
      },
      "completed",
    );

    expect(isDetailedReviewReadyForUi("SECONDARY_REVIEW", progress)).toBe(true);
  });
});

describe("shouldShowDetailedReviewStartedNotice", () => {
  it("keeps the started notice while work remains", () => {
    const progress = getDetailedReviewProgressSummary(
      {
        id: "run-1",
        status: "processing",
        totalPrompts: 9,
        completedPrompts: 3,
        failedPromptIds: [],
        errorMessage: null,
      },
      "processing",
    );

    expect(shouldShowDetailedReviewStartedNotice("run-1", progress)).toBe(true);
  });

  it("hides the started notice after completion", () => {
    const progress = getDetailedReviewProgressSummary(
      {
        id: "run-1",
        status: "completed",
        totalPrompts: 9,
        completedPrompts: 9,
        failedPromptIds: [],
        errorMessage: null,
      },
      "completed",
    );

    expect(shouldShowDetailedReviewStartedNotice("run-1", progress)).toBe(false);
  });
});
