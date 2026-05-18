-- CreateEnum
CREATE TYPE "AskAiFeedbackRating" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "AskAiSessionStatus" AS ENUM ('ACTIVE', 'CLEARED');

-- CreateTable
CREATE TABLE "AskAiChatSession" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "aliyunSessionId" TEXT,
    "status" "AskAiSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "pageName" TEXT,
    "sessionId" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AskAiChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskAiChatMessage" (
    "id" TEXT NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "uiMessageId" TEXT,
    "aliyunRequestId" TEXT,
    "latencyMs" INTEGER,
    "tokenUsage" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskAiChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskAiRetrievedChunk" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceId" TEXT,
    "documentTitle" TEXT,
    "documentUrl" TEXT,
    "sectionTitle" TEXT,
    "chunkText" TEXT,
    "score" DOUBLE PRECISION,
    "rank" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskAiRetrievedChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskAiMessageFeedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "rating" "AskAiFeedbackRating" NOT NULL,
    "comment" TEXT,
    "applicationId" TEXT,
    "sessionId" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AskAiMessageFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AskAiChatSession_applicationId_createdAt_idx" ON "AskAiChatSession"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "AskAiChatSession_aliyunSessionId_idx" ON "AskAiChatSession"("aliyunSessionId");

-- CreateIndex
CREATE INDEX "AskAiChatSession_sessionId_createdAt_idx" ON "AskAiChatSession"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AskAiChatMessage_chatSessionId_createdAt_idx" ON "AskAiChatMessage"("chatSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AskAiChatMessage_aliyunRequestId_idx" ON "AskAiChatMessage"("aliyunRequestId");

-- CreateIndex
CREATE INDEX "AskAiChatMessage_uiMessageId_idx" ON "AskAiChatMessage"("uiMessageId");

-- CreateIndex
CREATE INDEX "AskAiRetrievedChunk_messageId_rank_idx" ON "AskAiRetrievedChunk"("messageId", "rank");

-- CreateIndex
CREATE INDEX "AskAiRetrievedChunk_sourceId_idx" ON "AskAiRetrievedChunk"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AskAiMessageFeedback_messageId_key" ON "AskAiMessageFeedback"("messageId");

-- CreateIndex
CREATE INDEX "AskAiMessageFeedback_rating_createdAt_idx" ON "AskAiMessageFeedback"("rating", "createdAt");

-- CreateIndex
CREATE INDEX "AskAiMessageFeedback_applicationId_createdAt_idx" ON "AskAiMessageFeedback"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AskAiChatSession" ADD CONSTRAINT "AskAiChatSession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiChatMessage" ADD CONSTRAINT "AskAiChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "AskAiChatSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiRetrievedChunk" ADD CONSTRAINT "AskAiRetrievedChunk_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AskAiChatMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiMessageFeedback" ADD CONSTRAINT "AskAiMessageFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AskAiChatMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
