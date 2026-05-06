import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchApplicationFeedbackAction,
  saveFeedbackDraftAction,
  submitApplicationAction,
  submitFeedbackAction,
} from "@/features/application/actions";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { updateApplication } from "@/lib/data/store";
import { getApplicationFeedbackByApplicationId } from "@/lib/data/store";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function buildSessionCookie(applicationId = "app_submitted") {
  const token = createSessionToken({
    applicationId,
    invitationId: "invitation_submitted",
    expertId: "expert_submitted",
  });
  return `${getSessionCookieName()}=${token}`;
}

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

const { cookies, headers } = await import("next/headers");

describe("application server actions", () => {
  beforeEach(() => {
    resetMemoryStore();
    vi.mocked(cookies).mockReset();
    vi.mocked(headers).mockReset();
  });

  function mockAuthorizedSession(applicationId = "app_submitted") {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: buildSessionCookie(applicationId).split("=")[1] }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        "x-autohire-session-id": "sess_test",
        "x-autohire-request-id": "req_test",
      }),
    );
  }

  function mockUnauthorizedSession() {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    vi.mocked(headers).mockResolvedValue(new Headers());
  }

  describe("submitApplicationAction", () => {
    it("rejects unauthenticated requests", async () => {
      mockUnauthorizedSession();

      await expect(
        submitApplicationAction("app_submitted"),
      ).rejects.toThrow("not authorized");
    });

    it("rejects submission when required materials are missing", async () => {
      mockAuthorizedSession();
      await updateApplication("app_submitted", {
        applicationStatus: "MATERIALS_IN_PROGRESS",
      });

      await expect(
        submitApplicationAction("app_submitted"),
      ).rejects.toThrow("Final submission requires at least one file");
    });
  });

  describe("fetchApplicationFeedbackAction", () => {
    it("returns the default draft snapshot when no feedback exists yet", async () => {
      mockAuthorizedSession();

      const feedback = await fetchApplicationFeedbackAction("app_submitted");

      expect(feedback).toEqual({
        status: "DRAFT",
        rating: null,
        comment: "",
        draftSavedAt: null,
        submittedAt: null,
      });
    });

    it("rejects unauthenticated requests", async () => {
      mockUnauthorizedSession();

      await expect(
        fetchApplicationFeedbackAction("app_submitted"),
      ).rejects.toThrow("not authorized");
    });
  });

  describe("saveFeedbackDraftAction", () => {
    it("saves a feedback draft", async () => {
      mockAuthorizedSession();

      const feedback = await saveFeedbackDraftAction("app_submitted", {
        rating: 4,
        comment: "Strong overall flow.",
        context: {
          currentUrl: "http://localhost/apply/submission-complete",
          pageTitle: "Submission complete",
          flowName: "submission flow",
          surface: "completion_page",
        },
      });

      expect(feedback).toMatchObject({
        status: "DRAFT",
        rating: 4,
        comment: "Strong overall flow.",
      });

      const stored = await getApplicationFeedbackByApplicationId("app_submitted");
      expect(stored).toMatchObject({
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
  });

  describe("submitFeedbackAction", () => {
    it("submits feedback and rejects later updates", async () => {
      mockAuthorizedSession();

      const submitResult = await submitFeedbackAction("app_submitted", {
        comment: "Very polished experience.",
        context: {
          currentUrl: "http://localhost/apply/submission-complete",
          pageTitle: "Submission complete",
          flowStep: "feedback",
          surface: "completion_page",
        },
      });

      expect(submitResult).toMatchObject({
        status: "SUBMITTED",
        rating: null,
        comment: "Very polished experience.",
      });

      await expect(
        saveFeedbackDraftAction("app_submitted", {
          rating: 2,
        }),
      ).rejects.toThrow("Feedback has already been submitted and can no longer be edited.");

      const stored = await getApplicationFeedbackByApplicationId("app_submitted");
      expect(stored).toMatchObject({
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

    it("rejects empty feedback submission", async () => {
      mockAuthorizedSession();

      await expect(
        submitFeedbackAction("app_submitted", {
          comment: "   ",
        }),
      ).rejects.toThrow("The feedback payload is invalid.");
    });
  });
});
