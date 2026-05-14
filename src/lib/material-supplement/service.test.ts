import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMaterialReviewRun,
  createMaterialCategoryReview,
  createSupplementFile,
  createSupplementRequest,
  createSupplementUploadBatch,
  getLatestMaterialCategoryReview,
  getMaterialReviewRunByApplicationAndRunNo,
  getSupplementUploadBatchById,
  listMaterialCategoryReviews,
  listMaterialReviewRuns,
  listSupplementRequests,
  listSupplementFiles,
  softDeleteSupplementFile,
  updateSupplementUploadBatch,
  updateApplication,
} from "@/lib/data/store";
import * as materialReviewClient from "@/lib/material-review/client";
import * as uploadService from "@/lib/upload/service";
import {
  assertCategoryNotReviewing,
  assertReviewRoundLimit,
  assertSupportedSupplementCategory,
  acceptSupplementReviewCallback,
  ensureInitialSupplementReview,
  getSupplementReviewRun,
  getSupplementSnapshot,
  syncSupplementReviewRun,
} from "@/lib/material-supplement/service";
import { MaterialSupplementServiceError } from "@/lib/material-supplement/errors";
import { MaterialReviewClientError } from "@/lib/material-review/types";
import {
  confirmSupplementFileUpload,
  confirmSupplementUploadBatch,
  createSupplementUploadBatchIntent,
  createSupplementUploadIntent,
  deleteSupplementDraftFile,
} from "@/lib/material-supplement/upload";
import {
  MAX_ARCHIVE_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
} from "@/features/upload/constants";
import { SUPPORTED_SUPPLEMENT_CATEGORIES } from "@/features/material-supplement/constants";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

async function createCompletedCategoryReviewRound(input: {
  applicationId: string;
  category:
    | "IDENTITY"
    | "EDUCATION"
    | "EMPLOYMENT"
    | "PROJECT"
    | "PATENT"
    | "HONOR";
  runNo: number;
  roundNo: number;
}) {
  const run = await createMaterialReviewRun({
    applicationId: input.applicationId,
    runNo: input.runNo,
    triggerType: "SUPPLEMENT_UPLOAD",
    triggeredCategory: input.category,
    status: "COMPLETED",
  });

  return createMaterialCategoryReview({
    applicationId: input.applicationId,
    reviewRunId: run.id,
    category: input.category,
    roundNo: input.roundNo,
    status: "COMPLETED",
  });
}

