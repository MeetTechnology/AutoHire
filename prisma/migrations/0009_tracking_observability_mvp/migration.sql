DO $$
BEGIN
    CREATE TYPE "AccessResult" AS ENUM ('VALID', 'INVALID', 'EXPIRED', 'DISABLED', 'SESSION_RESTORE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "AccessTokenStatusSnapshot" AS ENUM ('UNKNOWN', 'ACTIVE', 'EXPIRED', 'DISABLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "EventStatus" AS ENUM ('SUCCESS', 'FAIL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "UploadKind" AS ENUM ('RESUME', 'MATERIAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "UploadFailureStage" AS ENUM ('INTENT', 'PUT', 'CONFIRM');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "InviteAccessLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitationId" TEXT,
    "applicationId" TEXT,
    "tokenStatus" "AccessTokenStatusSnapshot" NOT NULL DEFAULT 'UNKNOWN',
    "accessResult" "AccessResult" NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "landingPath" TEXT,
    "sessionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FileUploadAttempt" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "uploadId" TEXT,
    "kind" "UploadKind" NOT NULL,
    "category" "MaterialCategory",
    "fileName" TEXT NOT NULL,
    "fileExt" TEXT,
    "fileSize" INTEGER,
    "intentCreatedAt" TIMESTAMP(3),
    "uploadStartedAt" TIMESTAMP(3),
    "uploadConfirmedAt" TIMESTAMP(3),
    "uploadFailedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureStage" "UploadFailureStage",
    "durationMs" INTEGER,
    "objectKey" TEXT,
    "sessionId" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileUploadAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Application"
    ADD COLUMN IF NOT EXISTS "firstAccessedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lastAccessedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "introConfirmedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "resumeUploadStartedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "resumeUploadedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "analysisStartedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "analysisCompletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "materialsEnteredAt" TIMESTAMP(3);

ALTER TABLE "ApplicationEventLog"
    ADD COLUMN IF NOT EXISTS "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "pageName" TEXT,
    ADD COLUMN IF NOT EXISTS "stepName" TEXT,
    ADD COLUMN IF NOT EXISTS "actionName" TEXT,
    ADD COLUMN IF NOT EXISTS "eventStatus" "EventStatus",
    ADD COLUMN IF NOT EXISTS "errorCode" TEXT,
    ADD COLUMN IF NOT EXISTS "errorMessage" TEXT,
    ADD COLUMN IF NOT EXISTS "durationMs" INTEGER,
    ADD COLUMN IF NOT EXISTS "sessionId" TEXT,
    ADD COLUMN IF NOT EXISTS "requestId" TEXT,
    ADD COLUMN IF NOT EXISTS "ipHash" TEXT,
    ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
    ADD COLUMN IF NOT EXISTS "referer" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "FileUploadAttempt_uploadId_key" ON "FileUploadAttempt"("uploadId");

CREATE INDEX IF NOT EXISTS "InviteAccessLog_occurredAt_idx" ON "InviteAccessLog"("occurredAt");
CREATE INDEX IF NOT EXISTS "InviteAccessLog_invitationId_occurredAt_idx" ON "InviteAccessLog"("invitationId", "occurredAt");
CREATE INDEX IF NOT EXISTS "InviteAccessLog_applicationId_occurredAt_idx" ON "InviteAccessLog"("applicationId", "occurredAt");
CREATE INDEX IF NOT EXISTS "InviteAccessLog_accessResult_occurredAt_idx" ON "InviteAccessLog"("accessResult", "occurredAt");
CREATE INDEX IF NOT EXISTS "InviteAccessLog_tokenStatus_occurredAt_idx" ON "InviteAccessLog"("tokenStatus", "occurredAt");
CREATE INDEX IF NOT EXISTS "InviteAccessLog_sessionId_occurredAt_idx" ON "InviteAccessLog"("sessionId", "occurredAt");
CREATE INDEX IF NOT EXISTS "InviteAccessLog_requestId_idx" ON "InviteAccessLog"("requestId");
CREATE INDEX IF NOT EXISTS "InviteAccessLog_utmSource_utmMedium_utmCampaign_idx" ON "InviteAccessLog"("utmSource", "utmMedium", "utmCampaign");

CREATE INDEX IF NOT EXISTS "Application_firstAccessedAt_idx" ON "Application"("firstAccessedAt");
CREATE INDEX IF NOT EXISTS "Application_lastAccessedAt_idx" ON "Application"("lastAccessedAt");
CREATE INDEX IF NOT EXISTS "Application_introConfirmedAt_idx" ON "Application"("introConfirmedAt");
CREATE INDEX IF NOT EXISTS "Application_resumeUploadedAt_idx" ON "Application"("resumeUploadedAt");
CREATE INDEX IF NOT EXISTS "Application_analysisCompletedAt_idx" ON "Application"("analysisCompletedAt");
CREATE INDEX IF NOT EXISTS "Application_materialsEnteredAt_idx" ON "Application"("materialsEnteredAt");
CREATE INDEX IF NOT EXISTS "Application_submittedAt_idx" ON "Application"("submittedAt");

CREATE INDEX IF NOT EXISTS "ApplicationEventLog_applicationId_eventTime_idx" ON "ApplicationEventLog"("applicationId", "eventTime");
CREATE INDEX IF NOT EXISTS "ApplicationEventLog_eventType_eventTime_idx" ON "ApplicationEventLog"("eventType", "eventTime");
CREATE INDEX IF NOT EXISTS "ApplicationEventLog_pageName_eventTime_idx" ON "ApplicationEventLog"("pageName", "eventTime");
CREATE INDEX IF NOT EXISTS "ApplicationEventLog_stepName_eventTime_idx" ON "ApplicationEventLog"("stepName", "eventTime");
CREATE INDEX IF NOT EXISTS "ApplicationEventLog_actionName_eventTime_idx" ON "ApplicationEventLog"("actionName", "eventTime");
CREATE INDEX IF NOT EXISTS "ApplicationEventLog_eventStatus_eventTime_idx" ON "ApplicationEventLog"("eventStatus", "eventTime");
CREATE INDEX IF NOT EXISTS "ApplicationEventLog_sessionId_eventTime_idx" ON "ApplicationEventLog"("sessionId", "eventTime");
CREATE INDEX IF NOT EXISTS "ApplicationEventLog_requestId_idx" ON "ApplicationEventLog"("requestId");

CREATE INDEX IF NOT EXISTS "FileUploadAttempt_applicationId_kind_createdAt_idx" ON "FileUploadAttempt"("applicationId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "FileUploadAttempt_applicationId_category_createdAt_idx" ON "FileUploadAttempt"("applicationId", "category", "createdAt");
CREATE INDEX IF NOT EXISTS "FileUploadAttempt_kind_createdAt_idx" ON "FileUploadAttempt"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "FileUploadAttempt_failureStage_createdAt_idx" ON "FileUploadAttempt"("failureStage", "createdAt");
CREATE INDEX IF NOT EXISTS "FileUploadAttempt_sessionId_createdAt_idx" ON "FileUploadAttempt"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "FileUploadAttempt_requestId_idx" ON "FileUploadAttempt"("requestId");

DO $$
BEGIN
    ALTER TABLE "InviteAccessLog"
        ADD CONSTRAINT "InviteAccessLog_invitationId_fkey"
        FOREIGN KEY ("invitationId") REFERENCES "ExpertInvitation"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "InviteAccessLog"
        ADD CONSTRAINT "InviteAccessLog_applicationId_fkey"
        FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "FileUploadAttempt"
        ADD CONSTRAINT "FileUploadAttempt_applicationId_fkey"
        FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
