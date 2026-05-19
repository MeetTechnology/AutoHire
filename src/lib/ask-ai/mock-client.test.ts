import { describe, expect, it } from "vitest";

import { streamMockAskAiResponse } from "@/lib/ask-ai/mock-client";

describe("Ask AI mock client", () => {
  it("streams progress before sources, text, and finish", async () => {
    const events = [];

    for await (const event of streamMockAskAiResponse({
      chatSessionId: "chat_mock_test",
      messages: [],
      question: "What is AutoHire?",
      locale: "zh-CN",
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: "progress",
      progress: {
        stage: "retrieving",
        label: "正在检索知识库",
        source: "mock",
      },
    });
    expect(events.some((event) => event.type === "source")).toBe(true);
    expect(events.some((event) => event.type === "text-delta")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "finish" });
  });
});
