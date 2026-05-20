import { Prisma } from "@prisma/client";

import { getEnv, getRuntimeMode } from "@/lib/env";
import type {
  AskAiFeedbackRating,
  AskAiHistoryItem,
  AskAiPersistAnswerInput,
  AskAiSource,
  AskAiTraceContext,
} from "@/lib/ask-ai/types";
import { createPreviewSourceFromUrl } from "@/lib/ask-ai/source-preview";

type MemoryChatSession = {
  id: string;
  applicationId: string | null;
  aliyunSessionId: string | null;
  status: "ACTIVE" | "CLEARED";
  startedAt: Date;
  lastMessageAt: Date | null;
  clearedAt: Date | null;
  pageName: string | null;
  sessionId: string | null;
  requestId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MemoryChatMessage = {
  id: string;
  chatSessionId: string;
  role: string;
  content: string;
  uiMessageId: string | null;
  aliyunRequestId: string | null;
  latencyMs: number | null;
  tokenUsage: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  rawResponse: Record<string, unknown> | null;
  createdAt: Date;
};

type MemoryRetrievedChunk = AskAiSource & {
  id: string;
  messageId: string;
  createdAt: Date;
};

type MemoryFeedback = {
  id: string;
  messageId: string;
  rating: AskAiFeedbackRating;
  comment: string | null;
  applicationId: string | null;
  sessionId: string | null;
  requestId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AskAiMemoryStore = {
  sessions: MemoryChatSession[];
  messages: MemoryChatMessage[];
  chunks: MemoryRetrievedChunk[];
  feedback: MemoryFeedback[];
};

declare global {
  var __autohireAskAiStore: AskAiMemoryStore | undefined;
}

function getMemoryStore() {
  globalThis.__autohireAskAiStore ??= {
    sessions: [],
    messages: [],
    chunks: [],
    feedback: [],
  };

  return globalThis.__autohireAskAiStore;
}

async function getPrisma() {
  const { prisma } = await import("@/lib/db/prisma");

  return prisma;
}

export async function ensureAskAiChatSession(input: AskAiTraceContext) {
  const now = new Date();

  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    let session = store.sessions.find(
      (item) => item.id === input.chatSessionId,
    );

    if (!session) {
      session = {
        id: input.chatSessionId,
        applicationId: input.applicationId ?? null,
        aliyunSessionId: null,
        status: "ACTIVE",
        startedAt: now,
        lastMessageAt: null,
        clearedAt: null,
        pageName: input.pageName ?? null,
        sessionId: input.sessionId ?? null,
        requestId: input.requestId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.sessions.push(session);
    } else {
      Object.assign(session, {
        applicationId: input.applicationId ?? session.applicationId,
        pageName: input.pageName ?? session.pageName,
        sessionId: input.sessionId ?? session.sessionId,
        requestId: input.requestId ?? session.requestId,
        status: "ACTIVE",
        clearedAt: null,
        updatedAt: now,
      });
    }

    return session;
  }

  const prisma = await getPrisma();
  return prisma.askAiChatSession.upsert({
    where: { id: input.chatSessionId },
    update: {
      applicationId: input.applicationId ?? undefined,
      pageName: input.pageName ?? undefined,
      sessionId: input.sessionId ?? undefined,
      requestId: input.requestId ?? undefined,
      status: "ACTIVE",
      clearedAt: null,
    },
    create: {
      id: input.chatSessionId,
      applicationId: input.applicationId ?? null,
      pageName: input.pageName ?? null,
      sessionId: input.sessionId ?? null,
      requestId: input.requestId ?? null,
    },
  });
}

export async function getAskAiAliyunSessionId(chatSessionId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().sessions.find((item) => item.id === chatSessionId)
        ?.aliyunSessionId ?? null
    );
  }

  const prisma = await getPrisma();
  const session = await prisma.askAiChatSession.findUnique({
    where: { id: chatSessionId },
    select: { aliyunSessionId: true },
  });

  return session?.aliyunSessionId ?? null;
}

