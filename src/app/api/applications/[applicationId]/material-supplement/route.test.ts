import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
