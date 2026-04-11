-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('INIT', 'INTRO_VIEWED', 'CV_UPLOADED', 'CV_ANALYZING', 'INFO_REQUIRED', 'REANALYZING', 'INELIGIBLE', 'ELIGIBLE', 'MATERIALS_IN_PROGRESS', 'SUBMITTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EligibilityResult" AS ENUM ('UNKNOWN', 'INSUFFICIENT_INFO', 'ELIGIBLE', 'INELIGIBLE');

-- CreateEnum
CREATE TYPE "AnalysisJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalysisJobType" AS ENUM ('INITIAL', 'REANALYSIS');

-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('IDENTITY', 'EMPLOYMENT', 'EDUCATION', 'HONOR', 'PATENT', 'PROJECT');

-- CreateTable
CREATE TABLE "ExpertInvitation" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "email" TEXT,
    "tokenHash" TEXT NOT NULL,
    "tokenStatus" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "applicationStatus" "ApplicationStatus" NOT NULL DEFAULT 'INIT',
    "currentStep" TEXT,
    "eligibilityResult" "EligibilityResult" NOT NULL DEFAULT 'UNKNOWN',
    "latestAnalysisJobId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeFile" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "versionNo" INTEGER NOT NULL DEFAULT 1,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeAnalysisJob" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "externalJobId" TEXT,
    "jobType" "AnalysisJobType" NOT NULL,
    "jobStatus" "AnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stageText" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ResumeAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeAnalysisResult" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "analysisJobId" TEXT NOT NULL,
    "analysisRound" INTEGER NOT NULL DEFAULT 1,
    "eligibilityResult" "EligibilityResult" NOT NULL DEFAULT 'UNKNOWN',
    "reasonText" TEXT,
    "displaySummary" TEXT,
    "extractedFields" JSONB,
    "missingFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeAnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementalFieldSubmission" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "analysisJobId" TEXT,
    "fieldValues" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplementalFieldSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationMaterial" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "fileName" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ApplicationMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEventLog" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpertInvitation_tokenHash_key" ON "ExpertInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "ExpertInvitation_expertId_idx" ON "ExpertInvitation"("expertId");

-- CreateIndex
CREATE INDEX "Application_expertId_idx" ON "Application"("expertId");

-- CreateIndex
CREATE INDEX "Application_applicationStatus_idx" ON "Application"("applicationStatus");

-- CreateIndex
CREATE INDEX "ResumeFile_applicationId_idx" ON "ResumeFile"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeAnalysisJob_externalJobId_key" ON "ResumeAnalysisJob"("externalJobId");

-- CreateIndex
CREATE INDEX "ResumeAnalysisJob_applicationId_idx" ON "ResumeAnalysisJob"("applicationId");

-- CreateIndex
CREATE INDEX "ResumeAnalysisResult_applicationId_idx" ON "ResumeAnalysisResult"("applicationId");

-- CreateIndex
CREATE INDEX "ResumeAnalysisResult_analysisJobId_idx" ON "ResumeAnalysisResult"("analysisJobId");

-- CreateIndex
CREATE INDEX "SupplementalFieldSubmission_applicationId_idx" ON "SupplementalFieldSubmission"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationMaterial_applicationId_category_idx" ON "ApplicationMaterial"("applicationId", "category");

-- CreateIndex
CREATE INDEX "ApplicationEventLog_applicationId_idx" ON "ApplicationEventLog"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationEventLog_eventType_idx" ON "ApplicationEventLog"("eventType");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ExpertInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeFile" ADD CONSTRAINT "ResumeFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeAnalysisJob" ADD CONSTRAINT "ResumeAnalysisJob_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeAnalysisResult" ADD CONSTRAINT "ResumeAnalysisResult_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementalFieldSubmission" ADD CONSTRAINT "SupplementalFieldSubmission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationMaterial" ADD CONSTRAINT "ApplicationMaterial_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEventLog" ADD CONSTRAINT "ApplicationEventLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