describe("material supplement service guards", () => {
  beforeEach(() => {
    process.env.APP_RUNTIME_MODE = "memory";
    resetMemoryStore();
  });

  it("accepts all six supported supplement categories", () => {
    for (const category of SUPPORTED_SUPPLEMENT_CATEGORIES) {
      expect(assertSupportedSupplementCategory(category)).toBe(category);
    }
  });

  it("rejects unsupported supplement categories", () => {
    expect(() => assertSupportedSupplementCategory("PRODUCT")).toThrowError(
      expect.objectContaining<Partial<MaterialSupplementServiceError>>({
        status: 400,
        code: "SUPPLEMENT_CATEGORY_UNSUPPORTED",
      }),
    );
    expect(() => assertSupportedSupplementCategory("CONFERENCE")).toThrowError(
      expect.objectContaining<Partial<MaterialSupplementServiceError>>({
        status: 400,
        code: "SUPPLEMENT_CATEGORY_UNSUPPORTED",
      }),
    );
  });

  it("blocks a category while its latest review is queued or processing", async () => {
    const queuedRun = await createMaterialReviewRun({
      applicationId: "app_secondary",
      runNo: 1,
      triggerType: "INITIAL_SUBMISSION",
      status: "QUEUED",
    });
    await createMaterialCategoryReview({
      applicationId: "app_secondary",
      reviewRunId: queuedRun.id,
      category: "HONOR",
      roundNo: 1,
      status: "QUEUED",
    });

    await expect(
      assertCategoryNotReviewing({
        applicationId: "app_secondary",
        category: "HONOR",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_CATEGORY_REVIEWING",
      details: {
        category: "HONOR",
      },
    });
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
        applicationId: "app_supplement_reviewing",
        category: "HONOR",
      }),
    ).resolves.toBeUndefined();
  });

  it("allows categories that are still below the round limit", async () => {
    await expect(
      assertReviewRoundLimit({
        applicationId: "app_supplement_required",
        category: "EMPLOYMENT",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects categories that have reached the review round limit", async () => {
    const secondRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EMPLOYMENT",
      status: "COMPLETED",
    });
    await createMaterialCategoryReview({
      applicationId: "app_supplement_required",
      reviewRunId: secondRun.id,
      category: "EMPLOYMENT",
      roundNo: 2,
      status: "COMPLETED",
    });

    const thirdRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 4,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EMPLOYMENT",
      status: "QUEUED",
    });
    await createMaterialCategoryReview({
      applicationId: "app_supplement_required",
      reviewRunId: thirdRun.id,
      category: "EMPLOYMENT",
      roundNo: 3,
      status: "QUEUED",
    });

    await expect(
      assertReviewRoundLimit({
        applicationId: "app_supplement_required",
        category: "EMPLOYMENT",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_ROUND_LIMIT_REACHED",
      details: {
        category: "EMPLOYMENT",
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

    let resolveReview:
      | ((value: {
          externalRunId: string;
          status: "COMPLETED";
          startedAt: string;
          finishedAt: string;
        }) => void)
      | null = null;
    const reviewStarted = new Promise<void>((resolve) => {
      vi.spyOn(
        materialReviewClient,
        "createInitialMaterialReview",
      ).mockImplementation(async () => {
        resolve();

        return new Promise((innerResolve) => {
          resolveReview = innerResolve;
        });
      });
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

    expect(
      materialReviewClient.createInitialMaterialReview,
    ).toHaveBeenCalledTimes(1);
    await expect(listMaterialReviewRuns("app_secondary")).resolves.toHaveLength(
      1,
    );
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
    await expect(listMaterialReviewRuns("app_secondary")).resolves.toHaveLength(
      1,
    );
  });
});

describe("material supplement review run sync", () => {
  beforeEach(() => {
    process.env.APP_RUNTIME_MODE = "memory";
    process.env.MATERIAL_REVIEW_MODE = "mock";
    resetMemoryStore();
    vi.restoreAllMocks();
  });

  it("returns a review run status with category states", async () => {
    await expect(
      getSupplementReviewRun(
        "app_supplement_required",
        "mr_run_required_identity_resolved",
      ),
    ).resolves.toMatchObject({
      reviewRunId: "mr_run_required_identity_resolved",
      applicationId: "app_supplement_required",
      runNo: 2,
      status: "COMPLETED",
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "IDENTITY",
      categories: [
        {
          category: "IDENTITY",
          status: "COMPLETED",
          isLatest: true,
        },
      ],
    });
  });

  it("rejects missing and foreign review runs", async () => {
    await expect(
      getSupplementReviewRun("app_supplement_required", "missing_run"),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 404,
      code: "SUPPLEMENT_REVIEW_RUN_NOT_FOUND",
    });

    await expect(
      getSupplementReviewRun(
        "app_secondary",
        "mr_run_required_identity_resolved",
      ),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 404,
      code: "SUPPLEMENT_REVIEW_RUN_NOT_FOUND",
    });
  });

  it("syncs a mock initial run into category reviews and requests", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });
    const initial = await ensureInitialSupplementReview("app_secondary");

    const firstSync = await syncSupplementReviewRun(
      "app_secondary",
      initial.reviewRunId,
    );
    const secondSync = await syncSupplementReviewRun(
      "app_secondary",
      initial.reviewRunId,
    );

    expect(firstSync).toMatchObject({
      reviewRunId: initial.reviewRunId,
      status: "COMPLETED",
      synced: true,
    });
    expect(firstSync.updatedCategories).toEqual([
      "IDENTITY",
      "EDUCATION",
      "EMPLOYMENT",
      "PROJECT",
      "PATENT",
      "HONOR",
    ]);
    expect(secondSync).toEqual({
      reviewRunId: initial.reviewRunId,
      status: "COMPLETED",
      synced: false,
      updatedCategories: [],
    });

    await expect(
      listMaterialCategoryReviews("app_secondary", {
        reviewRunId: initial.reviewRunId,
      }),
    ).resolves.toHaveLength(6);
    await expect(listSupplementRequests("app_secondary")).resolves.toHaveLength(
      6,
    );
  });

  it("syncs a mock category run and completes related upload batches", async () => {
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "PROCESSING",
      externalRunId: "mock-material-review:category:EDUCATION:sync",
      startedAt: new Date("2026-05-07T05:00:00.000Z"),
    });
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      status: "REVIEWING",
      fileCount: 1,
      reviewRunId: reviewRun.id,
      confirmedAt: new Date("2026-05-07T05:00:00.000Z"),
    });

    await expect(
      syncSupplementReviewRun("app_supplement_required", reviewRun.id),
    ).resolves.toEqual({
      reviewRunId: reviewRun.id,
      status: "COMPLETED",
      synced: true,
      updatedCategories: ["EDUCATION"],
    });
    await expect(
      getLatestMaterialCategoryReview("app_supplement_required", "EDUCATION"),
    ).resolves.toMatchObject({
      reviewRunId: reviewRun.id,
      status: "COMPLETED",
      isLatest: true,
    });
    await expect(getSupplementUploadBatchById(batch.id)).resolves.toMatchObject(
      {
        status: "COMPLETED",
      },
    );
  });

  it("updates a processing category placeholder when a completed sync result arrives", async () => {
    const oldRun = await createMaterialReviewRun({
      applicationId: "app_secondary",
      runNo: 1,
      triggerType: "INITIAL_SUBMISSION",
      status: "COMPLETED",
      externalRunId: "mock-material-review:initial:patent-old",
    });
    const oldReview = await createMaterialCategoryReview({
      applicationId: "app_secondary",
      reviewRunId: oldRun.id,
      category: "PATENT",
      roundNo: 1,
      status: "COMPLETED",
      aiMessage: "Patent documents were missing.",
      resultPayload: {
        supplementRequired: true,
        requests: [],
      },
      finishedAt: new Date("2026-05-07T04:00:00.000Z"),
    });
    await createSupplementRequest({
      applicationId: "app_secondary",
      category: "PATENT",
      reviewRunId: oldRun.id,
      categoryReviewId: oldReview.id,
      title: "Old patent proof",
      reason: "Patent proof was previously requested.",
      status: "PENDING",
    });
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_secondary",
      runNo: 2,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "PATENT",
      status: "PROCESSING",
      externalRunId: "mock-material-review:category:PATENT:placeholder",
      startedAt: new Date("2026-05-07T05:00:00.000Z"),
    });
    const placeholder = await createMaterialCategoryReview({
      applicationId: "app_secondary",
      reviewRunId: reviewRun.id,
      category: "PATENT",
      roundNo: 2,
      status: "PROCESSING",
      aiMessage: "The uploaded supplement files are being reviewed.",
      resultPayload: null,
      startedAt: new Date("2026-05-07T05:00:00.000Z"),
    });
    const batch = await createSupplementUploadBatch({
      applicationId: "app_secondary",
      category: "PATENT",
      status: "REVIEWING",
      fileCount: 1,
      reviewRunId: reviewRun.id,
      confirmedAt: new Date("2026-05-07T05:00:00.000Z"),
    });

    vi.spyOn(materialReviewClient, "getMaterialReviewResult").mockResolvedValue(
      {
        externalRunId: reviewRun.externalRunId ?? "",
        status: "COMPLETED",
        startedAt: "2026-05-07T05:00:00.000Z",
        finishedAt: "2026-05-07T05:03:00.000Z",
        categories: [
          {
            category: "PATENT",
            status: "COMPLETED",
            aiMessage: "Patent documents are still needed.",
            resultPayload: {
              supplementRequired: true,
              requests: [
                {
                  title: "Patent certificate",
                  reason: "The patent certificate was not found.",
                  suggestedMaterials: ["Patent certificate"],
                  aiMessage: "Please upload the patent certificate.",
                  status: "PENDING",
                },
              ],
            },
            rawResultPayload: null,
          },
        ],
      },
    );

    await expect(
      syncSupplementReviewRun("app_secondary", reviewRun.id),
    ).resolves.toEqual({
      reviewRunId: reviewRun.id,
      status: "COMPLETED",
      synced: true,
      updatedCategories: ["PATENT"],
    });
    await expect(
      syncSupplementReviewRun("app_secondary", reviewRun.id),
    ).resolves.toEqual({
      reviewRunId: reviewRun.id,
      status: "COMPLETED",
      synced: false,
      updatedCategories: [],
    });

    await expect(
      getLatestMaterialCategoryReview("app_secondary", "PATENT"),
    ).resolves.toMatchObject({
      id: placeholder.id,
      reviewRunId: reviewRun.id,
      status: "COMPLETED",
      aiMessage: "Patent documents are still needed.",
      isLatest: true,
    });
    await expect(getSupplementUploadBatchById(batch.id)).resolves.toMatchObject(
      {
        status: "COMPLETED",
      },
    );

    const requests = await listSupplementRequests("app_secondary", {
      category: "PATENT",
    });
    const latestRequests = requests.filter((request) => request.isLatest);

    expect(latestRequests).toHaveLength(1);
    expect(latestRequests[0]).toMatchObject({
      reviewRunId: reviewRun.id,
      categoryReviewId: placeholder.id,
      title: "Patent certificate",
      status: "PENDING",
      isSatisfied: false,
    });
    expect(
      requests.filter((request) => request.title === "Patent certificate"),
    ).toHaveLength(1);
    expect(
      requests.find((request) => request.title === "Old patent proof"),
    ).toMatchObject({
      status: "HISTORY_ONLY",
      isLatest: false,
    });

    const snapshot = await getSupplementSnapshot("app_secondary");
    const patentCategory = snapshot.categories.find(
      (category) => category.category === "PATENT",
    );

    expect(snapshot.summary.materialSupplementStatus).toBe(
      "SUPPLEMENT_REQUIRED",
    );
    expect(patentCategory).toMatchObject({
      status: "SUPPLEMENT_REQUIRED",
      isReviewing: false,
      pendingRequestCount: 1,
    });
    expect(patentCategory?.requests).toEqual([
      expect.objectContaining({
        title: "Patent certificate",
        status: "PENDING",
      }),
    ]);
  });

  it("does not complete upload batches for non-final sync statuses", async () => {
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "PROCESSING",
      externalRunId: "mock-material-review:category:EDUCATION:pending",
      startedAt: new Date("2026-05-07T05:00:00.000Z"),
    });
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      status: "REVIEWING",
      fileCount: 1,
      reviewRunId: reviewRun.id,
      confirmedAt: new Date("2026-05-07T05:00:00.000Z"),
    });

    vi.spyOn(materialReviewClient, "getMaterialReviewResult").mockResolvedValue(
      {
        externalRunId: reviewRun.externalRunId ?? "",
        status: "PROCESSING",
        categories: [],
      },
    );

    await expect(
      syncSupplementReviewRun("app_supplement_required", reviewRun.id),
    ).resolves.toEqual({
      reviewRunId: reviewRun.id,
      status: "PROCESSING",
      synced: false,
      updatedCategories: [],
    });
    await expect(getSupplementUploadBatchById(batch.id)).resolves.toMatchObject(
      {
        status: "REVIEWING",
      },
    );
  });

  it("does not let a stale run overwrite a newer latest category review", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });
    const staleRun = await createMaterialReviewRun({
      applicationId: "app_secondary",
      runNo: 1,
      triggerType: "INITIAL_SUBMISSION",
      status: "PROCESSING",
      externalRunId: "mock-material-review:category:HONOR:stale",
    });
    const newerRun = await createMaterialReviewRun({
      applicationId: "app_secondary",
      runNo: 2,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "HONOR",
      status: "COMPLETED",
      externalRunId: "mock-material-review:category:HONOR:newer",
    });
    const newerReview = await createMaterialCategoryReview({
      applicationId: "app_secondary",
      reviewRunId: newerRun.id,
      category: "HONOR",
      roundNo: 2,
      status: "COMPLETED",
      aiMessage: "Honor is already complete.",
      resultPayload: { supplementRequired: false, requests: [] },
      finishedAt: new Date("2026-05-07T06:00:00.000Z"),
    });

    await expect(
      syncSupplementReviewRun("app_secondary", staleRun.id),
    ).resolves.toEqual({
      reviewRunId: staleRun.id,
      status: "COMPLETED",
      synced: false,
      updatedCategories: [],
    });
    await expect(
      getLatestMaterialCategoryReview("app_secondary", "HONOR"),
    ).resolves.toMatchObject({
      id: newerReview.id,
      reviewRunId: newerRun.id,
      isLatest: true,
    });
  });

  it("maps backend unavailable and invalid results to supplement errors", async () => {
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "PROCESSING",
      externalRunId: "mock-material-review:category:EDUCATION:error",
    });

    vi.spyOn(
      materialReviewClient,
      "getMaterialReviewResult",
    ).mockRejectedValueOnce(
      new MaterialReviewClientError({
        message: "Backend unavailable.",
        failureCode: "BACKEND_UNAVAILABLE",
        retryable: true,
        httpStatus: 503,
      }),
    );

    await expect(
      syncSupplementReviewRun("app_supplement_required", reviewRun.id),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 503,
      code: "MATERIAL_REVIEW_BACKEND_UNAVAILABLE",
    });

    vi.spyOn(
      materialReviewClient,
      "getMaterialReviewResult",
    ).mockResolvedValueOnce({
      externalRunId: reviewRun.externalRunId ?? "",
      status: "COMPLETED",
      categories: [
        {
          category: "EDUCATION",
          status: "COMPLETED",
          aiMessage: "Invalid payload.",
          resultPayload: null as never,
        },
      ],
    });

    await expect(
      syncSupplementReviewRun("app_supplement_required", reviewRun.id),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 502,
      code: "SUPPLEMENT_REVIEW_RESULT_INVALID",
    });
  });

  it("accepts a completed callback and preserves latest/history behavior", async () => {
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "PROCESSING",
      externalRunId: "callback-review-education",
    });

    await expect(
      acceptSupplementReviewCallback(reviewRun.id, {
        externalRunId: "callback-review-education",
        status: "COMPLETED",
        finishedAt: "2026-05-07T09:00:00.000Z",
        categories: [
          {
            category: "EDUCATION",
            status: "COMPLETED",
            reviewedAt: "2026-05-07T09:00:00.000Z",
            aiMessage: "Education proof is complete.",
            resultPayload: {
              supplementRequired: false,
              requests: [],
            },
            rawResultPayload: null,
          },
        ],
      }),
    ).resolves.toEqual({
      reviewRunId: reviewRun.id,
      accepted: true,
      status: "COMPLETED",
      updatedCategories: ["EDUCATION"],
    });

    await expect(
      getLatestMaterialCategoryReview("app_supplement_required", "EDUCATION"),
    ).resolves.toMatchObject({
      reviewRunId: reviewRun.id,
      status: "COMPLETED",
      isLatest: true,
    });
    const requests = await listSupplementRequests("app_supplement_required", {
      category: "EDUCATION",
    });
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reviewRunId: reviewRun.id,
          status: "SATISFIED",
          isLatest: true,
          isSatisfied: true,
        }),
      ]),
    );
  });

  it("moves previous latest requests to history when a newer callback creates replacement requests", async () => {
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EMPLOYMENT",
      status: "PROCESSING",
      externalRunId: "callback-review-employment-replacement",
    });

    await expect(
      acceptSupplementReviewCallback(reviewRun.id, {
        externalRunId: "callback-review-employment-replacement",
        status: "COMPLETED",
        finishedAt: "2026-05-07T09:30:00.000Z",
        categories: [
          {
            category: "EMPLOYMENT",
            status: "COMPLETED",
            reviewedAt: "2026-05-07T09:30:00.000Z",
            aiMessage: "Employment proof still needs payroll evidence.",
            resultPayload: {
              supplementRequired: true,
              requests: [
                {
                  title: "Upload payroll proof",
                  reason: "Payroll proof is required for the current employer.",
                  suggestedMaterials: ["Payroll slip"],
                  aiMessage: "Please upload payroll proof.",
                  status: "PENDING",
                },
              ],
            },
            rawResultPayload: null,
          },
        ],
      }),
    ).resolves.toMatchObject({
      reviewRunId: reviewRun.id,
      accepted: true,
      status: "COMPLETED",
      updatedCategories: ["EMPLOYMENT"],
    });

    const requests = await listSupplementRequests("app_supplement_required", {
      category: "EMPLOYMENT",
    });
    const latestRequests = requests.filter((request) => request.isLatest);
    const oldRequest = requests.find(
      (request) => request.title === "Upload recent employment proof",
    );

    expect(latestRequests).toHaveLength(1);
    expect(latestRequests[0]).toMatchObject({
      reviewRunId: reviewRun.id,
      title: "Upload payroll proof",
      status: "PENDING",
      isLatest: true,
      isSatisfied: false,
    });
    expect(oldRequest).toMatchObject({
      status: "HISTORY_ONLY",
      isLatest: false,
    });
  });

  it("does not let a completed stale callback overwrite a newer latest review", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });
    const staleRun = await createMaterialReviewRun({
      applicationId: "app_secondary",
      runNo: 1,
      triggerType: "INITIAL_SUBMISSION",
      status: "PROCESSING",
      externalRunId: "callback-review-honor-stale",
    });
    const newerRun = await createMaterialReviewRun({
      applicationId: "app_secondary",
      runNo: 2,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "HONOR",
      status: "COMPLETED",
      externalRunId: "callback-review-honor-newer",
    });
    const newerReview = await createMaterialCategoryReview({
      applicationId: "app_secondary",
      reviewRunId: newerRun.id,
      category: "HONOR",
      roundNo: 2,
      status: "COMPLETED",
      aiMessage: "Honor is already complete.",
      resultPayload: { supplementRequired: false, requests: [] },
      finishedAt: new Date("2026-05-07T09:00:00.000Z"),
    });

    await expect(
      acceptSupplementReviewCallback(staleRun.id, {
        externalRunId: "callback-review-honor-stale",
        status: "COMPLETED",
        finishedAt: "2026-05-07T09:01:00.000Z",
        categories: [
          {
            category: "HONOR",
            status: "COMPLETED",
            reviewedAt: "2026-05-07T09:01:00.000Z",
            aiMessage: "Honor needs an award certificate.",
            resultPayload: {
              supplementRequired: true,
              requests: [
                {
                  title: "Award certificate required",
                  reason: "The submitted documents do not prove the honor.",
                  suggestedMaterials: ["Award certificate"],
                  aiMessage: "Honor needs an award certificate.",
                  status: "PENDING",
                },
              ],
            },
            rawResultPayload: null,
          },
        ],
      }),
    ).resolves.toEqual({
      reviewRunId: staleRun.id,
      accepted: true,
      status: "COMPLETED",
      updatedCategories: [],
    });
    await expect(
      getLatestMaterialCategoryReview("app_secondary", "HONOR"),
    ).resolves.toMatchObject({
      id: newerReview.id,
      reviewRunId: newerRun.id,
      isLatest: true,
    });
  });

  it("accepts a non-completed callback without creating category reviews", async () => {
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "QUEUED",
      externalRunId: null,
    });

    await expect(
      acceptSupplementReviewCallback(reviewRun.id, {
        externalRunId: "callback-review-education-pending",
        status: "PROCESSING",
        finishedAt: null,
        categories: [],
      }),
    ).resolves.toEqual({
      reviewRunId: reviewRun.id,
      accepted: true,
      status: "PROCESSING",
      updatedCategories: [],
    });
    await expect(
      getMaterialReviewRunByApplicationAndRunNo("app_supplement_required", 3),
    ).resolves.toMatchObject({
      externalRunId: "callback-review-education-pending",
      status: "PROCESSING",
    });
    await expect(
      listMaterialCategoryReviews("app_supplement_required", {
        reviewRunId: reviewRun.id,
      }),
    ).resolves.toHaveLength(0);
  });

  it("does not downgrade a completed run when a stale non-completed callback arrives", async () => {
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "COMPLETED",
      externalRunId: "callback-review-education-completed",
      finishedAt: new Date("2026-05-07T09:00:00.000Z"),
    });

    await expect(
      acceptSupplementReviewCallback(reviewRun.id, {
        externalRunId: "callback-review-education-completed",
        status: "PROCESSING",
        finishedAt: null,
        categories: [],
      }),
    ).resolves.toEqual({
      reviewRunId: reviewRun.id,
      accepted: true,
      status: "COMPLETED",
      updatedCategories: [],
    });
    await expect(
      getMaterialReviewRunByApplicationAndRunNo("app_supplement_required", 3),
    ).resolves.toMatchObject({
      externalRunId: "callback-review-education-completed",
      status: "COMPLETED",
    });
  });

  it("rejects callbacks whose external run id does not match the local run", async () => {
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "PROCESSING",
      externalRunId: "callback-review-education-current",
    });

    await expect(
      acceptSupplementReviewCallback(reviewRun.id, {
        externalRunId: "callback-review-education-old",
        status: "PROCESSING",
        finishedAt: null,
        categories: [],
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_REVIEW_CALLBACK_STALE",
    });
  });
});

