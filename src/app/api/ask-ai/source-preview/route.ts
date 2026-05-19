import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  fetchSourcePreviewMarkdown,
  parseSourcePreviewToken,
  SourcePreviewError,
} from "@/lib/ask-ai/source-preview";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { jsonError, parseJsonBody } from "@/lib/http";

export const maxDuration = 30;

const sourcePreviewSchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(getSessionCookieName())?.value,
  );

  if (!session) {
    return jsonError("Source preview requires an active session.", 401, {
      code: "ask_ai_source_preview_unauthorized",
    });
  }

  const body = await parseJsonBody(request);
  const parsed = sourcePreviewSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The source preview payload is invalid.", 400, {
      code: "ask_ai_source_preview_invalid_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const preview = parseSourcePreviewToken(parsed.data.token);
    const markdown = await fetchSourcePreviewMarkdown(
      preview.url,
      request.signal,
    );

    return NextResponse.json({
      title: preview.title,
      markdown,
    });
  } catch (error) {
    if (error instanceof SourcePreviewError) {
      return jsonError(error.message, error.status, {
        code: error.code,
      });
    }

    return jsonError("The source preview could not be loaded.", 502, {
      code: "ask_ai_source_preview_failed",
    });
  }
}
