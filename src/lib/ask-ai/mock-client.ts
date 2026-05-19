import type { AskAiChatRequest, AskAiStreamEvent } from "@/lib/ask-ai/types";

const MOCK_SOURCES = [
  {
    sourceId: "autohire-application-flow",
    title: "AutoHire Application Flow",
    url: "/apply",
    sectionTitle: "Expert application process",
    chunkText:
      "AutoHire guides experts through invitation access, resume review, supplemental information, materials upload, and final submission.",
    score: 0.92,
    rank: 1,
    metadata: {
      provider: "mock",
      collection: "autohire-docs",
    },
  },
  {
    sourceId: "autohire-materials",
    title: "Supporting Materials Guide",
    url: "/apply/materials",
    sectionTitle: "Materials",
    chunkText:
      "Experts upload identity, employment, education, honor, patent, project, paper, book, conference, and product documents by category.",
    score: 0.86,
    rank: 2,
    metadata: {
      provider: "mock",
      collection: "autohire-docs",
    },
  },
];

export async function* streamMockAskAiResponse(
  request: AskAiChatRequest,
): AsyncGenerator<AskAiStreamEvent> {
  yield {
    type: "progress",
    progress: {
      stage: "retrieving",
      label: "正在检索知识库",
      source: "mock",
    },
  };

  for (const source of MOCK_SOURCES) {
    yield { type: "source", source };
  }

  const answer = [
    `我已根据 AutoHire 企业知识库检索到与你的问题相关的材料。`,
    ``,
    `你的问题是：“${request.question}”`,
    ``,
    `在当前申请流程中，Ask AI 会优先依据项目文档和流程说明回答；如果知识库没有足够依据，它应该明确说明无法确认，而不是编造答案。`,
  ].join("\n");

  for (const token of chunkText(answer, 18)) {
    await delay(10);
    yield { type: "text-delta", text: token };
  }

  yield {
    type: "finish",
    aliyunSessionId:
      request.aliyunSessionId ?? `mock_${request.chatSessionId.slice(0, 12)}`,
    aliyunRequestId: `mock_req_${Date.now()}`,
    usage: {
      input_tokens: request.question.length,
      output_tokens: answer.length,
    },
    rawResponse: {
      mode: "mock",
      sources: MOCK_SOURCES,
    },
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(value: string, size: number) {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }

  return chunks.length > 0 ? chunks : [value];
}
