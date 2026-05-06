import { beforeEach, describe, expect, it } from "vitest";

import {
  attachSupplementFilesToReviewRun,
  createMaterialCategoryReview,
  createMaterialReviewRun,
  createSupplementRequest,
  createSupplementFile,
  createSupplementUploadBatch,
  findActiveSupplementFileDuplicate,
  getLatestMaterialCategoryReview,
  getMaterialReviewRunByApplicationAndRunNo,
  getMaterialSupplementHistoryData,
  getMaterialSupplementSnapshotData,
  getSupplementFileById,
  getSupplementUploadBatchById,
  listLatestSupplementRequests,
  replaceLatestSupplementRequestsForCategory,
  softDeleteSupplementFile,
} from "@/lib/data/store";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

describe("material supplement store", () => {
  beforeEach(() => {
    process.env.APP_RUNTIME_MODE = "memory";
    resetMemoryStore();
  });

  it("creates material review runs idempotently by application and run number", async () => {
    const created = await createMaterialReviewRun({
      applicationId: "app_submitted",
      runNo: 9,
      triggerType: "MANUAL_RETRY",
    });

    const duplicated = await createMaterialReviewRun({
      applicationId: "app_submitted",
      runNo: 9,
      triggerType: "INITIAL_SUBMISSION",
      status: "PROCESSING",
    });

    expect(duplicated.id).toBe(created.id);

    const found = await getMaterialReviewRunByApplicationAndRunNo(
      "app_submitted",
      9,
    );
    expect(found?.id).toBe(created.id);
    expect(found?.triggerType).toBe("MANUAL_RETRY");
  });

  it("marks older latest category reviews as non-latest when a new one is created", async () => {
    const created = await createMaterialCategoryReview({
      reviewRunId: "mr_run_initial",
      applicationId: "app_submitted",
      category: "EMPLOYMENT",
      roundNo: 2,
      status: "PROCESSING",
    });

    const latest = await getLatestMaterialCategoryReview(
      "app_submitted",
      "EMPLOYMENT",
    );
    expect(latest?.id).toBe(created.id);

    const history = await getMaterialSupplementHistoryData("app_submitted", {
      category: "EMPLOYMENT",
    });
    expect(history.items).toHaveLength(2);
    expect(history.items.filter((item) => item.isLatest)).toHaveLength(1);
    expect(history.items.find((item) => item.categoryReviewId !== created.id)?.isLatest).toBe(
      false,
    );
  });

  it("replaces latest supplement requests by historicalizing older ones", async () => {
    const created = await replaceLatestSupplementRequestsForCategory({
      applicationId: "app_submitted",
      category: "EMPLOYMENT",
      reviewRunId: "mr_run_initial",
      categoryReviewId: "mcr_employment_initial",
      requests: [
        {
          title: "Upload payroll proof",
          reason: "A more recent employment proof is needed.",
          suggestedMaterials: ["Payroll slip"],
        },
      ],
    });

    expect(created).toHaveLength(1);

    const latest = await listLatestSupplementRequests(
      "app_submitted",
      "EMPLOYMENT",
    );
    expect(latest).toHaveLength(1);
    expect(latest[0]?.title).toBe("Upload payroll proof");

    const history = await getMaterialSupplementHistoryData("app_submitted", {
      category: "EMPLOYMENT",
      runNo: 1,
    });
    const oldRequest = history.items
      .flatMap((item) => item.requests)
      .find((item) => item.title === "Upload recent employment proof");
    expect(oldRequest?.status).toBe("HISTORY_ONLY");
  });

  it("historicalizes older latest requests when creating a new latest request directly", async () => {
    const created = await createSupplementRequest({
      applicationId: "app_submitted",
      category: "EMPLOYMENT",
      reviewRunId: "mr_run_initial",
      categoryReviewId: "mcr_employment_initial",
      title: "Upload offer letter",
      reason: "Offer letter is also required.",
    });

    const latest = await listLatestSupplementRequests(
      "app_submitted",
      "EMPLOYMENT",
    );

    expect(created.isLatest).toBe(true);
    expect(latest).toHaveLength(1);
    expect(latest[0]?.id).toBe(created.id);

    const history = await getMaterialSupplementHistoryData("app_submitted", {
      category: "EMPLOYMENT",
      runNo: 1,
    });
    const oldRequest = history.items
      .flatMap((item) => item.requests)
      .find((item) => item.title === "Upload recent employment proof");
    expect(oldRequest?.status).toBe("HISTORY_ONLY");
  });

  it("soft deletes draft supplement files and updates the batch file count", async () => {
    const removed = await softDeleteSupplementFile("supp_file_employment_draft");
    expect(removed?.isDeleted).toBe(true);

    const batch = await getSupplementUploadBatchById("supp_batch_employment_draft");
    expect(batch?.fileCount).toBe(0);
  });

  it("rejects deleting supplement files from a non-draft batch", async () => {
    await expect(
      softDeleteSupplementFile("supp_file_identity_reviewing"),
    ).rejects.toThrow("Only draft supplement batch files can be deleted.");
  });

  it("detects active duplicate supplement files by category, name, and size", async () => {
    const duplicate = await findActiveSupplementFileDuplicate(
      "app_submitted",
      "EMPLOYMENT",
      "employment-proof.pdf",
      2048,
    );

    expect(duplicate?.id).toBe("supp_file_employment_draft");
  });

  it("rejects creating a supplement file when the batch belongs to another category", async () => {
    await expect(
      createSupplementFile({
        applicationId: "app_submitted",
        category: "IDENTITY",
        uploadBatchId: "supp_batch_employment_draft",
        fileName: "wrong-category.pdf",
        objectKey: "applications/app_submitted/supplements/IDENTITY/wrong-category.pdf",
        fileType: "application/pdf",
        fileSize: 111,
      }),
    ).rejects.toThrow(
      "Supplement upload batch category does not match the file category.",
    );
  });

  it("rejects creating a supplement file when the request belongs to another category", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_submitted",
      category: "IDENTITY",
    });

    await expect(
      createSupplementFile({
        applicationId: "app_submitted",
        category: "IDENTITY",
        uploadBatchId: batch.id,
        supplementRequestId: "supp_req_employment_latest",
        fileName: "wrong-request.pdf",
        objectKey: "applications/app_submitted/supplements/IDENTITY/wrong-request.pdf",
        fileType: "application/pdf",
        fileSize: 222,
      }),
    ).rejects.toThrow(
      "Supplement request category does not match the uploaded file category.",
    );
  });

  it("returns snapshot data with latest requests, draft files, and waiting review files", async () => {
    const snapshot = await getMaterialSupplementSnapshotData("app_submitted");

    expect(snapshot.summary.pendingRequestCount).toBeGreaterThan(0);

    const employment = snapshot.categories.find(
      (item) => item.category === "EMPLOYMENT",
    );
    const identity = snapshot.categories.find((item) => item.category === "IDENTITY");

    expect(employment?.requests[0]?.title).toBe("Upload recent employment proof");
    expect(employment?.draftFiles[0]?.fileName).toBe("employment-proof.pdf");
    expect(identity?.waitingReviewFiles[0]?.fileName).toBe("passport-fullscan.pdf");
  });

  it("returns history in descending order and supports category/run filters", async () => {
    const fullHistory = await getMaterialSupplementHistoryData("app_submitted");
    expect(fullHistory.items[0]?.runNo).toBe(2);

    const runOneHistory = await getMaterialSupplementHistoryData("app_submitted", {
      runNo: 1,
    });
    expect(runOneHistory.items.every((item) => item.runNo === 1)).toBe(true);

    const identityHistory = await getMaterialSupplementHistoryData("app_submitted", {
      category: "IDENTITY",
    });
    expect(identityHistory.items.every((item) => item.category === "IDENTITY")).toBe(
      true,
    );
  });

  it("attaches draft batch files to a review run and marks the batch reviewing", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_submitted",
      category: "PATENT",
    });
    const run = await createMaterialReviewRun({
      applicationId: "app_submitted",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "PATENT",
    });
    const file = await createSupplementFile({
      applicationId: "app_submitted",
      category: "PATENT",
      uploadBatchId: batch.id,
      fileName: "patent.pdf",
      objectKey: "applications/app_submitted/supplements/PATENT/patent.pdf",
      fileType: "application/pdf",
      fileSize: 5120,
    });

    const attached = await attachSupplementFilesToReviewRun(batch.id, run.id);

    expect(attached.batch.status).toBe("REVIEWING");
    expect(attached.files[0]?.id).toBe(file.id);

    const savedFile = await getSupplementFileById(file.id);
    expect(savedFile?.reviewRunId).toBe(run.id);
  });

  it("rejects attaching a batch to a review run from another category", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_submitted",
      category: "PATENT",
    });
    const run = await createMaterialReviewRun({
      applicationId: "app_submitted",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "IDENTITY",
    });

    await expect(attachSupplementFilesToReviewRun(batch.id, run.id)).rejects.toThrow(
      "Material review run category does not match the supplement upload batch category.",
    );
  });

  it("rejects attaching a batch to a review run from another application", async () => {
    const batch = await createSupplementUploadBatch({
      applicationId: "app_submitted",
      category: "PATENT",
    });
    const run = await createMaterialReviewRun({
      applicationId: "app_progress",
      runNo: 1,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "PATENT",
    });

    await expect(attachSupplementFilesToReviewRun(batch.id, run.id)).rejects.toThrow(
      "Supplement upload batch and material review run must belong to the same application.",
    );
  });
});
