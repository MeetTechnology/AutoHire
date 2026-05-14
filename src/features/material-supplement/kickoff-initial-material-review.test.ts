import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupplementSummary } from "@/features/material-supplement/types";

vi.mock("@/features/material-supplement/client", () => ({
  ensureInitialReview: vi.fn(),
  fetchSupplementReviewRun: vi.fn(),
  fetchSupplementSummary: vi.fn(),
  syncSupplementReviewRun: vi.fn(),
}));

import {
  ensureInitialReview,
  fetchSupplementReviewRun,
  fetchSupplementSummary,
  syncSupplementReviewRun,
} from "@/features/material-supplement/client";

import { kickoffInitialMaterialReview } from "./kickoff-initial-material-review";

function buildSummary(
  overrides?: Partial<SupplementSummary>,
): SupplementSummary {
  return {
    applicationId: "app_001",
    materialSupplementStatus: "NOT_STARTED",
    latestReviewRunId: null,
    latestReviewedAt: null,
    pendingRequestCount: 0,
    satisfiedRequestCount: 0,
    remainingReviewRounds: 3,
    supportedCategories: [],
    ...overrides,
  };
}

describe("kickoffInitialMaterialReview", () => {
  beforeEach(() => {
    vi.mocked(fetchSupplementSummary).mockReset();
    vi.mocked(ensureInitialReview).mockReset();
    vi.mocked(syncSupplementReviewRun).mockReset();
    vi.mocked(fetchSupplementReviewRun).mockReset();
  });

  it("dedupes concurrent invocations per applicationId (Strict Mode–safe)", async () => {
    vi.mocked(fetchSupplementSummary).mockResolvedValue(buildSummary());
    vi.mocked(ensureInitialReview).mockImplementation(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });
      return {
        applicationId: "app_001",
        reviewRunId: "run_new",
        runNo: 1,
        status: "PROCESSING",
        created: true,
      };
    });
    vi.mocked(syncSupplementReviewRun).mockResolvedValue({
      reviewRunId: "run_new",
      status: "COMPLETED",
      synced: true,
      updatedCategories: [],
    });

    await Promise.all([
      kickoffInitialMaterialReview("app_001"),
      kickoffInitialMaterialReview("app_001"),
    ]);

    expect(ensureInitialReview).toHaveBeenCalledTimes(1);
    expect(ensureInitialReview).toHaveBeenCalledWith("app_001");
  });

  it("runs independently for different application ids", async () => {
    vi.mocked(fetchSupplementSummary).mockImplementation(async (id: string) =>
      buildSummary({ applicationId: id }),
    );
    vi.mocked(ensureInitialReview).mockImplementation(async (id: string) => ({
      applicationId: id,
      reviewRunId: `run_${id}`,
      runNo: 1,
      status: "PROCESSING",
      created: true,
    }));
    vi.mocked(syncSupplementReviewRun).mockResolvedValue({
      reviewRunId: "run_x",
      status: "COMPLETED",
      synced: true,
      updatedCategories: [],
    });

    await Promise.all([
      kickoffInitialMaterialReview("app_a"),
      kickoffInitialMaterialReview("app_b"),
    ]);

    expect(ensureInitialReview).toHaveBeenCalledTimes(2);
    expect(ensureInitialReview).toHaveBeenCalledWith("app_a");
    expect(ensureInitialReview).toHaveBeenCalledWith("app_b");
  });

  it("skips ensure when summary already has a review run", async () => {
    vi.mocked(fetchSupplementSummary).mockResolvedValue(
      buildSummary({
        materialSupplementStatus: "REVIEWING",
        latestReviewRunId: "run_existing",
      }),
    );

    await kickoffInitialMaterialReview("app_001");

    expect(ensureInitialReview).not.toHaveBeenCalled();
  });
});
