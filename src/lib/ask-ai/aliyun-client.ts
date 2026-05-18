import { getEnv } from "@/lib/env";
import { parseAliyunSseStream } from "@/lib/ask-ai/sse-parser";
import type { AskAiChatRequest, AskAiStreamEvent } from "@/lib/ask-ai/types";

export class AskAiProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "AskAiProviderError";
  }
}

export async function* streamAliyunAskAiResponse(
  request: AskAiChatRequest,
): AsyncGenerator<AskAiStreamEvent> {
  const env = getEnv();

  if (!env.ASK_AI_ALIYUN_API_KEY || !env.ASK_AI_ALIYUN_APP_ID) {
    throw new AskAiProviderError(
      "Ask AI live mode requires ASK_AI_ALIYUN_API_KEY and ASK_AI_ALIYUN_APP_ID.",
      "ask_ai_aliyun_config_missing",
      500,
    );
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    env.ASK_AI_TIMEOUT_MS,
  );
  const abortListener = () => timeoutController.abort();

  request.signal?.addEventListener("abort", abortListener, { once: true });

  try {
    const response = await fetch(
      `${env.ASK_AI_ALIYUN_BASE_URL.replace(/\/$/, "")}/api/v1/apps/${
        env.ASK_AI_ALIYUN_APP_ID
      }/completion`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.ASK_AI_ALIYUN_API_KEY}`,
          "Content-Type": "application/json",
          "X-DashScope-SSE": "enable",
        },
        body: JSON.stringify({
          input: {
            prompt: request.question,
            session_id: request.aliyunSessionId ?? undefined,
            biz_params: {
              applicationId: request.applicationId ?? undefined,
              page: request.pageName ?? undefined,
              locale: request.locale,
            },
          },
          parameters: {
            incremental_output: true,
          },
        }),
        signal: timeoutController.signal,
      },
    );

    if (!response.ok) {
      const details = await response.text();
      throw new AskAiProviderError(
        details || "Aliyun Bailian application request failed.",
        "ask_ai_aliyun_request_failed",
        response.status,
      );
    }

    if (!response.body) {
      throw new AskAiProviderError(
        "Aliyun Bailian application returned an empty stream.",
        "ask_ai_aliyun_empty_stream",
      );
    }

    yield* parseAliyunSseStream(response.body);
  } catch (error) {
    if (error instanceof AskAiProviderError) {
      throw error;
    }

    if (timeoutController.signal.aborted) {
      throw new AskAiProviderError(
        "Ask AI provider request timed out.",
        "ask_ai_aliyun_timeout",
        504,
      );
    }

    throw new AskAiProviderError(
      error instanceof Error
        ? error.message
        : "Ask AI provider request failed.",
      "ask_ai_aliyun_unavailable",
    );
  } finally {
    clearTimeout(timeout);
    request.signal?.removeEventListener("abort", abortListener);
  }
}
