import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { clearAskAiChatSession } from "@/lib/ask-ai/trace-service";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { jsonError, parseJsonBody } from "@/lib/http";
import { extractRequestTrackingContext } from "@/lib/tracking/context";

const clearSchema = z.object({
  chatSessionId: z.string().min(1),
  pageName: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  const parsed = clearSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The Ask AI clear payload is invalid.", 400, {
      code: "ask_ai_invalid_clear_payload",
      details: parsed.error.flatten(),
    });
  }

  const trackingContext = extractRequestTrackingContext(request);
  const session = verifySessionToken(
    request.cookies.get(getSessionCookieName())?.value,
  );

  await clearAskAiChatSession({
    chatSessionId: parsed.data.chatSessionId,
    applicationId: session?.applicationId ?? null,
    pageName: parsed.data.pageName ?? trackingContext.landingPath ?? null,
    sessionId: trackingContext.sessionId,
    requestId: trackingContext.requestId,
  });

  return NextResponse.json({ ok: true });
}
