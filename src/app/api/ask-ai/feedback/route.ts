import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { saveAskAiFeedback } from "@/lib/ask-ai/trace-service";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { jsonError, parseJsonBody } from "@/lib/http";
import { extractRequestTrackingContext } from "@/lib/tracking/context";
import { trackEventFromRequest } from "@/lib/tracking/service";

const feedbackSchema = z.object({
  messageId: z.string().min(1),
  rating: z.enum(["UP", "DOWN"]),
  comment: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The Ask AI feedback payload is invalid.", 400, {
      code: "ask_ai_invalid_feedback",
      details: parsed.error.flatten(),
    });
  }

  const trackingContext = extractRequestTrackingContext(request);
  const session = verifySessionToken(
    request.cookies.get(getSessionCookieName())?.value,
  );
  const feedback = await saveAskAiFeedback({
    messageId: parsed.data.messageId,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
    applicationId: session?.applicationId ?? null,
    sessionId: trackingContext.sessionId,
    requestId: trackingContext.requestId,
  });

  if (!feedback) {
    return jsonError("The Ask AI message could not be found.", 404, {
      code: "ask_ai_message_not_found",
    });
  }

  if (session?.applicationId) {
    await trackEventFromRequest(request, {
      eventType: "ask_ai_feedback_submitted",
      applicationId: session.applicationId,
      pageName: null,
      stepName: "feedback",
      actionName: "button_click",
      eventStatus: "SUCCESS",
      payload: {
        message_id: parsed.data.messageId,
        rating: parsed.data.rating,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    rating: parsed.data.rating,
  });
}
