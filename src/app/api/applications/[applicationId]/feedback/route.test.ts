import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import {
  GET as getFeedbackRoute,
  POST as saveFeedbackRoute,
  PUT as submitFeedbackRoute,
} from "@/app/api/applications/[applicationId]/feedback/route";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { getApplicationFeedbackByApplicationId } from "@/lib/data/store";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function buildAuthorizedRequest(url: string, init?: RequestInit) {
  const token = createSessionToken({
    applicationId: "app_submitted",
    invitationId: "invitation_submitted",
    expertId: "expert_submitted",
  });

  const headers = new Headers(init?.headers);
  headers.set("cookie", `${getSessionCookieName()}=${token}`);

  return new NextRequest(url, {
    method: init?.method,
    headers,
    body: init?.body,
    duplex: init?.body ? ("half" as const) : undefined,
  });
}

describe("application feedback route", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("returns the default draft snapshot when no feedback exists yet", async () => {
    const response = await getFeedbackRoute(
      buildAuthorizedRequest("http://localhost/api/applications/app_submitted/feedback"),
      {
        params: Promise.resolve({ applicationId: "app_submitted" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "DRAFT",
      rating: null,
      comment: "",
      draftSavedAt: null,
      submittedAt: null,
    });
  });

  it("saves a feedback draft", async () => {
    const response = await saveFeedbackRoute(
      buildAuthorizedRequest("http://localhost/api/applications/app_submitted/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-autohire-session-id": "sess_feedback_draft",
          "x-autohire-request-id": "req_feedback_draft",
        },
        body: JSON.stringify({
          rating: 4,
          comment: "Strong overall flow.",
          context: {
            currentUrl: "http://localhost/apply/submission-complete",
            pageTitle: "Submission complete",
            flowName: "submission flow",
            surface: "completion_page",
          },
        }),
      }),
      {
        params: Promise.resolve({ applicationId: "app_submitted" }),
      },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      status: "DRAFT",
      rating: 4,
      comment: "Strong overall flow.",
    });

    const feedback = await getApplicationFeedbackByApplicationId("app_submitted");
    expect(feedback).toMatchObject({
      status: "DRAFT",
      rating: 4,
      comment: "Strong overall flow.",
      contextData: {
        currentUrl: "http://localhost/apply/submission-complete",
        pageTitle: "Submission complete",
        flowName: "submission flow",
        surface: "completion_page",
      },
    });
  });

  it("submits feedback and rejects later updates", async () => {
    const submitResponse = await submitFeedbackRoute(
      buildAuthorizedRequest("http://localhost/api/applications/app_submitted/feedback", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-autohire-session-id": "sess_feedback_submit",
          "x-autohire-request-id": "req_feedback_submit",
        },
        body: JSON.stringify({
          comment: "Very polished experience.",
          context: {
            currentUrl: "http://localhost/apply/submission-complete",
            pageTitle: "Submission complete",
            flowStep: "feedback",
            surface: "completion_page",
          },
        }),
      }),
      {
        params: Promise.resolve({ applicationId: "app_submitted" }),
      },
    );

    expect(submitResponse.status).toBe(200);
    const submitPayload = await submitResponse.json();
    expect(submitPayload).toMatchObject({
      status: "SUBMITTED",
      rating: null,
      comment: "Very polished experience.",
    });

    const secondResponse = await saveFeedbackRoute(
      buildAuthorizedRequest("http://localhost/api/applications/app_submitted/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-autohire-session-id": "sess_feedback_second",
          "x-autohire-request-id": "req_feedback_second",
        },
        body: JSON.stringify({
          rating: 2,
        }),
      }),
      {
        params: Promise.resolve({ applicationId: "app_submitted" }),
      },
    );

    expect(secondResponse.status).toBe(409);
    await expect(secondResponse.json()).resolves.toMatchObject({
      code: "FEEDBACK_ALREADY_SUBMITTED",
    });

    const feedback = await getApplicationFeedbackByApplicationId("app_submitted");
    expect(feedback).toMatchObject({
      status: "SUBMITTED",
      rating: null,
      comment: "Very polished experience.",
      contextData: {
        currentUrl: "http://localhost/apply/submission-complete",
        pageTitle: "Submission complete",
        flowStep: "feedback",
        surface: "completion_page",
      },
    });
  });
});
