import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { NextRequest } from "next/server";
import { z } from "zod";

import { streamAskAiResponse } from "@/lib/ask-ai/client";
import { AskAiProviderError } from "@/lib/ask-ai/aliyun-client";
import {
  createPreviewSourceFromUrl,
  sanitizeAskAiMarkdown,
} from "@/lib/ask-ai/source-preview";
import {
  ensureAskAiChatSession,
  getAskAiAliyunSessionId,
  persistAskAiAnswer,
} from "@/lib/ask-ai/trace-service";
import type { AskAiProgress, AskAiSource } from "@/lib/ask-ai/types";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { jsonError, parseJsonBody } from "@/lib/http";
import { extractRequestTrackingContext } from "@/lib/tracking/context";

export const maxDuration = 60;

const chatRequestSchema = z.object({
  id: z.string().min(1).optional(),
  messages: z.array(z.unknown()).min(1),
  pageName: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The Ask AI chat payload is invalid.", 400, {
      code: "ask_ai_invalid_payload",
      details: parsed.error.flatten(),
    });
  }

  const messages = parsed.data.messages as UIMessage[];
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const question = latestUserMessage ? getMessageText(latestUserMessage) : "";
  const env = getEnv();

  if (!question.trim()) {
    return jsonError("Ask AI requires a user question.", 400, {
      code: "ask_ai_empty_question",
    });
  }

  if (question.length > env.ASK_AI_MAX_QUESTION_CHARS) {
    return jsonError("The Ask AI question is too long.", 400, {
      code: "ask_ai_question_too_long",
      max_chars: env.ASK_AI_MAX_QUESTION_CHARS,
    });
  }

  const trackingContext = extractRequestTrackingContext(request);
  const session = verifySessionToken(
    request.cookies.get(getSessionCookieName())?.value,
  );
  const chatSessionId = parsed.data.id ?? createId("askchat");
  const applicationId = session?.applicationId ?? null;
  const pageName = parsed.data.pageName ?? trackingContext.landingPath ?? null;
  const assistantMessageId = createId("askmsg");
  const textPartId = createId("asktext");
  const startedAt = Date.now();

  await ensureAskAiChatSession({
    chatSessionId,
    applicationId,
    pageName,
    sessionId: trackingContext.sessionId,
    requestId: trackingContext.requestId,
  });

  const aliyunSessionId = await getAskAiAliyunSessionId(chatSessionId);

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const sources: AskAiSource[] = [];
      let answer = "";
      let responseAliyunSessionId: string | null = null;
      let aliyunRequestId: string | null = null;
      let usage: Record<string, unknown> | null = null;
      let rawResponse: Record<string, unknown> | null = null;
      let wroteGeneratingProgress = false;
      let rawAnswer = "";

      writer.write({
        type: "start",
        messageId: assistantMessageId,
      });

      try {
        writer.write({
          type: "text-start",
          id: textPartId,
        });

        writeProgress(writer, {
          stage: "received",
          label: "已收到问题",
          source: "system",
        });

        for await (const event of streamAskAiResponse({
          chatSessionId,
          messages,
          question,
          aliyunSessionId,
          applicationId,
          pageName,
          locale: env.ASK_AI_DEFAULT_LOCALE,
          signal: request.signal,
        })) {
          if (event.type === "progress") {
            writeProgress(writer, event.progress);
            continue;
          }

          if (event.type === "source") {
            if (
              !sources.some(
                (source) => source.sourceId === event.source.sourceId,
              )
            ) {
              const preview = createPreviewSourceFromUrl(
                event.source.url,
                event.source.title,
              );
              const source = {
                ...event.source,
                previewToken: preview?.previewToken ?? null,
              };

              sources.push(source);

              if (source.previewToken) {
                writer.write({
                  type: "data-ask-ai-source",
                  data: {
                    sourceId: source.sourceId,
                    title: source.title,
                    previewToken: source.previewToken,
                  },
                });
              }
            }
            continue;
          }

          if (event.type === "text-delta") {
            if (!wroteGeneratingProgress) {
              writeProgress(writer, {
                stage: "generating",
                label: "正在生成回答",
                source: "system",
              });
              wroteGeneratingProgress = true;
            }

            rawAnswer += event.text;
            continue;
          }

          responseAliyunSessionId =
            event.aliyunSessionId ?? responseAliyunSessionId;
          aliyunRequestId = event.aliyunRequestId ?? aliyunRequestId;
          usage = event.usage ?? usage;
          rawResponse = event.rawResponse ?? rawResponse;
        }

        const sanitized = sanitizeAskAiMarkdown(rawAnswer);
        answer = sanitized.markdown;

        if (answer) {
          writer.write({
            type: "text-delta",
            id: textPartId,
            delta: answer,
          });
        }

        writer.write({
          type: "text-end",
          id: textPartId,
        });
        writer.write({
          type: "finish",
          finishReason: "stop",
        });

        await persistAskAiAnswer({
          chatSessionId,
          applicationId,
          pageName,
          sessionId: trackingContext.sessionId,
          requestId: trackingContext.requestId,
          userMessageId: latestUserMessage?.id ?? createId("askuser"),
          assistantMessageId,
          question,
          answer,
          sources,
          aliyunSessionId: responseAliyunSessionId,
          aliyunRequestId,
          latencyMs: Date.now() - startedAt,
          tokenUsage: usage,
          rawResponse,
        });
      } catch (error) {
        const providerError =
          error instanceof AskAiProviderError ? error : null;
        const message =
          error instanceof Error
            ? error.message
            : "Ask AI failed to generate an answer.";

        writer.write({
          type: "error",
          errorText: message,
        });
        writer.write({
          type: "finish",
          finishReason: "error",
        });

        await persistAskAiAnswer({
          chatSessionId,
          applicationId,
          pageName,
          sessionId: trackingContext.sessionId,
          requestId: trackingContext.requestId,
          userMessageId: latestUserMessage?.id ?? createId("askuser"),
          assistantMessageId,
          question,
          answer,
          sources,
          aliyunSessionId: responseAliyunSessionId,
          aliyunRequestId,
          latencyMs: Date.now() - startedAt,
          tokenUsage: usage,
          rawResponse,
          errorCode: providerError?.code ?? "ask_ai_generation_failed",
          errorMessage: message,
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function writeProgress(
  writer: UIMessageStreamWriter<UIMessage>,
  progress: AskAiProgress,
) {
  writer.write({
    type: "data-ask-ai-progress",
    id: "ask-ai-progress",
    data: progress,
    transient: true,
  });
}

function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