export async function persistAskAiAnswer(input: AskAiPersistAnswerInput) {
  const now = new Date();
  await ensureAskAiChatSession(input);

  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const session = store.sessions.find(
      (item) => item.id === input.chatSessionId,
    );

    if (session) {
      Object.assign(session, {
        aliyunSessionId: input.aliyunSessionId ?? session.aliyunSessionId,
        lastMessageAt: now,
        updatedAt: now,
      });
    }

    store.messages.push({
      id: createPairedUserMessageId(input.assistantMessageId),
      chatSessionId: input.chatSessionId,
      role: "user",
      content: input.question,
      uiMessageId: input.userMessageId,
      aliyunRequestId: null,
      latencyMs: null,
      tokenUsage: null,
      errorCode: null,
      errorMessage: null,
      rawResponse: null,
      createdAt: now,
    });
    store.messages.push({
      id: input.assistantMessageId,
      chatSessionId: input.chatSessionId,
      role: "assistant",
      content: input.answer,
      uiMessageId: input.assistantMessageId,
      aliyunRequestId: input.aliyunRequestId ?? null,
      latencyMs: input.latencyMs ?? null,
      tokenUsage: input.tokenUsage ?? null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      rawResponse: getEnv().ASK_AI_TRACE_RAW_RESPONSE
        ? (input.rawResponse ?? null)
        : null,
      createdAt: now,
    });

    input.sources.forEach((source, index) => {
      store.chunks.push({
        ...source,
        id: createId("askchunk"),
        messageId: input.assistantMessageId,
        rank: source.rank ?? index + 1,
        createdAt: now,
      });
    });

    return;
  }

  const prisma = await getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.askAiChatSession.update({
      where: { id: input.chatSessionId },
      data: {
        aliyunSessionId: input.aliyunSessionId ?? undefined,
        lastMessageAt: now,
      },
    });
    await tx.askAiChatMessage.create({
      data: {
        id: createPairedUserMessageId(input.assistantMessageId),
        chatSessionId: input.chatSessionId,
        role: "user",
        content: input.question,
        uiMessageId: input.userMessageId,
      },
    });
    await tx.askAiChatMessage.create({
      data: {
        id: input.assistantMessageId,
        chatSessionId: input.chatSessionId,
        role: "assistant",
        content: input.answer,
        uiMessageId: input.assistantMessageId,
        aliyunRequestId: input.aliyunRequestId ?? null,
        latencyMs: input.latencyMs ?? null,
        tokenUsage: toJson(input.tokenUsage),
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        rawResponse: getEnv().ASK_AI_TRACE_RAW_RESPONSE
          ? toJson(input.rawResponse)
          : Prisma.JsonNull,
        retrievedChunks: {
          create: input.sources.map((source, index) => ({
            sourceId: source.sourceId,
            documentTitle: source.title,
            documentUrl: source.url ?? null,
            sectionTitle: source.sectionTitle ?? null,
            chunkText: source.chunkText ?? null,
            score: source.score ?? null,
            rank: source.rank ?? index + 1,
            metadata: toJson(source.metadata),
          })),
        },
      },
    });
  });
}

export async function saveAskAiFeedback(input: {
  messageId: string;
  rating: AskAiFeedbackRating;
  comment?: string | null;
  applicationId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
}) {
  const now = new Date();

  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const message = store.messages.find((item) => item.id === input.messageId);

    if (!message) {
      return null;
    }

    let feedback = store.feedback.find(
      (item) => item.messageId === input.messageId,
    );

    if (!feedback) {
      feedback = {
        id: createId("askfeedback"),
        messageId: input.messageId,
        rating: input.rating,
        comment: input.comment ?? null,
        applicationId: input.applicationId ?? null,
        sessionId: input.sessionId ?? null,
        requestId: input.requestId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.feedback.push(feedback);
    } else {
      Object.assign(feedback, {
        rating: input.rating,
        comment: input.comment ?? feedback.comment,
        applicationId: input.applicationId ?? feedback.applicationId,
        sessionId: input.sessionId ?? feedback.sessionId,
        requestId: input.requestId ?? feedback.requestId,
        updatedAt: now,
      });
    }

    return feedback;
  }

  const prisma = await getPrisma();
  const message = await prisma.askAiChatMessage.findUnique({
    where: { id: input.messageId },
  });

  if (!message) {
    return null;
  }

  return prisma.askAiMessageFeedback.upsert({
    where: { messageId: input.messageId },
    update: {
      rating: input.rating,
      comment: input.comment ?? undefined,
      applicationId: input.applicationId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      requestId: input.requestId ?? undefined,
    },
    create: {
      messageId: input.messageId,
      rating: input.rating,
      comment: input.comment ?? null,
      applicationId: input.applicationId ?? null,
      sessionId: input.sessionId ?? null,
      requestId: input.requestId ?? null,
    },
  });
}

