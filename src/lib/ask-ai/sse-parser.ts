import type { AskAiSource, AskAiStreamEvent } from "@/lib/ask-ai/types";

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

  for (const source of sources) {
    events.push({ type: "source", source });
  }

  const text = readString(output, "text") ?? readString(payload, "text");
  if (text) {
    events.push({ type: "text-delta", text });
  }

  const finishReason =
    readString(output, "finish_reason") ?? readString(payload, "finish_reason");
  if (finishReason) {
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
