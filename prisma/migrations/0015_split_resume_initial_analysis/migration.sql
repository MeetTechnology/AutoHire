-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'CV_EXTRACTING';
ALTER TYPE "ApplicationStatus" ADD VALUE 'CV_EXTRACTION_REVIEW';

-- CreateEnum
CREATE TYPE "ResumeExtractionReviewStatus" AS ENUM ('PROCESSING', 'READY', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "ResumeExtractionReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "analysisJobId" TEXT NOT NULL,
    "externalJobId" TEXT,
    "status" "ResumeExtractionReviewStatus" NOT NULL DEFAULT 'PROCESSING',
    "extractedFields" JSONB,
    "rawExtractionResponse" TEXT,
    "errorMessage" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeExtractionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeExtractionReview_analysisJobId_key" ON "ResumeExtractionReview"("analysisJobId");

-- CreateIndex
CREATE INDEX "ResumeExtractionReview_applicationId_idx" ON "ResumeExtractionReview"("applicationId");

-- CreateIndex
CREATE INDEX "ResumeExtractionReview_status_idx" ON "ResumeExtractionReview"("status");

-- AddForeignKey
ALTER TABLE "ResumeExtractionReview" ADD CONSTRAINT "ResumeExtractionReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeExtractionReview" ADD CONSTRAINT "ResumeExtractionReview_analysisJobId_fkey" FOREIGN KEY ("analysisJobId") REFERENCES "ResumeAnalysisJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
