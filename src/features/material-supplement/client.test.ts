import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SupplementSnapshot,
  SupplementSummary,
} from "@/features/material-supplement/types";

import {
  MaterialSupplementClientError,
  confirmSupplementFileUpload,
  confirmSupplementUploadBatch,
  createSupplementUploadBatch,
  createSupplementUploadIntent,
  deleteSupplementDraftFile,
  ensureInitialReview,
  fetchSupplementReviewRun,
  fetchSupplementHistory,
  fetchSupplementSnapshot,
  fetchSupplementSummary,
  syncSupplementReviewRun,
} from "@/features/material-supplement/client";

describe("material supplement client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches supplement summary with tracked headers and no-store caching", async () => {
    const summary: SupplementSummary = {
      applicationId: "app_001",
      materialSupplementStatus: "REVIEWING",
      latestReviewRunId: "run_001",
      latestReviewedAt: null,
      pendingRequestCount: 2,
      satisfiedRequestCount: 1,
      remainingReviewRounds: 2,
      supportedCategories: [
        "IDENTITY",
        "EDUCATION",
        "EMPLOYMENT",
        "PROJECT",
        "PATENT",
        "HONOR",
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(summary), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSupplementSummary("app_001")).resolves.toEqual(summary);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement/summary",
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(requestInit.credentials).toBe("include");
    expect(requestInit.cache).toBe("no-store");
    expect(headers.get("x-autohire-request-id")).toBeTruthy();
    expect(headers.get("x-autohire-session-id")).toBeTruthy();
  });

  it("posts to the initial review endpoint", async () => {
    const payload = {
      applicationId: "app_001",
      reviewRunId: "run_001",
      runNo: 1,
      status: "QUEUED",
      created: true,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureInitialReview("app_001")).resolves.toEqual(payload);

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement/reviews/initial",
    );
    expect(requestInit.method).toBe("POST");
    expect(requestInit.credentials).toBe("include");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(requestInit.body).toBe("{}");
  });

  it("fetches supplement review run status", async () => {
    const payload = {
      reviewRunId: "run_001",
      applicationId: "app_001",
      runNo: 1,
      status: "COMPLETED" as const,
      triggerType: "INITIAL_SUBMISSION",
      triggeredCategory: null,
      startedAt: "2026-05-05T09:00:00.000Z",
      finishedAt: "2026-05-05T09:30:00.000Z",
      categories: [
        {
          category: "EDUCATION" as const,
          status: "COMPLETED" as const,
          isLatest: true,
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSupplementReviewRun("app_001", "run_001"),
    ).resolves.toEqual(payload);

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement/reviews/run_001",
    );
    expect(requestInit.credentials).toBe("include");
    expect(requestInit.cache).toBe("no-store");
  });

  it("posts supplement review run sync requests", async () => {
    const payload = {
      reviewRunId: "run_001",
      status: "COMPLETED" as const,
      synced: true,
      updatedCategories: ["EDUCATION" as const],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(syncSupplementReviewRun("app_001", "run_001")).resolves.toEqual(
      payload,
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement/reviews/run_001/sync",
    );
    expect(requestInit.method).toBe("POST");
    expect(requestInit.credentials).toBe("include");
  });

  it("fetches supplement snapshot", async () => {
    const snapshot: SupplementSnapshot = {
      applicationId: "app_001",
      summary: {
        materialSupplementStatus: "SUPPLEMENT_REQUIRED",
        latestReviewRunId: "run_001",
        latestReviewedAt: "2026-05-05T09:30:00.000Z",
        pendingRequestCount: 1,
        satisfiedRequestCount: 0,
        remainingReviewRounds: 2,
      },
      categories: [
        {
          category: "EDUCATION",
          label: "Education Documents",
          status: "SUPPLEMENT_REQUIRED",
          isReviewing: false,
          latestCategoryReviewId: "cat_review_001",
          latestReviewedAt: "2026-05-05T09:30:00.000Z",
          aiMessage: "Please upload degree proof.",
          pendingRequestCount: 1,
          requests: [
            {
              id: "req_001",
              title: "Doctoral degree proof required",
              reason: "Need proof",
              suggestedMaterials: ["Doctoral degree certificate"],
              aiMessage: "Upload a doctoral degree certificate.",
              status: "PENDING",
              isSatisfied: false,
              updatedAt: "2026-05-05T09:30:00.000Z",
            },
          ],
          draftFiles: [],
          waitingReviewFiles: [],
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSupplementSnapshot("app_001")).resolves.toEqual(snapshot);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement",
    );
  });

  it("builds history query parameters from filters", async () => {
    const payload = {
      applicationId: "app_001",
      filters: {
        category: "EDUCATION",
        runNo: 2,
      },
      items: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSupplementHistory("app_001", {
        category: "EDUCATION",
        runNo: 2,
      }),
    ).resolves.toEqual(payload);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement/history?category=EDUCATION&runNo=2",
    );
  });

  it("posts upload batch creation requests", async () => {
    const payload = {
      uploadBatchId: "batch_001",
      applicationId: "app_001",
      category: "EDUCATION" as const,
      status: "DRAFT" as const,
      fileCount: 0,
      createdAt: "2026-05-05T10:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createSupplementUploadBatch("app_001", { category: "EDUCATION" }),
    ).resolves.toEqual(payload);

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement/upload-batches",
    );
    expect(requestInit.method).toBe("POST");
    expect(requestInit.body).toBe(JSON.stringify({ category: "EDUCATION" }));
  });

  it("posts upload intent requests", async () => {
    const payload = {
      uploadId: "upload_001",
      uploadUrl: "https://storage.example.com/presigned-url",
      method: "PUT" as const,
      headers: {
        "Content-Type": "application/pdf",
      },
      objectKey: "applications/app_001/supplements/EDUCATION/batch_001/phd-degree.pdf",
      deduped: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createSupplementUploadIntent("app_001", {
        uploadBatchId: "batch_001",
        category: "EDUCATION",
        supplementRequestId: "req_001",
        fileName: "phd-degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
      }),
    ).resolves.toEqual(payload);

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement/upload-intent",
    );
    expect(requestInit.method).toBe("POST");
  });

  it("posts file confirmation requests", async () => {
    const payload = {
      file: {
        id: "supp_file_001",
        uploadBatchId: "batch_001",
        category: "EDUCATION" as const,
        supplementRequestId: "req_001",
        fileName: "phd-degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
        uploadedAt: "2026-05-05T10:03:00.000Z",
        status: "DRAFT" as const,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      confirmSupplementFileUpload("app_001", {
        uploadBatchId: "batch_001",
        category: "EDUCATION",
        supplementRequestId: "req_001",
        fileName: "phd-degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
        objectKey:
          "applications/app_001/supplements/EDUCATION/batch_001/phd-degree.pdf",
      }),
    ).resolves.toEqual(payload);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement/files",
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
  });

  it("deletes draft files", async () => {
    const payload = {
      deleted: true as const,
      fileId: "supp_file_001",
      uploadBatchId: "batch_001",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      deleteSupplementDraftFile("app_001", "supp_file_001"),
    ).resolves.toEqual(payload);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement/files/supp_file_001",
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe(
      "DELETE",
    );
  });

  it("posts batch confirmation requests", async () => {
    const payload = {
      uploadBatchId: "batch_001",
      applicationId: "app_001",
      category: "EDUCATION" as const,
      fileCount: 2,
      reviewRunId: "run_002",
      status: "REVIEWING" as const,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      confirmSupplementUploadBatch("app_001", "batch_001", {
        category: "EDUCATION",
      }),
    ).resolves.toEqual(payload);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/applications/app_001/material-supplement/upload-batches/batch_001/confirm",
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
  });

  it("throws a typed client error for API spec failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "FORBIDDEN",
            message: "Access denied.",
            details: {
              applicationId: "app_001",
            },
          },
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSupplementSummary("app_001")).rejects.toMatchObject({
      name: "MaterialSupplementClientError",
      status: 403,
      code: "FORBIDDEN",
      details: {
        applicationId: "app_001",
      },
      message: "Access denied.",
    });
  });

  it("falls back to a generic error when the response is not JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("upstream failed", {
        status: 500,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSupplementSummary("app_001")).rejects.toEqual(
      expect.objectContaining<Partial<MaterialSupplementClientError>>({
        status: 500,
        code: "REQUEST_FAILED",
        message: "Request failed.",
      }),
    );
  });
});
