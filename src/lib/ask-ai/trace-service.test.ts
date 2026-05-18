import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadTraceService() {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    APP_RUNTIME_MODE: "memory",
    ASK_AI_MODE: "mock",
  };
  (
    globalThis as typeof globalThis & { __autohireAskAiStore?: unknown }
  ).__autohireAskAiStore = undefined;

  return import("@/lib/ask-ai/trace-service");
}

describe("Ask AI trace service", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("persists answers, retrieved chunks, feedback, and cleared sessions in memory mode", async () => {
    const {
      persistAskAiAnswer,
      saveAskAiFeedback,
      clearAskAiChatSession,
      getAskAiAliyunSessionId,
    } = await loadTraceService();

    await persistAskAiAnswer({
      chatSessionId: "chat_1",
      applicationId: "app_1",
      pageName: "apply",
      sessionId: "session_1",
      requestId: "request_1",
      userMessageId: "user_ui_1",
      assistantMessageId: "assistant_ui_1",
      question: "What should I upload?",
      answer: "Upload supporting materials.",
      sources: [
        {
          sourceId: "source_1",
          title: "Materials guide",
          url: "/apply/materials",
          chunkText: "Materials are grouped by category.",
          score: 0.88,
          rank: 1,
        },
      ],
      aliyunSessionId: "aliyun_session_1",
      aliyunRequestId: "aliyun_request_1",
      latencyMs: 123,
      tokenUsage: { input_tokens: 4 },
    });

    expect(await getAskAiAliyunSessionId("chat_1")).toBe("aliyun_session_1");
    expect(
      await saveAskAiFeedback({
        messageId: "assistant_ui_1",
        rating: "UP",
        applicationId: "app_1",
        sessionId: "session_1",
        requestId: "request_2",
      }),
    ).toMatchObject({ rating: "UP" });

    await clearAskAiChatSession({
      chatSessionId: "chat_1",
      applicationId: "app_1",
      pageName: "apply",
    });

    const store = (
      globalThis as typeof globalThis & {
        __autohireAskAiStore?: {
          sessions: Array<{ status: string }>;
          messages: unknown[];
          chunks: unknown[];
          feedback: unknown[];
        };
      }
    ).__autohireAskAiStore;

    expect(store?.sessions[0]?.status).toBe("CLEARED");
    expect(store?.messages).toHaveLength(2);
    expect(store?.chunks).toHaveLength(1);
    expect(store?.feedback).toHaveLength(1);
  });
});
