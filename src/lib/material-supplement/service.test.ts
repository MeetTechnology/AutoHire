import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMaterialReviewRun,
  createSupplementFile,
  createSupplementUploadBatch,
  getMaterialReviewRunByApplicationAndRunNo,
  listMaterialReviewRuns,
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
  createSupplementUploadBatchIntent,
  createSupplementUploadIntent,
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
