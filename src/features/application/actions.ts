"use server";

import {
  feedbackDraftSchema,
  feedbackSubmitSchema,
} from "@/features/application/schemas";
import type { ApplicationFeedbackContext } from "@/features/application/types";
import {
  ApplicationServiceError,
  getApplicationFeedbackSnapshot,
  saveApplicationFeedbackDraft,
  submitApplication,
  submitApplicationFeedback,
} from "@/lib/application/service";
import { requireApplicationSessionFromAction } from "@/lib/auth/server-action";
import { trackEventFromServerAction } from "@/lib/tracking/server-action";

function handleServiceError(error: unknown): never {
  if (error instanceof ApplicationServiceError) {
    const err = new Error(error.message);
    (err as Error & { code?: string }).code = error.code;
    throw err;
  }
  throw error;
}

export async function submitApplicationAction(
  applicationId: string,
  trackingSessionId?: string,
) {
  const access = await requireApplicationSessionFromAction(applicationId);

  if (!access) {
    throw new Error(
      "The current session is not authorized to access this application.",
    );
  }

  try {
    const application = await submitApplication(applicationId);

    if (!application) {
      throw new Error("The application could not be found.");
    }

    await trackEventFromServerAction({
      eventType: "application_submitted",
      applicationId,
      pageName: "apply_materials",
      stepName: "submit",
      actionName: "submit_confirm",
      eventStatus: "SUCCESS",
      sessionId: trackingSessionId,
    });

    return {
      applicationId,
      applicationStatus: application.applicationStatus,
      message:
        "We have received your materials and will respond within 1 to 3 business days.",
    };
  } catch (error) {
    await trackEventFromServerAction({
      eventType: "application_submit_failed",
      applicationId,
      pageName: "apply_materials",
      stepName: "submit",
      actionName: "submit_confirm",
      eventStatus: "FAIL",
      errorCode:
        error instanceof ApplicationServiceError
          ? error.code
          : "submit_failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Application submit failed.",
      sessionId: trackingSessionId,
    });
    handleServiceError(error);
  }
}

export async function fetchApplicationFeedbackAction(
  applicationId: string,
) {
  const access = await requireApplicationSessionFromAction(applicationId);

  if (!access) {
    throw new Error(
      "The current session is not authorized to access this application.",
    );
  }

  try {
    return await getApplicationFeedbackSnapshot(applicationId);
  } catch (error) {
    handleServiceError(error);
  }
}

export async function saveFeedbackDraftAction(
  applicationId: string,
  input: {
    rating?: number | null;
    comment?: string;
    context?: ApplicationFeedbackContext;
  },
  trackingSessionId?: string,
) {
  const access = await requireApplicationSessionFromAction(applicationId);

  if (!access) {
    throw new Error(
      "The current session is not authorized to access this application.",
    );
  }

  const parsed = feedbackDraftSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("The feedback draft payload is invalid.");
  }

  try {
    const feedback = await saveApplicationFeedbackDraft({
      applicationId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      context: parsed.data.context,
    });

    await trackEventFromServerAction({
      eventType: "feedback_draft_saved",
      applicationId,
      pageName: "apply_submission_complete",
      stepName: "feedback",
      actionName: "button_click",
      eventStatus: "SUCCESS",
      payload: {
        rating: feedback.rating,
        hasComment: feedback.comment.length > 0,
        status: feedback.status,
        surface: parsed.data.context?.surface ?? null,
      },
      sessionId: trackingSessionId,
    });

    return feedback;
  } catch (error) {
    await trackEventFromServerAction({
      eventType: "feedback_submit_failed",
      applicationId,
      pageName: "apply_submission_complete",
      stepName: "feedback",
      actionName: "button_click",
      eventStatus: "FAIL",
      errorCode:
        error instanceof ApplicationServiceError
          ? error.code
          : "feedback_draft_failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unable to save the feedback draft.",
      sessionId: trackingSessionId,
    });
    handleServiceError(error);
  }
}

export async function submitFeedbackAction(
  applicationId: string,
  input: {
    rating?: number | null;
    comment?: string;
    context?: ApplicationFeedbackContext;
  },
  trackingSessionId?: string,
) {
  const access = await requireApplicationSessionFromAction(applicationId);

  if (!access) {
    throw new Error(
      "The current session is not authorized to access this application.",
    );
  }

  const parsed = feedbackSubmitSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("The feedback payload is invalid.");
  }

  await trackEventFromServerAction({
    eventType: "feedback_submit_clicked",
    applicationId,
    pageName: "apply_submission_complete",
    stepName: "feedback",
    actionName: "submit_confirm",
    eventStatus: "SUCCESS",
    payload: {
      rating: parsed.data.rating,
      hasComment: (parsed.data.comment ?? "").length > 0,
      surface: parsed.data.context?.surface ?? null,
    },
    sessionId: trackingSessionId,
  });

  try {
    const feedback = await submitApplicationFeedback({
      applicationId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      context: parsed.data.context,
    });

    await trackEventFromServerAction({
      eventType: "feedback_submitted",
      applicationId,
      pageName: "apply_submission_complete",
      stepName: "feedback",
      actionName: "submit_confirm",
      eventStatus: "SUCCESS",
      payload: {
        rating: feedback.rating,
        hasComment: feedback.comment.length > 0,
        status: feedback.status,
        surface: parsed.data.context?.surface ?? null,
      },
      sessionId: trackingSessionId,
    });

    return feedback;
  } catch (error) {
    await trackEventFromServerAction({
      eventType: "feedback_submit_failed",
      applicationId,
      pageName: "apply_submission_complete",
      stepName: "feedback",
      actionName: "submit_confirm",
      eventStatus: "FAIL",
      errorCode:
        error instanceof ApplicationServiceError
          ? error.code
          : "feedback_submit_failed",
      errorMessage:
        error instanceof Error ? error.message : "Unable to submit feedback.",
      sessionId: trackingSessionId,
    });
    handleServiceError(error);
  }
}
