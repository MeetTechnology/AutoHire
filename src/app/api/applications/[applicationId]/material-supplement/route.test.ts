import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET as getSnapshotRoute } from "@/app/api/applications/[applicationId]/material-supplement/route";
import { GET as getHistoryRoute } from "@/app/api/applications/[applicationId]/material-supplement/history/route";
import { GET as getReviewRunRoute } from "@/app/api/applications/[applicationId]/material-supplement/reviews/[reviewRunId]/route";
import { GET as getSummaryRoute } from "@/app/api/applications/[applicationId]/material-supplement/summary/route";
import { POST as postInitialRoute } from "@/app/api/applications/[applicationId]/material-supplement/reviews/initial/route";
import { POST as postReviewRunSyncRoute } from "@/app/api/applications/[applicationId]/material-supplement/reviews/[reviewRunId]/sync/route";
import { POST as postReviewRunCallbackRoute } from "@/app/api/internal/material-supplement/reviews/[reviewRunId]/callback/route";
import { POST as postUploadBatchRoute } from "@/app/api/applications/[applicationId]/material-supplement/upload-batches/route";
import { POST as postUploadBatchConfirmRoute } from "@/app/api/applications/[applicationId]/material-supplement/upload-batches/[batchId]/confirm/route";
import { POST as postUploadIntentRoute } from "@/app/api/applications/[applicationId]/material-supplement/upload-intent/route";
import { POST as postFileRoute } from "@/app/api/applications/[applicationId]/material-supplement/files/route";
import { DELETE as deleteFileRoute } from "@/app/api/applications/[applicationId]/material-supplement/files/[fileId]/route";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import {
  createMaterialReviewRun,
  getMaterialReviewRunByApplicationAndRunNo,
  listMaterialCategoryReviews,
  listMaterialReviewRuns,
  listSupplementRequests,
  updateApplication,
} from "@/lib/data/store";
import { createMaterialReviewCallbackSignature } from "@/lib/material-supplement/internal-auth";
import * as materialReviewClient from "@/lib/material-review/client";
import { MaterialReviewClientError } from "@/lib/material-review/types";

const originalEnv = { ...process.env };

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function buildRequest(
  url: string,
  init?: RequestInit & {
    session?:
      | {
          applicationId: string;
          invitationId: string;
          expertId: string;
        }
      | false;
  },
) {
  const headers = new Headers(init?.headers);

  if (init?.session !== false) {
    const session = init?.session ?? {
      applicationId: "app_supplement_required",
      invitationId: "invitation_supplement_required",
      expertId: "expert_supplement_required",
    };
    const token = createSessionToken(session);
    headers.set("cookie", `${getSessionCookieName()}=${token}`);
  }

  return new NextRequest(url, {
    method: init?.method,
    headers,
    body: init?.body,
    duplex: init?.body ? ("half" as const) : undefined,
  });
}

function buildCallbackRequest(
  url: string,
  body: unknown,
  init?: {
    secret?: string;
    timestamp?: string;
    signature?: string;
  },
) {
  const rawBody = typeof body === "string" ? body : JSON.stringify(body);
  const timestamp = init?.timestamp ?? new Date().toISOString();
  const secret = init?.secret ?? "callback-test-secret";
  const signature =
    init?.signature ??
    createMaterialReviewCallbackSignature({
      secret,
      timestamp,
      rawBody,
    });

  return new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Material-Review-Signature": signature,
      "X-Material-Review-Timestamp": timestamp,
    },
    body: rawBody,
    duplex: "half",
  });
}

const validCallbackPayload = {
  externalRunId: "external-callback-education",
  status: "COMPLETED",
  finishedAt: "2026-05-07T08:00:00.000Z",
  categories: [
    {
      category: "EDUCATION",
      status: "COMPLETED",
      reviewedAt: "2026-05-07T08:00:00.000Z",
      aiMessage: "Please upload proof of your doctoral degree.",
      resultPayload: {
        supplementRequired: true,
        requests: [
          {
            title: "Doctoral degree proof required",
            reason: "The submitted documents do not prove the doctoral degree.",
            suggestedMaterials: ["Doctoral degree certificate"],
            aiMessage: "Please upload proof of your doctoral degree.",
            status: "PENDING",
          },
        ],
      },
      rawResultPayload: null,
    },
  ],
} as const;

