import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMaterialReviewRun,
  createSupplementFile,
  createSupplementUploadBatch,
  getLatestMaterialCategoryReview,
  getMaterialReviewRunByApplicationAndRunNo,
  getSupplementUploadBatchById,
  listMaterialReviewRuns,
  listSupplementFiles,
  updateSupplementUploadBatch,
  updateApplication,
} from "@/lib/data/store";
import * as materialReviewClient from "@/lib/material-review/client";
import * as uploadService from "@/lib/upload/service";
import {
  assertCategoryNotReviewing,
  assertReviewRoundLimit,
  assertSupportedSupplementCategory,
  ensureInitialSupplementReview,
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

  it("rejects upload batch creation when the round limit is reached", async () => {
    await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EMPLOYMENT",
      status: "QUEUED",
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
        fileName: "degree.mov",
        fileType: "video/quicktime",
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

    await expect(getSupplementUploadBatchById(batch.id)).resolves.toMatchObject({
      fileCount: 1,
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
        objectKey: "applications/app_supplement_required/supplements/EDUCATION/missing/degree.pdf",
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
    await expect(listSupplementFiles("app_supplement_required", {
      uploadBatchId: batch.id,
    })).resolves.toHaveLength(0);
    await expect(getSupplementUploadBatchById(batch.id)).resolves.toMatchObject({
      fileCount: 0,
    });

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
    await updateSupplementUploadBatch(confirmedBatch.id, { status: "CONFIRMED" });

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
    await expect(getSupplementUploadBatchById(batch.id)).resolves.toMatchObject({
      status: "REVIEWING",
      reviewRunId: firstResult.reviewRunId,
    });
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
      vi.spyOn(materialReviewClient, "createCategoryMaterialReview").mockImplementation(
        async () => {
          resolve();

          return new Promise((innerResolve) => {
            resolveReview = innerResolve;
          });
        },
      );
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
    expect(materialReviewClient.createCategoryMaterialReview).toHaveBeenCalledTimes(1);

    resolveReview?.({
      externalRunId: "mock-material-review:category:EDUCATION:concurrent",
      status: "COMPLETED",
      startedAt: new Date("2026-05-07T03:00:00.000Z").toISOString(),
      finishedAt: new Date("2026-05-07T03:00:01.000Z").toISOString(),
    });

    const firstResult = await firstAttempt;
    expect(firstResult.reviewRunId).toBe(secondResult.reviewRunId);
    await expect(listMaterialReviewRuns("app_supplement_required")).resolves.toHaveLength(
      3,
    );
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
    await expect(getSupplementUploadBatchById(failingBatch.id)).resolves.toMatchObject({
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
    await expect(listMaterialReviewRuns("app_supplement_required")).resolves.toHaveLength(
      failedRuns.length,
    );
  });
});
