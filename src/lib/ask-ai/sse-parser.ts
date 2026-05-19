import type {
  AskAiProgress,
  AskAiProgressStage,
  AskAiSource,
  AskAiStreamEvent,
} from "@/lib/ask-ai/types";

type ParsedSseMessage = {
  event?: string;
  data: string;
};

export async function* parseSseMessages(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ParsedSseMessage> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const message = parseSseMessage(part);
      if (message) {
        yield message;
      }
    }
  }

  buffer += decoder.decode();
  const message = parseSseMessage(buffer);
  if (message) {
    yield message;
  }
}

export function parseSseMessage(input: string): ParsedSseMessage | null {
  const lines = input.split(/\r?\n/);
  const data: string[] = [];
  let event: string | undefined;

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trimStart());
    }
  }

  if (data.length === 0) {
    return null;
  }

  return {
    event,
    data: data.join("\n"),
  };
}

export function parseAliyunPayload(data: string): AskAiStreamEvent[] {
  if (data === "[DONE]") {
    return [{ type: "finish" }];
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return [];
  }

  const output = asRecord(payload.output);
  const events: AskAiStreamEvent[] = [];
  const sources = extractSources(payload);
  const text = readString(output, "text") ?? readString(payload, "text");

  for (const progress of extractProgress(output, Boolean(text))) {
    events.push({ type: "progress", progress });
  }

  for (const source of sources) {
    events.push({ type: "source", source });
  }

  if (text) {
    events.push({ type: "text-delta", text });
  }

  const finishReason =
    readString(output, "finish_reason") ?? readString(payload, "finish_reason");
  if (finishReason && finishReason.toLowerCase() !== "null") {
    events.push({
      type: "finish",
      aliyunSessionId: readString(output, "session_id"),
      aliyunRequestId: readString(payload, "request_id"),
      usage: asRecord(payload.usage),
      rawResponse: payload,
    });
  }

  return events;
}

export async function* parseAliyunSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<AskAiStreamEvent> {
  for await (const message of parseSseMessages(stream)) {
    for (const event of parseAliyunPayload(message.data)) {
      yield event;
    }
  }
}

function extractProgress(
  output: Record<string, unknown> | null,
  hasText: boolean,
): AskAiProgress[] {
  if (hasText) {
    return [progress("generating", "正在生成回答", "aliyun")];
  }

  const thought = asArray(output?.thoughts)
    .map((item) => parseThoughtResponse(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .at(-1);

  if (!thought) {
    return [];
  }

  const nodeType = readString(thought, "nodeType") ?? "";
  const nodeStatus = readString(thought, "nodeStatus") ?? "";
  const stage = mapThoughtToStage(nodeType, nodeStatus);

  return stage ? [progress(stage, progressLabels[stage], "aliyun")] : [];
}

function parseThoughtResponse(
  thought: unknown,
): Record<string, unknown> | null {
  const record = asRecord(thought);
  const response = readString(record, "response");

  if (!response) {
    return null;
  }

  try {
    const parsed = JSON.parse(response) as unknown;
    const parsedRecord = asRecord(parsed);

    if (!parsedRecord) {
      return null;
    }

    return {
      nodeName: readString(parsedRecord, "nodeName"),
      nodeType: readString(parsedRecord, "nodeType"),
      nodeStatus: readString(parsedRecord, "nodeStatus"),
      nodeExecTime: readString(parsedRecord, "nodeExecTime"),
    };
  } catch {
    return null;
  }
}

function mapThoughtToStage(
  nodeType: string,
  nodeStatus: string,
): AskAiProgressStage | null {
  const normalizedType = nodeType.toLowerCase();
  const normalizedStatus = nodeStatus.toLowerCase();

  if (normalizedStatus === "executing") {
    if (
      /rag|retrieval|retrieve|knowledge|search|plugin|tool|知识|检索|插件/.test(
        normalizedType,
      )
    ) {
      return "retrieving";
    }

    if (/llm|model|大模型/.test(normalizedType)) {
      return "reasoning";
    }

    return "reasoning";
  }

  if (normalizedStatus === "success") {
    return /end|output|结束|输出/.test(normalizedType)
      ? "finalizing"
      : "reasoning";
  }

  return null;
}

function progress(
  stage: AskAiProgressStage,
  label: string,
  source: AskAiProgress["source"],
): AskAiProgress {
  return { stage, label, source };
}

const progressLabels: Record<AskAiProgressStage, string> = {
  received: "已收到问题",
  retrieving: "正在检索知识库",
  reasoning: "正在分析申请上下文",
  generating: "正在生成回答",
  finalizing: "正在整理引用来源",
};

function extractSources(payload: Record<string, unknown>): AskAiSource[] {
  const output = asRecord(payload.output);
  const candidates = [
    asArray(output?.references),
    asArray(output?.doc_references),
    asArray(output?.retrieved_chunks),
    asArray(asRecord(output?.answer_reference)?.ItemList),
    asArray(asRecord(payload.AnswerReference)?.ItemList),
    asArray(asRecord(payload.answer_reference)?.ItemList),
  ].flat();

  const seen = new Set<string>();
  const sources: AskAiSource[] = [];

  candidates.forEach((item, index) => {
    const record = asRecord(item);
    if (!record) {
      return;
    }

    const referenceExt = asRecord(record.ReferenceExt);
    const sourceId =
      readString(record, "id") ??
      readString(record, "source_id") ??
      readString(record, "SourceId") ??
      `source-${index + 1}`;
    const title =
      readString(record, "title") ??
      readString(record, "Title") ??
      readString(record, "doc_name") ??
      readString(referenceExt, "DocName") ??
      `Source ${index + 1}`;

    if (seen.has(sourceId)) {
      return;
    }

    seen.add(sourceId);
    sources.push({
      sourceId,
      title,
      url:
        readString(record, "url") ??
        readString(record, "URL") ??
        readString(record, "DataSource") ??
        null,
      sectionTitle:
        readString(record, "section") ??
        readString(record, "Section") ??
        readString(record, "heading") ??
        null,
      chunkText:
        readString(record, "content") ??
        readString(record, "Content") ??
        readString(record, "text") ??
        null,
      score:
        readNumber(record, "score") ??
        readNumber(record, "Score") ??
        readNumber(record, "similarity") ??
        null,
      rank: readNumber(record, "rank") ?? index + 1,
      metadata: record,
    });
  });

  return sources;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
