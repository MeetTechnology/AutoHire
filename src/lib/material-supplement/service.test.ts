import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMaterialReviewRun,
  getMaterialReviewRunByApplicationAndRunNo,
  listMaterialReviewRuns,
  updateApplication,
} from "@/lib/data/store";
import * as materialReviewClient from "@/lib/material-review/client";
import {
  assertCategoryNotReviewing,
  assertReviewRoundLimit,
  assertSupportedSupplementCategory,
  ensureInitialSupplementReview,
} from "@/lib/material-supplement/service";
import { MaterialSupplementServiceError } from "@/lib/material-supplement/errors";
import { MaterialReviewClientError } from "@/lib/material-review/types";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

describe("material supplement service guards", () => {
  beforeEach(() => {
    process.env.APP_RUNTIME_MODE = "memory";
    resetMemoryStore();
  });

  it("accepts supported supplement categories", () => {
    expect(assertSupportedSupplementCategory("EDUCATION")).toBe("EDUCATION");
  });

  it("rejects unsupported supplement categories", () => {
    expect(() => assertSupportedSupplementCategory("PRODUCT")).toThrowError(
      expect.objectContaining<Partial<MaterialSupplementServiceError>>({
        status: 400,
        code: "SUPPLEMENT_CATEGORY_UNSUPPORTED",
      }),
    );
  });

  it("blocks a category while its latest review is processing", async () => {
    await expect(
      assertCategoryNotReviewing({
        applicationId: "app_supplement_reviewing",
        category: "IDENTITY",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_CATEGORY_REVIEWING",
      details: {
        category: "IDENTITY",
      },
    });
  });

  it("allows categories whose latest review is not processing", async () => {
    await expect(
      assertCategoryNotReviewing({
        applicationId: "app_supplement_required",
        category: "EMPLOYMENT",
      }),
    ).resolves.toBeUndefined();
  });

  it("allows applications that are still below the round limit", async () => {
    await expect(
      assertReviewRoundLimit({
        applicationId: "app_supplement_required",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects applications that have reached the review round limit", async () => {
    await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EMPLOYMENT",
      status: "QUEUED",
    });

    await expect(
      assertReviewRoundLimit({
        applicationId: "app_supplement_required",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_ROUND_LIMIT_REACHED",
      details: {
        maxRounds: 3,
      },
    });
  });
});

describe("ensureInitialSupplementReview", () => {
  beforeEach(() => {
    process.env.APP_RUNTIME_MODE = "memory";
    resetMemoryStore();
    vi.restoreAllMocks();
  });

  it("allows only one caller to kick off the initial review under concurrency", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });

    let resolveReview: ((value: {
      externalRunId: string;
      status: "COMPLETED";
      startedAt: string;
      finishedAt: string;
    }) => void) | null = null;
    const reviewStarted = new Promise<void>((resolve) => {
      vi.spyOn(materialReviewClient, "createInitialMaterialReview").mockImplementation(
        async () => {
          resolve();

          return new Promise((innerResolve) => {
            resolveReview = innerResolve;
          });
        },
      );
    });

    const firstAttempt = ensureInitialSupplementReview("app_secondary");
    await reviewStarted;

    const secondAttempt = await ensureInitialSupplementReview("app_secondary");

    expect(secondAttempt).toMatchObject({
      applicationId: "app_secondary",
      runNo: 1,
      status: "PROCESSING",
      created: false,
    });

    resolveReview?.({
      externalRunId: "mock-material-review:initial:concurrent",
      status: "COMPLETED",
      startedAt: new Date("2026-05-07T01:00:00.000Z").toISOString(),
      finishedAt: new Date("2026-05-07T01:00:01.000Z").toISOString(),
    });

    await expect(firstAttempt).resolves.toMatchObject({
      applicationId: "app_secondary",
      runNo: 1,
      status: "COMPLETED",
      created: true,
    });

    expect(materialReviewClient.createInitialMaterialReview).toHaveBeenCalledTimes(1);
    await expect(listMaterialReviewRuns("app_secondary")).resolves.toHaveLength(1);
  });

  it("retries a failed startup on the existing initial review run", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });

    const reviewSpy = vi
      .spyOn(materialReviewClient, "createInitialMaterialReview")
      .mockRejectedValueOnce(
        new MaterialReviewClientError({
          message: "Backend unavailable.",
          failureCode: "BACKEND_UNAVAILABLE",
          retryable: true,
          httpStatus: 503,
        }),
      )
      .mockResolvedValueOnce({
        externalRunId: "mock-material-review:initial:retry",
        status: "COMPLETED",
        startedAt: new Date("2026-05-07T02:00:00.000Z").toISOString(),
        finishedAt: new Date("2026-05-07T02:00:01.000Z").toISOString(),
      });

    await expect(
      ensureInitialSupplementReview("app_secondary"),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 503,
      code: "MATERIAL_REVIEW_BACKEND_UNAVAILABLE",
    });

    const failedRun = await getMaterialReviewRunByApplicationAndRunNo(
      "app_secondary",
      1,
    );
    expect(failedRun).toMatchObject({
      status: "FAILED",
      externalRunId: null,
    });

    await expect(
      ensureInitialSupplementReview("app_secondary"),
    ).resolves.toMatchObject({
      applicationId: "app_secondary",
      reviewRunId: failedRun?.id,
      runNo: 1,
      status: "COMPLETED",
      created: true,
    });

    expect(reviewSpy).toHaveBeenCalledTimes(2);
    await expect(listMaterialReviewRuns("app_secondary")).resolves.toHaveLength(1);
  });
});