describe("material supplement routes", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_RUNTIME_MODE: "memory",
      FILE_STORAGE_MODE: "mock",
      MATERIAL_REVIEW_MODE: "mock",
    };
    resetMemoryStore();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns the supplement summary for a submitted application", async () => {
    const response = await getSummaryRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/summary",
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      applicationId: "app_supplement_required",
      materialSupplementStatus: "PARTIALLY_SATISFIED",
      latestReviewRunId: "mr_run_required_identity_resolved",
      pendingRequestCount: 1,
      satisfiedRequestCount: 1,
      remainingReviewRounds: 2,
    });
    expect(payload.supportedCategories).toEqual([
      "IDENTITY",
      "EDUCATION",
      "EMPLOYMENT",
      "PROJECT",
      "PATENT",
      "HONOR",
    ]);
  });

  it("returns unauthorized when summary is requested without a session", async () => {
    const response = await getSummaryRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/summary",
        {
          session: false,
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      error: {
        code: "UNAUTHORIZED",
      },
    });
  });

  it("returns forbidden when summary is requested with a foreign session", async () => {
    const response = await getSummaryRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/summary",
        {
          session: {
            applicationId: "app_intro",
            invitationId: "invitation_init",
            expertId: "expert_init",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
  });

  it("returns application not found when the summary target does not exist", async () => {
    const response = await getSummaryRoute(
      buildRequest(
        "http://localhost/api/applications/app_missing/material-supplement/summary",
        {
          session: {
            applicationId: "app_missing",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_missing",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({
      error: {
        code: "APPLICATION_NOT_FOUND",
      },
    });
  });

  it("returns application not submitted when summary is requested before submission", async () => {
    const response = await getSummaryRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/summary",
        {
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: {
        code: "APPLICATION_NOT_SUBMITTED",
      },
    });
  });

  it("returns the supplement snapshot with all supported categories", async () => {
    const response = await getSnapshotRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement",
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      applicationId: "app_supplement_required",
      summary: {
        materialSupplementStatus: "PARTIALLY_SATISFIED",
        latestReviewRunId: "mr_run_required_identity_resolved",
        pendingRequestCount: 1,
        satisfiedRequestCount: 1,
        remainingReviewRounds: 2,
      },
    });
    expect(payload.categories).toHaveLength(6);

    const identity = payload.categories.find(
      (item: { category: string }) => item.category === "IDENTITY",
    );
    const employment = payload.categories.find(
      (item: { category: string }) => item.category === "EMPLOYMENT",
    );

    expect(identity).toMatchObject({
      category: "IDENTITY",
      status: "SATISFIED",
      pendingRequestCount: 0,
      requests: [],
    });
    expect(employment).toMatchObject({
      category: "EMPLOYMENT",
      status: "SUPPLEMENT_REQUIRED",
      pendingRequestCount: 1,
      requests: [
        {
          id: "supp_req_required_employment_latest",
          status: "PENDING",
          isSatisfied: false,
        },
      ],
      draftFiles: [
        {
          id: "supp_file_required_employment_draft",
          fileName: "employment-proof.pdf",
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("objectKey");
  });

  it("marks categories as reviewing in the supplement snapshot", async () => {
    const response = await getSnapshotRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_reviewing/material-supplement",
        {
          session: {
            applicationId: "app_supplement_reviewing",
            invitationId: "invitation_supplement_reviewing",
            expertId: "expert_supplement_reviewing",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_reviewing",
        }),
      },
    );
    const payload = await response.json();
    const identity = payload.categories.find(
      (item: { category: string }) => item.category === "IDENTITY",
    );

    expect(response.status).toBe(200);
    expect(identity).toMatchObject({
      category: "IDENTITY",
      status: "REVIEWING",
      isReviewing: true,
      latestCategoryReviewId: "mcr_reviewing_identity_retry",
      requests: [],
      waitingReviewFiles: [
        {
          id: "supp_file_reviewing_identity_reviewing",
          fileName: "passport-fullscan.pdf",
        },
      ],
    });
  });

  it("returns unauthorized when snapshot is requested without a session", async () => {
    const response = await getSnapshotRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement",
        {
          session: false,
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      error: {
        code: "UNAUTHORIZED",
      },
    });
  });

  it("returns application not found when the snapshot target does not exist", async () => {
    const response = await getSnapshotRoute(
      buildRequest(
        "http://localhost/api/applications/app_missing/material-supplement",
        {
          session: {
            applicationId: "app_missing",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_missing",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({
      error: {
        code: "APPLICATION_NOT_FOUND",
      },
    });
  });

  it("returns the supplement review history", async () => {
    const response = await getHistoryRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/history",
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      applicationId: "app_supplement_required",
      filters: {
        category: null,
        runNo: null,
      },
    });
    expect(payload.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reviewRunId: "mr_run_required_identity_resolved",
          runNo: 2,
          category: "IDENTITY",
          categoryReviewId: "mcr_required_identity_resolved",
          isLatest: true,
          requests: [
            expect.objectContaining({
              id: "supp_req_required_identity_latest",
              status: "SATISFIED",
              isSatisfied: true,
            }),
          ],
        }),
        expect.objectContaining({
          reviewRunId: "mr_run_required_initial",
          runNo: 1,
          category: "IDENTITY",
          categoryReviewId: "mcr_required_identity_initial",
          isLatest: false,
          requests: [
            expect.objectContaining({
              id: "supp_req_required_identity_history",
              status: "SATISFIED",
              isSatisfied: true,
            }),
          ],
        }),
      ]),
    );
    expect(JSON.stringify(payload)).not.toContain("objectKey");
  });

  it("filters supplement history by category", async () => {
    const response = await getHistoryRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/history?category=IDENTITY",
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.filters).toEqual({
      category: "IDENTITY",
      runNo: null,
    });
    expect(payload.items).toHaveLength(2);
    expect(
      payload.items.every(
        (item: { category: string }) => item.category === "IDENTITY",
      ),
    ).toBe(true);
  });

  it("filters supplement history by run number", async () => {
    const response = await getHistoryRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/history?runNo=2",
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.filters).toEqual({
      category: null,
      runNo: 2,
    });
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      runNo: 2,
      category: "IDENTITY",
    });
  });

  it("ignores invalid supplement history filters", async () => {
    const response = await getHistoryRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/history?category=PRODUCT&runNo=-1",
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.filters).toEqual({
      category: null,
      runNo: null,
    });
    expect(payload.items.length).toBeGreaterThan(1);
  });

  it("returns forbidden when history is requested with a foreign session", async () => {
    const response = await getHistoryRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/history",
        {
          session: {
            applicationId: "app_intro",
            invitationId: "invitation_init",
            expertId: "expert_init",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
  });

  it("returns application not submitted when history is requested before submission", async () => {
    const response = await getHistoryRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/history",
        {
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: {
        code: "APPLICATION_NOT_SUBMITTED",
      },
    });
  });

  it("creates the initial review run exactly once and returns created flags", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });

    const reviewSpy = vi.spyOn(
      materialReviewClient,
      "createInitialMaterialReview",
    );

    const firstResponse = await postInitialRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/reviews/initial",
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const firstPayload = await firstResponse.json();

    const secondResponse = await postInitialRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/reviews/initial",
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstPayload).toMatchObject({
      applicationId: "app_secondary",
      runNo: 1,
      created: true,
    });
    expect(firstPayload.status).toBe("COMPLETED");

    expect(secondResponse.status).toBe(200);
    expect(secondPayload).toMatchObject({
      applicationId: "app_secondary",
      runNo: 1,
      created: false,
      reviewRunId: firstPayload.reviewRunId,
      status: "COMPLETED",
    });

    expect(reviewSpy).toHaveBeenCalledTimes(1);

    const savedRun = await getMaterialReviewRunByApplicationAndRunNo(
      "app_secondary",
      1,
    );
    expect(savedRun).toMatchObject({
      id: firstPayload.reviewRunId,
      triggerType: "INITIAL_SUBMISSION",
      status: "COMPLETED",
    });
    expect(savedRun?.externalRunId).toContain("mock-material-review:initial:");

    const reviewRuns = await listMaterialReviewRuns("app_secondary");
    expect(reviewRuns).toHaveLength(1);

    const summaryResponse = await getSummaryRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/summary",
        {
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const summaryPayload = await summaryResponse.json();

    expect(summaryResponse.status).toBe(200);
    expect(summaryPayload).toMatchObject({
      applicationId: "app_secondary",
      materialSupplementStatus: "NO_SUPPLEMENT_REQUIRED",
      latestReviewRunId: firstPayload.reviewRunId,
    });
  });

  it("returns backend unavailable when the material review client cannot start", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });

    vi.spyOn(
      materialReviewClient,
      "createInitialMaterialReview",
    ).mockRejectedValue(
      new MaterialReviewClientError({
        message: "Live backend unavailable.",
        failureCode: "BACKEND_UNAVAILABLE",
        retryable: true,
        httpStatus: 503,
      }),
    );

    const response = await postInitialRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/reviews/initial",
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      error: {
        code: "MATERIAL_REVIEW_BACKEND_UNAVAILABLE",
      },
    });
  });

  it("returns application not submitted when creating an initial review before submission", async () => {
    const response = await postInitialRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/reviews/initial",
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: {
        code: "APPLICATION_NOT_SUBMITTED",
      },
    });
  });

  it("creates an initial review even when the submitted application has no materials", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });

    const response = await postInitialRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/reviews/initial",
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      applicationId: "app_secondary",
      runNo: 1,
      created: true,
    });
  });

  it("returns a material supplement review run status", async () => {
    const response = await getReviewRunRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/reviews/mr_run_required_identity_resolved",
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
          reviewRunId: "mr_run_required_identity_resolved",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
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

  it("returns review run route auth and not found errors", async () => {
    const unauthorized = await getReviewRunRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/reviews/mr_run_required_identity_resolved",
        { session: false },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
          reviewRunId: "mr_run_required_identity_resolved",
        }),
      },
    );
    const foreign = await getReviewRunRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/reviews/mr_run_required_identity_resolved",
        {
          session: {
            applicationId: "app_intro",
            invitationId: "invitation_init",
            expertId: "expert_init",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
          reviewRunId: "mr_run_required_identity_resolved",
        }),
      },
    );
    const notSubmitted = await getReviewRunRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/reviews/missing_run",
        {
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
          reviewRunId: "missing_run",
        }),
      },
    );
    const missing = await getReviewRunRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/reviews/missing_run",
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
          reviewRunId: "missing_run",
        }),
      },
    );

    await expect(unauthorized.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
    await expect(foreign.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
    await expect(notSubmitted.json()).resolves.toMatchObject({
      error: { code: "APPLICATION_NOT_SUBMITTED" },
    });
    await expect(missing.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_REVIEW_RUN_NOT_FOUND" },
    });
    expect(unauthorized.status).toBe(401);
    expect(foreign.status).toBe(403);
    expect(notSubmitted.status).toBe(409);
    expect(missing.status).toBe(404);
  });

  it("syncs a material supplement review run and is idempotent", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });
    const initialResponse = await postInitialRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/reviews/initial",
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const initialPayload = await initialResponse.json();

    const firstResponse = await postReviewRunSyncRoute(
      buildRequest(
        `http://localhost/api/applications/app_secondary/material-supplement/reviews/${initialPayload.reviewRunId}/sync`,
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
          reviewRunId: initialPayload.reviewRunId,
        }),
      },
    );
    const firstPayload = await firstResponse.json();
    const secondResponse = await postReviewRunSyncRoute(
      buildRequest(
        `http://localhost/api/applications/app_secondary/material-supplement/reviews/${initialPayload.reviewRunId}/sync`,
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
          reviewRunId: initialPayload.reviewRunId,
        }),
      },
    );
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstPayload).toMatchObject({
      reviewRunId: initialPayload.reviewRunId,
      status: "COMPLETED",
      synced: true,
    });
    expect(firstPayload.updatedCategories).toHaveLength(6);
    expect(secondResponse.status).toBe(200);
    expect(secondPayload).toEqual({
      reviewRunId: initialPayload.reviewRunId,
      status: "COMPLETED",
      synced: false,
      updatedCategories: [],
    });
  });

  it("returns sync route backend unavailable and missing run errors", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });
    const initialResponse = await postInitialRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/reviews/initial",
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const initialPayload = await initialResponse.json();

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

    const unavailable = await postReviewRunSyncRoute(
      buildRequest(
        `http://localhost/api/applications/app_secondary/material-supplement/reviews/${initialPayload.reviewRunId}/sync`,
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
          reviewRunId: initialPayload.reviewRunId,
        }),
      },
    );
    const missing = await postReviewRunSyncRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/reviews/missing_run/sync",
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
          reviewRunId: "missing_run",
        }),
      },
    );

    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toMatchObject({
      error: { code: "MATERIAL_REVIEW_BACKEND_UNAVAILABLE" },
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_REVIEW_RUN_NOT_FOUND" },
    });
  });

  it("accepts an internal material review callback and is idempotent", async () => {
    process.env.MATERIAL_REVIEW_CALLBACK_SECRET = "callback-test-secret";
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "PROCESSING",
      externalRunId: validCallbackPayload.externalRunId,
    });

    const firstResponse = await postReviewRunCallbackRoute(
      buildCallbackRequest(
        `http://localhost/api/internal/material-supplement/reviews/${reviewRun.id}/callback`,
        validCallbackPayload,
      ),
      {
        params: Promise.resolve({
          reviewRunId: reviewRun.id,
        }),
      },
    );
    const firstPayload = await firstResponse.json();
    const secondResponse = await postReviewRunCallbackRoute(
      buildCallbackRequest(
        `http://localhost/api/internal/material-supplement/reviews/${reviewRun.id}/callback`,
        validCallbackPayload,
      ),
      {
        params: Promise.resolve({
          reviewRunId: reviewRun.id,
        }),
      },
    );
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstPayload).toEqual({
      reviewRunId: reviewRun.id,
      accepted: true,
      status: "COMPLETED",
      updatedCategories: ["EDUCATION"],
    });
    expect(secondResponse.status).toBe(200);
    expect(secondPayload).toEqual({
      reviewRunId: reviewRun.id,
      accepted: true,
      status: "COMPLETED",
      updatedCategories: [],
    });
    await expect(
      listMaterialCategoryReviews("app_supplement_required", {
        reviewRunId: reviewRun.id,
      }),
    ).resolves.toHaveLength(1);
    await expect(
      listSupplementRequests("app_supplement_required", {
        reviewRunId: reviewRun.id,
      }),
    ).resolves.toHaveLength(1);
  });

  it("does not downgrade a completed review run from a delayed internal callback", async () => {
    process.env.MATERIAL_REVIEW_CALLBACK_SECRET = "callback-test-secret";
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "COMPLETED",
      externalRunId: validCallbackPayload.externalRunId,
      finishedAt: new Date("2026-05-07T08:00:00.000Z"),
    });

    const delayedPayload = {
      ...validCallbackPayload,
      status: "PROCESSING",
      finishedAt: null,
      categories: [],
    };
    const response = await postReviewRunCallbackRoute(
      buildCallbackRequest(
        `http://localhost/api/internal/material-supplement/reviews/${reviewRun.id}/callback`,
        delayedPayload,
      ),
      {
        params: Promise.resolve({
          reviewRunId: reviewRun.id,
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      reviewRunId: reviewRun.id,
      accepted: true,
      status: "COMPLETED",
      updatedCategories: [],
    });
    await expect(
      getMaterialReviewRunByApplicationAndRunNo("app_supplement_required", 3),
    ).resolves.toMatchObject({
      status: "COMPLETED",
    });
  });

  it("rejects internal callbacks without valid authentication", async () => {
    process.env.MATERIAL_REVIEW_CALLBACK_SECRET = "callback-test-secret";
    const reviewRun = await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EDUCATION",
      status: "PROCESSING",
      externalRunId: validCallbackPayload.externalRunId,
    });

    const missingHeaders = await postReviewRunCallbackRoute(
      new NextRequest(
        `http://localhost/api/internal/material-supplement/reviews/${reviewRun.id}/callback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validCallbackPayload),
          duplex: "half",
        },
      ),
      {
        params: Promise.resolve({
          reviewRunId: reviewRun.id,
        }),
      },
    );
    const badSignature = await postReviewRunCallbackRoute(
      buildCallbackRequest(
        `http://localhost/api/internal/material-supplement/reviews/${reviewRun.id}/callback`,
        validCallbackPayload,
        { signature: "bad-signature" },
      ),
      {
        params: Promise.resolve({
          reviewRunId: reviewRun.id,
        }),
      },
    );
    const expired = await postReviewRunCallbackRoute(
      buildCallbackRequest(
        `http://localhost/api/internal/material-supplement/reviews/${reviewRun.id}/callback`,
        validCallbackPayload,
        { timestamp: "2026-05-07T00:00:00.000Z" },
      ),
      {
        params: Promise.resolve({
          reviewRunId: reviewRun.id,
        }),
      },
    );

    expect(missingHeaders.status).toBe(401);
    expect(badSignature.status).toBe(401);
    expect(expired.status).toBe(401);
    await expect(missingHeaders.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_UNAUTHORIZED" },
    });
    await expect(badSignature.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_SIGNATURE_INVALID" },
    });
    await expect(expired.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_TIMESTAMP_INVALID" },
    });
  });

  it("returns internal callback missing run and invalid payload errors", async () => {
    process.env.MATERIAL_REVIEW_CALLBACK_SECRET = "callback-test-secret";

    const missingRun = await postReviewRunCallbackRoute(
      buildCallbackRequest(
        "http://localhost/api/internal/material-supplement/reviews/missing_run/callback",
        validCallbackPayload,
      ),
      {
        params: Promise.resolve({
          reviewRunId: "missing_run",
        }),
      },
    );
    const invalidPayload = await postReviewRunCallbackRoute(
      buildCallbackRequest(
        "http://localhost/api/internal/material-supplement/reviews/missing_run/callback",
        {
          ...validCallbackPayload,
          categories: [
            {
              ...validCallbackPayload.categories[0],
              resultPayload: null,
            },
          ],
        },
      ),
      {
        params: Promise.resolve({
          reviewRunId: "missing_run",
        }),
      },
    );

    expect(missingRun.status).toBe(404);
    await expect(missingRun.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_REVIEW_RUN_NOT_FOUND" },
    });
    expect(invalidPayload.status).toBe(400);
    await expect(invalidPayload.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_REVIEW_RESULT_INVALID" },
    });
  });

  it("creates a supplement upload batch for a submitted application", async () => {
    const response = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      status: "DRAFT",
      fileCount: 0,
    });
    expect(payload.uploadBatchId).toBeTruthy();
    expect(payload.createdAt).toBeTruthy();
  });

  it("creates a supplement upload intent with an independent supplement object key", async () => {
    const batchResponse = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const batchPayload = await batchResponse.json();

    const response = await postUploadIntentRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-intent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadBatchId: batchPayload.uploadBatchId,
            category: "EDUCATION",
            supplementRequestId: "supp_req_required_employment_latest",
            fileName: "phd degree.pdf",
            fileType: "application/pdf",
            fileSize: 123456,
          }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
      },
      deduped: false,
    });
    expect(payload.uploadId).toMatch(/^supplement_upload_/);
    expect(decodeURIComponent(payload.uploadUrl)).toContain(payload.objectKey);
    expect(payload.objectKey).toMatch(
      /^applications\/app_supplement_required\/supplements\/EDUCATION\/.+\/supplement_upload_[a-f0-9]+-\d+-phd_degree\.pdf$/,
    );
    expect(payload.objectKey).not.toContain("/materials/");
  });

  it("returns unauthorized when creating an upload batch without a session", async () => {
    const response = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches",
        {
          method: "POST",
          session: false,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      error: {
        code: "UNAUTHORIZED",
      },
    });
  });

  it("returns unsupported category and reviewing lock errors for upload batches", async () => {
    const unsupported = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "PRODUCT" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const reviewing = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_reviewing/material-supplement/upload-batches",
        {
          method: "POST",
          session: {
            applicationId: "app_supplement_reviewing",
            invitationId: "invitation_supplement_reviewing",
            expertId: "expert_supplement_reviewing",
          },
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "IDENTITY" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_reviewing",
        }),
      },
    );
    const otherCategory = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_reviewing/material-supplement/upload-batches",
        {
          method: "POST",
          session: {
            applicationId: "app_supplement_reviewing",
            invitationId: "invitation_supplement_reviewing",
            expertId: "expert_supplement_reviewing",
          },
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "HONOR" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_reviewing",
        }),
      },
    );

    expect(unsupported.status).toBe(400);
    await expect(unsupported.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_CATEGORY_UNSUPPORTED" },
    });
    expect(reviewing.status).toBe(409);
    await expect(reviewing.json()).resolves.toMatchObject({
      error: {
        code: "SUPPLEMENT_CATEGORY_REVIEWING",
        details: { category: "IDENTITY" },
      },
    });
    expect(otherCategory.status).toBe(200);
    await expect(otherCategory.json()).resolves.toMatchObject({
      applicationId: "app_supplement_reviewing",
      category: "HONOR",
      status: "DRAFT",
    });
  });

  it("returns application not submitted when creating an upload intent too early", async () => {
    const response = await postUploadIntentRoute(
      buildRequest(
        "http://localhost/api/applications/app_secondary/material-supplement/upload-intent",
        {
          method: "POST",
          session: {
            applicationId: "app_secondary",
            invitationId: "invitation_secondary",
            expertId: "expert_secondary",
          },
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadBatchId: "batch_001",
            category: "EDUCATION",
            fileName: "degree.pdf",
            fileType: "application/pdf",
            fileSize: 123456,
          }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_secondary",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: {
        code: "APPLICATION_NOT_SUBMITTED",
      },
    });
  });

  it("returns file validation and count errors for upload intents", async () => {
    const batchResponse = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const batchPayload = await batchResponse.json();

    const unsupportedType = await postUploadIntentRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-intent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadBatchId: batchPayload.uploadBatchId,
            category: "EDUCATION",
            fileName: "degree.exe",
            fileType: "application/octet-stream",
            fileSize: 123456,
          }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const oversized = await postUploadIntentRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-intent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadBatchId: batchPayload.uploadBatchId,
            category: "EDUCATION",
            fileName: "degree.pdf",
            fileType: "application/pdf",
            fileSize: 21 * 1024 * 1024,
          }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );

    for (let index = 0; index < 10; index += 1) {
      const response = await postUploadIntentRoute(
        buildRequest(
          "http://localhost/api/applications/app_supplement_required/material-supplement/upload-intent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              uploadBatchId: batchPayload.uploadBatchId,
              category: "EDUCATION",
              fileName: `degree-${index}.pdf`,
              fileType: "application/pdf",
              fileSize: 123456 + index,
            }),
          },
        ),
        {
          params: Promise.resolve({
            applicationId: "app_supplement_required",
          }),
        },
      );

      expect(response.status).toBe(200);
    }

    const countExceeded = await postUploadIntentRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-intent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadBatchId: batchPayload.uploadBatchId,
            category: "EDUCATION",
            fileName: "degree-extra.pdf",
            fileType: "application/pdf",
            fileSize: 654321,
          }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );

    expect(unsupportedType.status).toBe(400);
    await expect(unsupportedType.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_FILE_TYPE_UNSUPPORTED" },
    });
    expect(oversized.status).toBe(400);
    await expect(oversized.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_FILE_SIZE_EXCEEDED" },
    });
    expect(countExceeded.status).toBe(409);
    await expect(countExceeded.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_FILE_COUNT_EXCEEDED" },
    });
  });

  it("confirms a supplement file without exposing storage object keys", async () => {
    const batchResponse = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const batchPayload = await batchResponse.json();

    const response = await postFileRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/files",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadBatchId: batchPayload.uploadBatchId,
            category: "EDUCATION",
            fileName: "phd-degree.pdf",
            fileType: "application/pdf",
            fileSize: 123456,
            objectKey: `applications/app_supplement_required/supplements/EDUCATION/${batchPayload.uploadBatchId}/phd-degree.pdf`,
          }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      file: {
        uploadBatchId: batchPayload.uploadBatchId,
        category: "EDUCATION",
        supplementRequestId: null,
        fileName: "phd-degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
        status: "DRAFT",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("objectKey");
  });

  it("returns duplicate file errors when confirming an active supplement file", async () => {
    const response = await postFileRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/files",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadBatchId: "supp_batch_required_employment_draft",
            category: "EMPLOYMENT",
            supplementRequestId: "supp_req_required_employment_latest",
            fileName: "employment-proof.pdf",
            fileType: "application/pdf",
            fileSize: 2048,
            objectKey:
              "applications/app_supplement_required/supplements/EMPLOYMENT/supp_batch_required_employment_draft/employment-proof-copy.pdf",
          }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_FILE_DUPLICATE" },
    });
  });

  it("deletes only draft supplement files", async () => {
    const response = await deleteFileRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/files/supp_file_required_employment_draft",
        {
          method: "DELETE",
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
          fileId: "supp_file_required_employment_draft",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      deleted: true,
      fileId: "supp_file_required_employment_draft",
      uploadBatchId: "supp_batch_required_employment_draft",
    });

    const snapshotResponse = await getSnapshotRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement",
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const snapshotPayload = await snapshotResponse.json();
    const employment = snapshotPayload.categories.find(
      (item: { category: string }) => item.category === "EMPLOYMENT",
    );

    expect(employment.draftFiles).toEqual([]);
  });

  it("rejects deleting non-draft supplement files", async () => {
    const response = await deleteFileRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_reviewing/material-supplement/files/supp_file_reviewing_identity_reviewing",
        {
          method: "DELETE",
          session: {
            applicationId: "app_supplement_reviewing",
            invitationId: "invitation_supplement_reviewing",
            expertId: "expert_supplement_reviewing",
          },
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_reviewing",
          fileId: "supp_file_reviewing_identity_reviewing",
        }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_FILE_NOT_DRAFT" },
    });
  });

  it("confirms an upload batch, locks only that category, and is idempotent", async () => {
    const reviewSpy = vi.spyOn(
      materialReviewClient,
      "createCategoryMaterialReview",
    );
    const batchResponse = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const batchPayload = await batchResponse.json();

    await postFileRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/files",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadBatchId: batchPayload.uploadBatchId,
            category: "EDUCATION",
            fileName: "phd-degree.pdf",
            fileType: "application/pdf",
            fileSize: 123456,
            objectKey: `applications/app_supplement_required/supplements/EDUCATION/${batchPayload.uploadBatchId}/phd-degree.pdf`,
          }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );

    const firstResponse = await postUploadBatchConfirmRoute(
      buildRequest(
        `http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches/${batchPayload.uploadBatchId}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
          batchId: batchPayload.uploadBatchId,
        }),
      },
    );
    const firstPayload = await firstResponse.json();
    const secondResponse = await postUploadBatchConfirmRoute(
      buildRequest(
        `http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches/${batchPayload.uploadBatchId}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
          batchId: batchPayload.uploadBatchId,
        }),
      },
    );
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstPayload).toMatchObject({
      uploadBatchId: batchPayload.uploadBatchId,
      applicationId: "app_supplement_required",
      category: "EDUCATION",
      fileCount: 1,
      status: "REVIEWING",
    });
    expect(secondResponse.status).toBe(200);
    expect(secondPayload).toEqual(firstPayload);
    expect(reviewSpy).toHaveBeenCalledTimes(1);

    const snapshotResponse = await getSnapshotRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement",
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const snapshotPayload = await snapshotResponse.json();
    const education = snapshotPayload.categories.find(
      (item: { category: string }) => item.category === "EDUCATION",
    );
    const employment = snapshotPayload.categories.find(
      (item: { category: string }) => item.category === "EMPLOYMENT",
    );

    expect(education).toMatchObject({
      category: "EDUCATION",
      status: "REVIEWING",
      isReviewing: true,
      waitingReviewFiles: [
        {
          fileName: "phd-degree.pdf",
        },
      ],
    });
    expect(employment.isReviewing).toBe(false);
    expect(JSON.stringify(snapshotPayload)).not.toContain("objectKey");
  });

  it("returns backend unavailable when confirming an upload batch cannot start review", async () => {
    vi.spyOn(
      materialReviewClient,
      "createCategoryMaterialReview",
    ).mockRejectedValueOnce(
      new MaterialReviewClientError({
        message: "Live backend unavailable.",
        failureCode: "BACKEND_UNAVAILABLE",
        retryable: true,
        httpStatus: 503,
      }),
    );
    const batchResponse = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const batchPayload = await batchResponse.json();

    await postFileRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/files",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadBatchId: batchPayload.uploadBatchId,
            category: "EDUCATION",
            fileName: "backend-unavailable-degree.pdf",
            fileType: "application/pdf",
            fileSize: 123456,
            objectKey: `applications/app_supplement_required/supplements/EDUCATION/${batchPayload.uploadBatchId}/backend-unavailable-degree.pdf`,
          }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );

    const response = await postUploadBatchConfirmRoute(
      buildRequest(
        `http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches/${batchPayload.uploadBatchId}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
          batchId: batchPayload.uploadBatchId,
        }),
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MATERIAL_REVIEW_BACKEND_UNAVAILABLE" },
    });
  });

  it("rejects empty upload batch confirmation", async () => {
    const batchResponse = await postUploadBatchRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
        }),
      },
    );
    const batchPayload = await batchResponse.json();

    const response = await postUploadBatchConfirmRoute(
      buildRequest(
        `http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches/${batchPayload.uploadBatchId}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
          batchId: batchPayload.uploadBatchId,
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: {
        code: "SUPPLEMENT_UPLOAD_BATCH_EMPTY",
      },
    });
  });

  it("rejects missing upload batch confirmation", async () => {
    const response = await postUploadBatchConfirmRoute(
      buildRequest(
        "http://localhost/api/applications/app_supplement_required/material-supplement/upload-batches/missing_batch/confirm",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category: "EDUCATION" }),
        },
      ),
      {
        params: Promise.resolve({
          applicationId: "app_supplement_required",
          batchId: "missing_batch",
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SUPPLEMENT_UPLOAD_BATCH_NOT_FOUND" },
    });
  });
});
