import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function streamFromText(text: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

async function loadClient(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    APP_RUNTIME_MODE: "memory",
    ASK_AI_MODE: "live",
    ...env,
  };

  return import("@/lib/ask-ai/aliyun-client");
}

describe("Aliyun Ask AI client", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("sends the expected Bailian streaming request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          streamFromText(
            'data: {"output":{"text":"ok","finish_reason":"stop","session_id":"sess_1"},"request_id":"req_1"}\n\n',
          ),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { streamAliyunAskAiResponse } = await loadClient({
      ASK_AI_ALIYUN_API_KEY: "test-key",
      ASK_AI_ALIYUN_APP_ID: "app_123",
      ASK_AI_ALIYUN_BASE_URL: "https://dashscope.aliyuncs.com",
    });

    const events = [];
    for await (const event of streamAliyunAskAiResponse({
      chatSessionId: "chat_1",
      messages: [],
      question: "How does AutoHire work?",
      aliyunSessionId: "sess_0",
      applicationId: "app_local",
      pageName: "apply",
      locale: "zh-CN",
    })) {
      events.push(event);
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "https://dashscope.aliyuncs.com/api/v1/apps/app_123/completion",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "X-DashScope-SSE": "enable",
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      input: {
        prompt: "How does AutoHire work?",
        session_id: "sess_0",
        biz_params: {
          applicationId: "app_local",
          page: "apply",
          locale: "zh-CN",
        },
      },
      parameters: { incremental_output: true },
    });
    expect(events).toContainEqual({ type: "text-delta", text: "ok" });
  });

  it("throws a config error in live mode without credentials", async () => {
    const { streamAliyunAskAiResponse, AskAiProviderError } = await loadClient({
      ASK_AI_ALIYUN_API_KEY: undefined,
      ASK_AI_ALIYUN_APP_ID: undefined,
    });

    await expect(async () => {
      for await (const event of streamAliyunAskAiResponse({
        chatSessionId: "chat_1",
        messages: [],
        question: "hello",
        locale: "zh-CN",
      })) {
        expect(event).toBeDefined();
      }
    }).rejects.toBeInstanceOf(AskAiProviderError);
  });
});
