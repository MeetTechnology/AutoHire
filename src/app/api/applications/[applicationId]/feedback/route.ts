import { NextRequest, NextResponse } from "next/server";

import {
  feedbackDraftSchema,
  feedbackSubmitSchema,
} from "@/features/application/schemas";
import {
  ApplicationServiceError,
  getApplicationFeedbackSnapshot,
  saveApplicationFeedbackDraft,
  submitApplicationFeedback,
} from "@/lib/application/service";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError, parseJsonBody } from "@/lib/http";
import { trackEventFromRequest } from "@/lib/tracking/service";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError(
      "The current session is not authorized to access this application.",
      403,
    );
  }

  try {
    const feedback = await getApplicationFeedbackSnapshot(applicationId);
    return NextResponse.json(feedback);
  } catch (error) {
    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    throw error;
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError(
      "The current session is not authorized to access this application.",
      403,
    );
  }

  const body = await parseJsonBody(request);
  const parsed = feedbackDraftSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The feedback draft payload is invalid.", 400, {
      details: parsed.error.flatten(),
    });
  }

  try {
    const feedback = await saveApplicationFeedbackDraft({
      applicationId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      context: parsed.data.context,
    });

    await trackEventFromRequest(request, {
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
    });

    return NextResponse.json(feedback);
  } catch (error) {
    await trackEventFromRequest(request, {
      eventType: "feedback_submit_failed",
      applicationId,
      pageName: "apply_submission_complete",
      stepName: "feedback",
      actionName: "button_click",
      eventStatus: "FAIL",
      errorCode:
        error instanceof ApplicationServiceError ? error.code : "feedback_draft_failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unable to save the feedback draft.",
    });

    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    throw error;
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError(
      "The current session is not authorized to access this application.",
      403,
    );
  }

  const body = await parseJsonBody(request);
  const parsed = feedbackSubmitSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The feedback payload is invalid.", 400, {
      details: parsed.error.flatten(),
    });
  }

  await trackEventFromRequest(request, {
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
  });

  try {
    const feedback = await submitApplicationFeedback({
      applicationId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      context: parsed.data.context,
    });

    await trackEventFromRequest(request, {
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
    });

    return NextResponse.json(feedback);
  } catch (error) {
    await trackEventFromRequest(request, {
      eventType: "feedback_submit_failed",
      applicationId,
      pageName: "apply_submission_complete",
      stepName: "feedback",
      actionName: "submit_confirm",
      eventStatus: "FAIL",
      errorCode:
        error instanceof ApplicationServiceError ? error.code : "feedback_submit_failed",
      errorMessage:
        error instanceof Error ? error.message : "Unable to submit feedback.",
    });

    if (error instanceof ApplicationServiceError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    throw error;
  }
}