describe("material supplement upload intents", () => {
  beforeEach(() => {
    process.env.APP_RUNTIME_MODE = "memory";
    resetMemoryStore();
    vi.restoreAllMocks();
  });

  it("creates a draft upload batch", async () => {
    await expect(
      createSupplementUploadBatchIntent({
        applicationId: "app_supplement_required",
        category: "EDUCATION",
      }),
    ).resolves.toMatchObject({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      status: "DRAFT",
      fileCount: 0,
    });
  });

  it("rejects unsupported upload batch categories", async () => {
    await expect(
      createSupplementUploadBatchIntent({
        applicationId: "app_supplement_required",
        category: "PRODUCT",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 400,
      code: "SUPPLEMENT_CATEGORY_UNSUPPORTED",
    });
  });

  it("rejects upload batch creation when the category is reviewing", async () => {
    await expect(
      createSupplementUploadBatchIntent({
        applicationId: "app_supplement_reviewing",
        category: "IDENTITY",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_CATEGORY_REVIEWING",
    });
  });

  it("allows upload batch creation for other categories while one category is reviewing", async () => {
    await expect(
      createSupplementUploadBatchIntent({
        applicationId: "app_supplement_reviewing",
        category: "HONOR",
      }),
    ).resolves.toMatchObject({
      applicationId: "app_supplement_reviewing",
      category: "HONOR",
      status: "DRAFT",
    });
  });

  it("rejects upload batch creation when the round limit is reached", async () => {
    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "EMPLOYMENT",
      runNo: 3,
      roundNo: 2,
    });
    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "EMPLOYMENT",
      runNo: 4,
      roundNo: 3,
    });

    await expect(
      createSupplementUploadBatchIntent({
        applicationId: "app_supplement_required",
        category: "EMPLOYMENT",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_ROUND_LIMIT_REACHED",
    });
  });

  it("allows upload batch creation at two rounds but rejects upload intent at three rounds", async () => {
    await expect(
      createSupplementUploadBatchIntent({
        applicationId: "app_supplement_required",
        category: "HONOR",
      }),
    ).resolves.toMatchObject({
      applicationId: "app_supplement_required",
      category: "HONOR",
      status: "DRAFT",
    });

    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "HONOR",
      runNo: 3,
      roundNo: 1,
    });
    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "HONOR",
      runNo: 4,
      roundNo: 2,
    });
    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "HONOR",
      runNo: 5,
      roundNo: 3,
    });
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "HONOR",
    });

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "HONOR",
        fileName: "award.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        requestOrigin: "http://localhost",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_ROUND_LIMIT_REACHED",
    });
  });

  it("creates a supplement upload intent with a supplement object key", async () => {
    const uploadSpy = vi
      .spyOn(uploadService, "createUploadIntent")
      .mockImplementation(async ({ fileType, objectKey }) => ({
        uploadUrl: `/api/mock-storage?key=${encodeURIComponent(objectKey)}`,
        method: "PUT" as const,
        headers: {
          "Content-Type": fileType,
        },
        objectKey,
      }));
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "EDUCATION",
        fileName: "phd degree.pdf",
        fileType: "application/pdf",
        fileSize: MAX_FILE_SIZE_BYTES,
        requestOrigin: "http://localhost",
      }),
    ).resolves.toMatchObject({
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
      },
      deduped: false,
    });

    const objectKey = uploadSpy.mock.calls[0]?.[0].objectKey;
    expect(objectKey).toMatch(
      /^applications\/app_supplement_required\/supplements\/EDUCATION\/.+\/supplement_upload_[a-f0-9]+-\d+-phd_degree\.pdf$/,
    );
    expect(objectKey).not.toContain("/materials/");
  });

  it("rejects upload intents for a missing batch", async () => {
    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: "missing_batch",
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        requestOrigin: "http://localhost",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 404,
      code: "SUPPLEMENT_UPLOAD_BATCH_NOT_FOUND",
    });
  });

  it("rejects upload intents for a non-draft batch", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });
    await updateSupplementUploadBatch(batch.id, { status: "CONFIRMED" });

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        requestOrigin: "http://localhost",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_UPLOAD_BATCH_NOT_DRAFT",
    });
  });

  it("rejects upload intents when the draft batch already has 10 files", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });

    for (let index = 0; index < 10; index += 1) {
      await createSupplementFile({
        applicationId: "app_supplement_required",
        category: "EDUCATION",
        uploadBatchId: batch.id,
        fileName: `degree-${index}.pdf`,
        objectKey: `applications/app_supplement_required/supplements/EDUCATION/${batch.id}/degree-${index}.pdf`,
        fileType: "application/pdf",
        fileSize: 1000 + index,
      });
    }

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "EDUCATION",
        fileName: "degree-10.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        requestOrigin: "http://localhost",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_FILE_COUNT_EXCEEDED",
    });
  });

  it("counts upload intent reservations before files are confirmed", async () => {
    vi.spyOn(uploadService, "createUploadIntent").mockImplementation(
      async ({ fileType, objectKey }) => ({
        uploadUrl: `/api/mock-storage?key=${encodeURIComponent(objectKey)}`,
        method: "PUT" as const,
        headers: {
          "Content-Type": fileType,
        },
        objectKey,
      }),
    );
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });

    for (let index = 0; index < 10; index += 1) {
      await expect(
        createSupplementUploadIntent({
          applicationId: "app_supplement_required",
          uploadBatchId: batch.id,
          category: "EDUCATION",
          fileName: `intent-only-${index}.pdf`,
          fileType: "application/pdf",
          fileSize: 1000 + index,
          requestOrigin: "http://localhost",
        }),
      ).resolves.toMatchObject({
        deduped: false,
      });
    }

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "EDUCATION",
        fileName: "intent-only-10.pdf",
        fileType: "application/pdf",
        fileSize: 1010,
        requestOrigin: "http://localhost",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_FILE_COUNT_EXCEEDED",
    });
  });

  it("rejects unsupported supplement file types", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "EDUCATION",
        fileName: "degree.exe",
        fileType: "application/octet-stream",
        fileSize: 1234,
        requestOrigin: "http://localhost",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 400,
      code: "SUPPLEMENT_FILE_TYPE_UNSUPPORTED",
    });
  });

  it("rejects standard and archive files that exceed size limits", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: MAX_FILE_SIZE_BYTES + 1,
        requestOrigin: "http://localhost",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 400,
      code: "SUPPLEMENT_FILE_SIZE_EXCEEDED",
    });

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "EDUCATION",
        fileName: "degree.zip",
        fileType: "application/zip",
        fileSize: MAX_ARCHIVE_SIZE_BYTES + 1,
        requestOrigin: "http://localhost",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 400,
      code: "SUPPLEMENT_FILE_SIZE_EXCEEDED",
    });
  });

  it("rejects duplicate active supplement files by file name and size", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });
    await createSupplementFile({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      uploadBatchId: batch.id,
      fileName: "degree.pdf",
      objectKey: `applications/app_supplement_required/supplements/EDUCATION/${batch.id}/degree.pdf`,
      fileType: "application/pdf",
      fileSize: 1234,
    });

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        requestOrigin: "http://localhost",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_FILE_DUPLICATE",
    });
  });

  it("allows same-name uploads when size, category, or active state differ", async () => {
    vi.spyOn(uploadService, "createUploadIntent").mockImplementation(
      async ({ fileType, objectKey }) => ({
        uploadUrl: `/api/mock-storage?key=${encodeURIComponent(objectKey)}`,
        method: "PUT" as const,
        headers: {
          "Content-Type": fileType,
        },
        objectKey,
      }),
    );
    const educationBatch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });
    await createSupplementFile({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      uploadBatchId: educationBatch.id,
      fileName: "degree.pdf",
      objectKey: `applications/app_supplement_required/supplements/EDUCATION/${educationBatch.id}/degree.pdf`,
      fileType: "application/pdf",
      fileSize: 1234,
    });

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: educationBatch.id,
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 1235,
        requestOrigin: "http://localhost",
      }),
    ).resolves.toMatchObject({ deduped: false });

    const patentBatch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "PATENT",
    });
    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: patentBatch.id,
        category: "PATENT",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        requestOrigin: "http://localhost",
      }),
    ).resolves.toMatchObject({ deduped: false });

    const deletedBatch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "HONOR",
    });
    const deletedFile = await createSupplementFile({
      applicationId: "app_supplement_required",
      category: "HONOR",
      uploadBatchId: deletedBatch.id,
      fileName: "award.pdf",
      objectKey: `applications/app_supplement_required/supplements/HONOR/${deletedBatch.id}/award.pdf`,
      fileType: "application/pdf",
      fileSize: 4321,
    });
    await softDeleteSupplementFile(deletedFile.id);

    await expect(
      createSupplementUploadIntent({
        applicationId: "app_supplement_required",
        uploadBatchId: deletedBatch.id,
        category: "HONOR",
        fileName: "award.pdf",
        fileType: "application/pdf",
        fileSize: 4321,
        requestOrigin: "http://localhost",
      }),
    ).resolves.toMatchObject({ deduped: false });
  });
});