export async function clearAskAiChatSession(input: AskAiTraceContext) {
  const now = new Date();
  await ensureAskAiChatSession(input);

  if (getRuntimeMode() === "memory") {
    const session = getMemoryStore().sessions.find(
      (item) => item.id === input.chatSessionId,
    );

    if (session) {
      Object.assign(session, {
        status: "CLEARED",
        clearedAt: now,
        updatedAt: now,
      });
    }

    return session;
  }

  const prisma = await getPrisma();
  return prisma.askAiChatSession.update({
    where: { id: input.chatSessionId },
    data: {
      status: "CLEARED",
      clearedAt: now,
    },
  });
}

export async function listAskAiHistory(input: {
  applicationId: string;
  limit?: number;
}): Promise<AskAiHistoryItem[]> {
  const limit = clampHistoryLimit(input.limit);

  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const sessionIds = new Set(
      store.sessions
        .filter((session) => session.applicationId === input.applicationId)
        .map((session) => session.id),
    );
    const messages = store.messages.filter((message) =>
      sessionIds.has(message.chatSessionId),
    );

    return buildHistoryItems({
      messages,
      getChunks: (messageId) =>
        store.chunks.filter((chunk) => chunk.messageId === messageId),
      limit,
    });
  }

  const prisma = await getPrisma();
  const messages = await prisma.askAiChatMessage.findMany({
    where: {
      role: { in: ["user", "assistant"] },
      chatSession: {
        applicationId: input.applicationId,
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(limit * 8, 80),
    include: {
      retrievedChunks: {
        orderBy: { rank: "asc" },
      },
    },
  });
  const chunksByMessageId = new Map(
    messages.map((message) => [message.id, message.retrievedChunks]),
  );

  return buildHistoryItems({
    messages,
    getChunks: (messageId) => chunksByMessageId.get(messageId) ?? [],
    limit,
  });
}

function toJson(value: Record<string, unknown> | null | undefined) {
  return value === undefined || value === null
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function createPairedUserMessageId(assistantMessageId: string) {
  return `${assistantMessageId}_user`;
}

function getRoleSortWeight(role: string) {
  return role === "user" ? 0 : 1;
}

function clampHistoryLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 20);
}

function buildHistoryItems({
  messages,
  getChunks,
  limit,
}: {
  messages: Array<{
    id: string;
    chatSessionId: string;
    role: string;
    content: string;
    uiMessageId: string | null;
    errorCode: string | null;
    createdAt: Date;
  }>;
  getChunks: (messageId: string) => Array<{
    sourceId?: string | null;
    documentTitle?: string | null;
    title?: string | null;
    documentUrl?: string | null;
    url?: string | null;
    rank?: number | null;
  }>;
  limit: number;
}) {
  const bySession = new Map<string, typeof messages>();

  for (const message of messages) {
    const sessionMessages = bySession.get(message.chatSessionId) ?? [];
    sessionMessages.push(message);
    bySession.set(message.chatSessionId, sessionMessages);
  }

  const items: AskAiHistoryItem[] = [];

  for (const sessionMessages of bySession.values()) {
    const ordered = [...sessionMessages].sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() ||
        getRoleSortWeight(left.role) - getRoleSortWeight(right.role),
    );
    let pendingUser: {
      id: string;
      content: string;
      uiMessageId: string | null;
    } | null = null;

    for (const message of ordered) {
      if (message.role === "user") {
        pendingUser = {
          id: message.id,
          content: message.content,
          uiMessageId: message.uiMessageId,
        };
        continue;
      }

      if (
        message.role !== "assistant" ||
        !pendingUser ||
        message.errorCode ||
        !message.content.trim()
      ) {
        continue;
      }

      items.push({
        id: message.id,
        userMessageId: pendingUser.uiMessageId ?? pendingUser.id,
        assistantMessageId: message.uiMessageId ?? message.id,
        question: pendingUser.content,
        answer: message.content,
        createdAt: message.createdAt.toISOString(),
        sources: getHistorySources(getChunks(message.id)),
      });
      pendingUser = null;
    }
  }

  return items
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, limit);
}

function getHistorySources(
  chunks: Array<{
    sourceId?: string | null;
    documentTitle?: string | null;
    title?: string | null;
    documentUrl?: string | null;
    url?: string | null;
    rank?: number | null;
  }>,
) {
  return chunks
    .sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0))
    .map((chunk, index) => {
      const title = chunk.documentTitle ?? chunk.title ?? `Source ${index + 1}`;
      const url = chunk.documentUrl ?? chunk.url ?? null;
      const preview = createPreviewSourceFromUrl(url, title);

      if (!preview) {
        return null;
      }

      return {
        sourceId: chunk.sourceId ?? `source-${index + 1}`,
        title,
        previewToken: preview.previewToken,
      };
    })
    .filter((source): source is NonNullable<typeof source> => Boolean(source));
}
