ALTER TABLE "SecondaryAnalysisFieldValue"
ADD COLUMN IF NOT EXISTS "hasOverride" BOOLEAN NOT NULL DEFAULT false;
