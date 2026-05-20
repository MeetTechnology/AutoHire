import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/ask-ai/history/route";
import { persistAskAiAnswer } from "@/lib/ask-ai/trace-service";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { resetEnvForTests } from "@/lib/env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  resetEnvForTests();
  (
    globalThis as typeof globalThis & { __autohireAskAiStore?: unknown }
  ).__autohireAskAiStore = undefined;
  vi.restoreAllMocks();
});

describe("Ask AI history route", () => {
  it("requires an active session", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/ask-ai/history"),
    );

    expect(response.status).toBe(401);
  });

  it("returns the current application's recent question history", async () => {
    process.env = {
      ...originalEnv,
      APP_RUNTIME_MODE: "memory",
      ASK_AI_MODE: "mock",
    };
    resetEnvForTests();

    await persistAskAiAnswer({
      chatSessionId: "chat_history_1",
      applicationId: "app_history_1",
      userMessageId: "user_history_1",
      assistantMessageId: "assistant_history_1",
      question: "What documents should I prepare?",
      answer: "Prepare identity and employment materials.",
      sources: [
        {
          sourceId: "source_history_1",
          title: "Application Flow",
          url: "https://dashscope-file-datacenter-prod-01.oss-cn-beijing.aliyuncs.com/189/106/application-flow.md?Expires=1779353502&OSSAccessKeyId=test&Signature=secret",
          rank: 1,
        },
      ],
    });
    await persistAskAiAnswer({
      chatSessionId: "chat_history_2",
      applicationId: "app_other",
      userMessageId: "user_history_2",
      assistantMessageId: "assistant_history_2",
      question: "Should not appear",
      answer: "No.",
      sources: [],
    });

    const response = await GET(createHistoryRequest("app_history_1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        {
          userMessageId: "user_history_1",
          assistantMessageId: "assistant_history_1",
          question: "What documents should I prepare?",
          answer: "Prepare identity and employment materials.",
          sources: [
            {
              sourceId: "source_history_1",
              title: "Application Flow",
            },
          ],
        },
      ],
    });
  });
});

function createHistoryRequest(applicationId: string) {
  const cookie = `${getSessionCookieName()}=${createSessionToken({
    invitationId: "invite_history",
    applicationId,
    expertId: "expert_history",
  })}`;

  return new NextRequest("http://localhost/api/ask-ai/history?limit=20", {
    headers: {
      cookie,
    },
  });
}
