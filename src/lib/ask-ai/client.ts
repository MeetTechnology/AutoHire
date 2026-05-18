import { streamAliyunAskAiResponse } from "@/lib/ask-ai/aliyun-client";
import { streamMockAskAiResponse } from "@/lib/ask-ai/mock-client";
import type { AskAiChatRequest } from "@/lib/ask-ai/types";
import { getEnv } from "@/lib/env";

export function streamAskAiResponse(request: AskAiChatRequest) {
  return getEnv().ASK_AI_MODE === "live"
    ? streamAliyunAskAiResponse(request)
    : streamMockAskAiResponse(request);
}
