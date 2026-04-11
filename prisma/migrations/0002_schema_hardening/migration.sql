-- Harden invitation/application cardinality
CREATE UNIQUE INDEX IF NOT EXISTS "Application_invitationId_key" ON "Application"("invitationId");

-- Ensure resume version numbering stays unique per application
CREATE UNIQUE INDEX IF NOT EXISTS "ResumeFile_applicationId_versionNo_key" ON "ResumeFile"("applicationId", "versionNo");

-- Bind analysis jobs to the concrete resume version that triggered them
ALTER TABLE "ResumeAnalysisJob" ADD COLUMN IF NOT EXISTS "resumeFileId" TEXT;

UPDATE "ResumeAnalysisJob" AS job
SET "resumeFileId" = latest_resume."id"
FROM (
    SELECT DISTINCT ON (rf."applicationId")
        rf."applicationId",
        rf."id"
    FROM "ResumeFile" rf
    ORDER BY rf."applicationId", rf."versionNo" DESC, rf."uploadedAt" DESC
) AS latest_resume
WHERE job."resumeFileId" IS NULL
  AND latest_resume."applicationId" = job."applicationId";

CREATE INDEX IF NOT EXISTS "ResumeAnalysisJob_resumeFileId_idx" ON "ResumeAnalysisJob"("resumeFileId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ResumeAnalysisJob_resumeFileId_fkey'
    ) THEN
        ALTER TABLE "ResumeAnalysisJob"
        ADD CONSTRAINT "ResumeAnalysisJob_resumeFileId_fkey"
        FOREIGN KEY ("resumeFileId") REFERENCES "ResumeFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Enforce one structured result per analysis job and keep job/result linkage consistent
CREATE UNIQUE INDEX IF NOT EXISTS "ResumeAnalysisResult_analysisJobId_key" ON "ResumeAnalysisResult"("analysisJobId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ResumeAnalysisResult_analysisJobId_fkey'
    ) THEN
        ALTER TABLE "ResumeAnalysisResult"
        ADD CONSTRAINT "ResumeAnalysisResult_analysisJobId_fkey"
        FOREIGN KEY ("analysisJobId") REFERENCES "ResumeAnalysisJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Keep supplemental submissions anchored to the triggering analysis job when present
CREATE INDEX IF NOT EXISTS "SupplementalFieldSubmission_analysisJobId_idx" ON "SupplementalFieldSubmission"("analysisJobId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'SupplementalFieldSubmission_analysisJobId_fkey'
    ) THEN
        ALTER TABLE "SupplementalFieldSubmission"
        ADD CONSTRAINT "SupplementalFieldSubmission_analysisJobId_fkey"
        FOREIGN KEY ("analysisJobId") REFERENCES "ResumeAnalysisJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Preserve soft-delete audit timestamps for materials
ALTER TABLE "ApplicationMaterial" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

UPDATE "ApplicationMaterial"
SET "deletedAt" = CURRENT_TIMESTAMP
WHERE "isDeleted" = true AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "ApplicationMaterial_applicationId_isDeleted_category_idx"
ON "ApplicationMaterial"("applicationId", "isDeleted", "category");
