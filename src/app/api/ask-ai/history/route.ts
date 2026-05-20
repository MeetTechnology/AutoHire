import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listAskAiHistory } from "@/lib/ask-ai/trace-service";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(20).default(20),
});

export async function GET(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(getSessionCookieName())?.value,
  );

  if (!session) {
    return jsonError("Ask AI history requires an active session.", 401, {
      code: "ask_ai_history_unauthorized",
    });
  }

  const parsed = historyQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return jsonError("The Ask AI history query is invalid.", 400, {
      code: "ask_ai_history_invalid_query",
      details: parsed.error.flatten(),
    });
  }

  const items = await listAskAiHistory({
    applicationId: session.applicationId,
    limit: parsed.data.limit,
  });

  return NextResponse.json({ items });
}