describe("material supplement file and batch confirmation", () => {
  beforeEach(() => {
    process.env.APP_RUNTIME_MODE = "memory";
    resetMemoryStore();
    vi.restoreAllMocks();
  });

  it("confirms a supplement file and updates the draft batch count", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });

    await expect(
      confirmSupplementFileUpload({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        objectKey: `applications/app_supplement_required/supplements/EDUCATION/${batch.id}/degree.pdf`,
      }),
    ).resolves.toMatchObject({
      file: {
        uploadBatchId: batch.id,
        category: "EDUCATION",
        supplementRequestId: null,
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        status: "DRAFT",
      },
    });

    await expect(getSupplementUploadBatchById(batch.id)).resolves.toMatchObject(
      {
        fileCount: 1,
      },
    );
  });

  it("rejects file and batch confirmation when the round limit is reached", async () => {
    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "HONOR",
      runNo: 3,
      roundNo: 1,
    });
    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "HONOR",
      runNo: 4,
      roundNo: 2,
    });
    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "HONOR",
      runNo: 5,
      roundNo: 3,
    });

    const fileBatch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "HONOR",
    });
    await expect(
      confirmSupplementFileUpload({
        applicationId: "app_supplement_required",
        uploadBatchId: fileBatch.id,
        category: "HONOR",
        fileName: "award.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        objectKey: `applications/app_supplement_required/supplements/HONOR/${fileBatch.id}/award.pdf`,
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_ROUND_LIMIT_REACHED",
    });

    const confirmBatch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "PATENT",
    });
    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "PATENT",
      runNo: 6,
      roundNo: 1,
    });
    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "PATENT",
      runNo: 7,
      roundNo: 2,
    });
    await createCompletedCategoryReviewRound({
      applicationId: "app_supplement_required",
      category: "PATENT",
      runNo: 8,
      roundNo: 3,
    });
    await createSupplementFile({
      applicationId: "app_supplement_required",
      category: "PATENT",
      uploadBatchId: confirmBatch.id,
      fileName: "patent.pdf",
      objectKey: `applications/app_supplement_required/supplements/PATENT/${confirmBatch.id}/patent.pdf`,
      fileType: "application/pdf",
      fileSize: 2345,
    });

    await expect(
      confirmSupplementUploadBatch({
        applicationId: "app_supplement_required",
        uploadBatchId: confirmBatch.id,
        category: "PATENT",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_ROUND_LIMIT_REACHED",
    });
  });

  it("rejects file confirmation for missing, non-draft, duplicate, and reviewing categories", async () => {
    await expect(
      confirmSupplementFileUpload({
        applicationId: "app_supplement_required",
        uploadBatchId: "missing_batch",
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        objectKey:
          "applications/app_supplement_required/supplements/EDUCATION/missing/degree.pdf",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 404,
      code: "SUPPLEMENT_UPLOAD_BATCH_NOT_FOUND",
    });

    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });
    await updateSupplementUploadBatch(batch.id, { status: "CONFIRMED" });

    await expect(
      confirmSupplementFileUpload({
        applicationId: "app_supplement_required",
        uploadBatchId: batch.id,
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        objectKey: `applications/app_supplement_required/supplements/EDUCATION/${batch.id}/degree.pdf`,
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_UPLOAD_BATCH_NOT_DRAFT",
    });

    const duplicateBatch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });
    await createSupplementFile({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      uploadBatchId: duplicateBatch.id,
      fileName: "duplicate.pdf",
      objectKey: `applications/app_supplement_required/supplements/EDUCATION/${duplicateBatch.id}/duplicate.pdf`,
      fileType: "application/pdf",
      fileSize: 4321,
    });

    await expect(
      confirmSupplementFileUpload({
        applicationId: "app_supplement_required",
        uploadBatchId: duplicateBatch.id,
        category: "EDUCATION",
        fileName: "duplicate.pdf",
        fileType: "application/pdf",
        fileSize: 4321,
        objectKey: `applications/app_supplement_required/supplements/EDUCATION/${duplicateBatch.id}/duplicate-copy.pdf`,
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_FILE_DUPLICATE",
    });

    await expect(
      confirmSupplementFileUpload({
        applicationId: "app_supplement_required",
        uploadBatchId: duplicateBatch.id,
        category: "EDUCATION",
        fileName: "wrong-scope.pdf",
        fileType: "application/pdf",
        fileSize: 9876,
        objectKey:
          "applications/app_other/supplements/EDUCATION/some_batch/wrong-scope.pdf",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 400,
      code: "SUPPLEMENT_FILE_CONFIRM_FAILED",
    });

    await expect(
      confirmSupplementFileUpload({
        applicationId: "app_supplement_reviewing",
        uploadBatchId: "supp_batch_reviewing_identity",
        category: "IDENTITY",
        fileName: "passport.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        objectKey:
          "applications/app_supplement_reviewing/supplements/IDENTITY/passport.pdf",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_CATEGORY_REVIEWING",
    });
  });

  it("deletes draft files and rejects missing or non-draft files", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });
    const file = await createSupplementFile({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      uploadBatchId: batch.id,
      fileName: "degree.pdf",
      objectKey: `applications/app_supplement_required/supplements/EDUCATION/${batch.id}/degree.pdf`,
      fileType: "application/pdf",
      fileSize: 1234,
    });

    await expect(
      deleteSupplementDraftFile({
        applicationId: "app_supplement_required",
        fileId: file.id,
      }),
    ).resolves.toEqual({
      deleted: true,
      fileId: file.id,
      uploadBatchId: batch.id,
    });
    await expect(
      listSupplementFiles("app_supplement_required", {
        uploadBatchId: batch.id,
      }),
    ).resolves.toHaveLength(0);
    await expect(getSupplementUploadBatchById(batch.id)).resolves.toMatchObject(
      {
        fileCount: 0,
      },
    );

    await expect(
      deleteSupplementDraftFile({
        applicationId: "app_supplement_required",
        fileId: "missing_file",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 404,
      code: "SUPPLEMENT_FILE_NOT_FOUND",
    });

    const confirmedBatch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });
    const confirmedFile = await createSupplementFile({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      uploadBatchId: confirmedBatch.id,
      fileName: "confirmed.pdf",
      objectKey: `applications/app_supplement_required/supplements/EDUCATION/${confirmedBatch.id}/confirmed.pdf`,
      fileType: "application/pdf",
      fileSize: 5678,
    });
    await updateSupplementUploadBatch(confirmedBatch.id, {
      status: "CONFIRMED",
    });

    await expect(
      deleteSupplementDraftFile({
        applicationId: "app_supplement_required",
        fileId: confirmedFile.id,
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_FILE_NOT_DRAFT",
    });
  });

  it("confirms a batch, locks the category, and treats duplicate confirmation as idempotent", async () => {
    const reviewSpy = vi.spyOn(
      materialReviewClient,
      "createCategoryMaterialReview",
    );
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });
    await createSupplementFile({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      uploadBatchId: batch.id,
      fileName: "degree.pdf",
      objectKey: `applications/app_supplement_required/supplements/EDUCATION/${batch.id}/degree.pdf`,
      fileType: "application/pdf",
      fileSize: 1234,
    });

    const firstResult = await confirmSupplementUploadBatch({
      applicationId: "app_supplement_required",
      uploadBatchId: batch.id,
      category: "EDUCATION",
    });
    const secondResult = await confirmSupplementUploadBatch({
      applicationId: "app_supplement_required",
      uploadBatchId: batch.id,
      category: "EDUCATION",
    });

    expect(firstResult).toMatchObject({
      uploadBatchId: batch.id,
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      fileCount: 1,
      status: "REVIEWING",
    });
    expect(secondResult).toEqual(firstResult);
    expect(reviewSpy).toHaveBeenCalledTimes(1);

    const reviewRuns = await listMaterialReviewRuns("app_supplement_required");
    expect(reviewRuns[0]).toMatchObject({
      id: firstResult.reviewRunId,
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "PROCESSING",
    });
    await expect(
      getLatestMaterialCategoryReview("app_supplement_required", "EDUCATION"),
    ).resolves.toMatchObject({
      reviewRunId: firstResult.reviewRunId,
      status: "PROCESSING",
      isLatest: true,
    });
    await expect(getSupplementUploadBatchById(batch.id)).resolves.toMatchObject(
      {
        status: "REVIEWING",
        reviewRunId: firstResult.reviewRunId,
      },
    );
  });

  it("does not double-trigger category review startup for concurrent batch confirmation", async () => {
    let resolveReview:
      | ((value: {
          externalRunId: string;
          status: "COMPLETED";
          startedAt: string;
          finishedAt: string;
        }) => void)
      | null = null;
    const reviewStarted = new Promise<void>((resolve) => {
      vi.spyOn(
        materialReviewClient,
        "createCategoryMaterialReview",
      ).mockImplementation(async () => {
        resolve();

        return new Promise((innerResolve) => {
          resolveReview = innerResolve;
        });
      });
    });
    const batch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });
    await createSupplementFile({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      uploadBatchId: batch.id,
      fileName: "degree.pdf",
      objectKey: `applications/app_supplement_required/supplements/EDUCATION/${batch.id}/degree.pdf`,
      fileType: "application/pdf",
      fileSize: 1234,
    });

    const firstAttempt = confirmSupplementUploadBatch({
      applicationId: "app_supplement_required",
      uploadBatchId: batch.id,
      category: "EDUCATION",
    });
    await reviewStarted;
    const secondResult = await confirmSupplementUploadBatch({
      applicationId: "app_supplement_required",
      uploadBatchId: batch.id,
      category: "EDUCATION",
    });

    expect(secondResult).toMatchObject({
      uploadBatchId: batch.id,
      category: "EDUCATION",
      status: "REVIEWING",
    });
    expect(
      materialReviewClient.createCategoryMaterialReview,
    ).toHaveBeenCalledTimes(1);

    resolveReview?.({
      externalRunId: "mock-material-review:category:EDUCATION:concurrent",
      status: "COMPLETED",
      startedAt: new Date("2026-05-07T03:00:00.000Z").toISOString(),
      finishedAt: new Date("2026-05-07T03:00:01.000Z").toISOString(),
    });

    const firstResult = await firstAttempt;
    expect(firstResult.reviewRunId).toBe(secondResult.reviewRunId);
    await expect(
      listMaterialReviewRuns("app_supplement_required"),
    ).resolves.toHaveLength(3);
  });

  it("rejects empty batch confirmation and category review startup failures", async () => {
    const emptyBatch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });

    await expect(
      confirmSupplementUploadBatch({
        applicationId: "app_supplement_required",
        uploadBatchId: emptyBatch.id,
        category: "EDUCATION",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_UPLOAD_BATCH_EMPTY",
    });

    const failingBatch = await createSupplementUploadBatch({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
    });
    await createSupplementFile({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      uploadBatchId: failingBatch.id,
      fileName: "degree.pdf",
      objectKey: `applications/app_supplement_required/supplements/EDUCATION/${failingBatch.id}/degree.pdf`,
      fileType: "application/pdf",
      fileSize: 1234,
    });
    const reviewSpy = vi
      .spyOn(materialReviewClient, "createCategoryMaterialReview")
      .mockRejectedValueOnce(
        new MaterialReviewClientError({
          message: "Backend unavailable.",
          failureCode: "BACKEND_UNAVAILABLE",
          retryable: true,
          httpStatus: 503,
        }),
      )
      .mockResolvedValueOnce({
        externalRunId: "mock-material-review:category:EDUCATION:retry",
        status: "COMPLETED",
        startedAt: new Date("2026-05-07T04:00:00.000Z").toISOString(),
        finishedAt: new Date("2026-05-07T04:00:01.000Z").toISOString(),
      });

    await expect(
      confirmSupplementUploadBatch({
        applicationId: "app_supplement_required",
        uploadBatchId: failingBatch.id,
        category: "EDUCATION",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 503,
      code: "MATERIAL_REVIEW_BACKEND_UNAVAILABLE",
    });
    await expect(
      getSupplementUploadBatchById(failingBatch.id),
    ).resolves.toMatchObject({
      status: "CONFIRMED",
      reviewRunId: expect.any(String),
    });

    const failedRuns = await listMaterialReviewRuns("app_supplement_required");
    const failedRun = failedRuns[0];
    expect(failedRun).toMatchObject({
      status: "FAILED",
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
    });

    await expect(
      confirmSupplementUploadBatch({
        applicationId: "app_supplement_required",
        uploadBatchId: failingBatch.id,
        category: "EDUCATION",
      }),
    ).resolves.toMatchObject({
      reviewRunId: failedRun.id,
      status: "REVIEWING",
    });
    expect(reviewSpy).toHaveBeenCalledTimes(2);
    await expect(
      listMaterialReviewRuns("app_supplement_required"),
    ).resolves.toHaveLength(failedRuns.length);
  });
});
