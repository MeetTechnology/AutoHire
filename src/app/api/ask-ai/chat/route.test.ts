import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/ask-ai/chat/route";

const originalEnv = { ...process.env };

describe("Ask AI chat route", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("rejects empty chat payloads", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/ask-ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [] }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "ask_ai_invalid_payload",
    });
  });

  it("streams a mock answer for a valid question", async () => {
    process.env = {
      ...originalEnv,
      APP_RUNTIME_MODE: "memory",
      ASK_AI_MODE: "mock",
    };

    const response = await POST(
      new NextRequest("http://localhost/api/ask-ai/chat", {
        method: "POST",
        body: JSON.stringify({
          id: "chat_route_test",
          messages: [
            {
              id: "user_route_test",
              role: "user",
              parts: [{ type: "text", text: "What is AutoHire?" }],
            },
          ],
          pageName: "apply",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const streamText = await response.text();

    expect(streamText).toContain("data-ask-ai-progress");
    expect(streamText).toContain("正在检索知识库");
    expect(streamText).toContain("data-ask-ai-source");
    expect(streamText).toContain("#ask-ai-preview:");
    expect(streamText).not.toContain("dashscope-file-datacenter");
    expect(streamText).not.toContain("Signature=secret");
    expect(streamText).toContain("AutoHire");
  });
});
