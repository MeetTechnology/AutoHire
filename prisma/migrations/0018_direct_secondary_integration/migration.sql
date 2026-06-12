-- CreateEnum
CREATE TYPE "SecondaryAnalysisTriggerSource" AS ENUM ('MANUAL', 'AUTO_UPLOAD');

-- AlterTable
ALTER TABLE "SecondaryAnalysisRun"
ADD COLUMN "resumeFileId" TEXT,
ADD COLUMN "triggerSource" "SecondaryAnalysisTriggerSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "externalJobId" TEXT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "exportStatus" TEXT,
ADD COLUMN "exportObjectKey" TEXT,
ADD COLUMN "exportFileName" TEXT,
ADD COLUMN "exportContentType" TEXT,
ADD COLUMN "exportFileSize" INTEGER,
ADD COLUMN "exportSha256" TEXT,
ADD COLUMN "exportErrorMessage" TEXT,
ADD COLUMN "lastSyncAt" TIMESTAMP(3),
ADD COLUMN "nextRetryAt" TIMESTAMP(3),
ALTER COLUMN "externalRunId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SecondaryAnalysisCallbackEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "secondaryRunId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecondaryAnalysisCallbackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecondaryAnalysisRun_idempotencyKey_key" ON "SecondaryAnalysisRun"("idempotencyKey");
CREATE INDEX "SecondaryAnalysisRun_resumeFileId_idx" ON "SecondaryAnalysisRun"("resumeFileId");
CREATE INDEX "SecondaryAnalysisRun_triggerSource_status_idx" ON "SecondaryAnalysisRun"("triggerSource", "status");
CREATE INDEX "SecondaryAnalysisRun_externalJobId_externalRunId_idx" ON "SecondaryAnalysisRun"("externalJobId", "externalRunId");
CREATE UNIQUE INDEX "SecondaryAnalysisCallbackEvent_eventId_key" ON "SecondaryAnalysisCallbackEvent"("eventId");
CREATE INDEX "SecondaryAnalysisCallbackEvent_secondaryRunId_createdAt_idx" ON "SecondaryAnalysisCallbackEvent"("secondaryRunId", "createdAt");

-- AddForeignKey
ALTER TABLE "SecondaryAnalysisRun" ADD CONSTRAINT "SecondaryAnalysisRun_resumeFileId_fkey" FOREIGN KEY ("resumeFileId") REFERENCES "ResumeFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecondaryAnalysisCallbackEvent" ADD CONSTRAINT "SecondaryAnalysisCallbackEvent_secondaryRunId_fkey" FOREIGN KEY ("secondaryRunId") REFERENCES "SecondaryAnalysisRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
