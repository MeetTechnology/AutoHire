CREATE TABLE IF NOT EXISTS "SecondaryAnalysisRun" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "analysisJobId" TEXT,
    "externalRunId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "runSummary" JSONB,
    "rawResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecondaryAnalysisRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecondaryAnalysisFieldValue" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "secondaryRunId" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "columnName" TEXT,
    "label" TEXT NOT NULL,
    "sourceValue" TEXT,
    "editedValue" TEXT,
    "effectiveValue" TEXT,
    "isMissing" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecondaryAnalysisFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SecondaryAnalysisRun_applicationId_externalRunId_key"
ON "SecondaryAnalysisRun"("applicationId", "externalRunId");

CREATE INDEX IF NOT EXISTS "SecondaryAnalysisRun_applicationId_idx"
ON "SecondaryAnalysisRun"("applicationId");

CREATE INDEX IF NOT EXISTS "SecondaryAnalysisRun_analysisJobId_idx"
ON "SecondaryAnalysisRun"("analysisJobId");

CREATE UNIQUE INDEX IF NOT EXISTS "SecondaryAnalysisFieldValue_secondaryRunId_no_key"
ON "SecondaryAnalysisFieldValue"("secondaryRunId", "no");

CREATE INDEX IF NOT EXISTS "SecondaryAnalysisFieldValue_applicationId_secondaryRunId_idx"
ON "SecondaryAnalysisFieldValue"("applicationId", "secondaryRunId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'SecondaryAnalysisRun_applicationId_fkey'
    ) THEN
        ALTER TABLE "SecondaryAnalysisRun"
        ADD CONSTRAINT "SecondaryAnalysisRun_applicationId_fkey"
        FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'SecondaryAnalysisRun_analysisJobId_fkey'
    ) THEN
        ALTER TABLE "SecondaryAnalysisRun"
        ADD CONSTRAINT "SecondaryAnalysisRun_analysisJobId_fkey"
        FOREIGN KEY ("analysisJobId") REFERENCES "ResumeAnalysisJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'SecondaryAnalysisFieldValue_applicationId_fkey'
    ) THEN
        ALTER TABLE "SecondaryAnalysisFieldValue"
        ADD CONSTRAINT "SecondaryAnalysisFieldValue_applicationId_fkey"
        FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'SecondaryAnalysisFieldValue_secondaryRunId_fkey'
    ) THEN
        ALTER TABLE "SecondaryAnalysisFieldValue"
        ADD CONSTRAINT "SecondaryAnalysisFieldValue_secondaryRunId_fkey"
        FOREIGN KEY ("secondaryRunId") REFERENCES "SecondaryAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
