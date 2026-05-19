import { describe, expect, it } from "vitest";

import { parseAliyunPayload, parseSseMessages } from "@/lib/ask-ai/sse-parser";

function streamFromText(text: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe("Ask AI SSE parser", () => {
  it("parses SSE messages with multiline data", async () => {
    const stream = streamFromText(
      'event: result\ndata: {"output":{"text":"hello"}}\n\n' +
        'data: {"output":{"text":"world"}}\n\n',
    );

    const messages = [];
    for await (const message of parseSseMessages(stream)) {
      messages.push(message);
    }

    expect(messages).toEqual([
      { event: "result", data: '{"output":{"text":"hello"}}' },
      { event: undefined, data: '{"output":{"text":"world"}}' },
    ]);
  });

  it("maps Aliyun text, references, session id, request id, and usage", () => {
    const events = parseAliyunPayload(
      JSON.stringify({
        request_id: "req_123",
        output: {
          text: "answer",
          session_id: "sess_123",
          finish_reason: "stop",
          references: [
            {
              id: "doc-1",
              title: "Guide",
              url: "https://example.com/guide",
              content: "Relevant chunk",
              score: 0.91,
            },
          ],
        },
        usage: { input_tokens: 3, output_tokens: 5 },
      }),
    );

    expect(events).toEqual([
      {
        type: "progress",
        progress: {
          stage: "generating",
          label: "正在生成回答",
          source: "aliyun",
        },
      },
      {
        type: "source",
        source: expect.objectContaining({
          sourceId: "doc-1",
          title: "Guide",
          score: 0.91,
        }),
      },
      { type: "text-delta", text: "answer" },
      {
        type: "finish",
        aliyunSessionId: "sess_123",
        aliyunRequestId: "req_123",
        usage: { input_tokens: 3, output_tokens: 5 },
        rawResponse: expect.any(Object),
      },
    ]);
  });

  it("maps Aliyun thoughts to safe progress without leaking node results", () => {
    const events = parseAliyunPayload(
      JSON.stringify({
        request_id: "req_456",
        output: {
          thoughts: [
            {
              response: JSON.stringify({
                nodeName: "Knowledge_1",
                nodeType: "KnowledgeRetrieval",
                nodeStatus: "executing",
                nodeExecTime: "25ms",
                nodeResult: "sensitive retrieved chunk",
              }),
            },
          ],
          session_id: "sess_456",
          finish_reason: "null",
        },
      }),
    );

    expect(events).toEqual([
      {
        type: "progress",
        progress: {
          stage: "retrieving",
          label: "正在检索知识库",
          source: "aliyun",
        },
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("sensitive retrieved chunk");
  });

  it("maps Aliyun text chunks to generating progress before text", () => {
    const events = parseAliyunPayload(
      JSON.stringify({
        request_id: "req_789",
        output: {
          text: "answer",
          session_id: "sess_789",
          finish_reason: "null",
        },
      }),
    );

    expect(events).toEqual([
      {
        type: "progress",
        progress: {
          stage: "generating",
          label: "正在生成回答",
          source: "aliyun",
        },
      },
      { type: "text-delta", text: "answer" },
    ]);
  });

  it("ignores invalid JSON payloads", () => {
    expect(parseAliyunPayload("not-json")).toEqual([]);
  });
});
