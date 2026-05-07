import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET as getSnapshotRoute } from "@/app/api/applications/[applicationId]/material-supplement/route";
import { GET as getHistoryRoute } from "@/app/api/applications/[applicationId]/material-supplement/history/route";
import { GET as getSummaryRoute } from "@/app/api/applications/[applicationId]/material-supplement/summary/route";
import { POST as postInitialRoute } from "@/app/api/applications/[applicationId]/material-supplement/reviews/initial/route";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import {
  getMaterialReviewRunByApplicationAndRunNo,
  listMaterialReviewRuns,
  updateApplication,
} from "@/lib/data/store";
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

describe("material supplement routes", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_RUNTIME_MODE: "memory",
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
      remainingReviewRounds: 1,
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
        remainingReviewRounds: 1,
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
      payload.items.every((item: { category: string }) => item.category === "IDENTITY"),
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

    vi.spyOn(materialReviewClient, "createInitialMaterialReview").mockRejectedValue(
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
});
