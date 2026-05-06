-- CreateEnum
CREATE TYPE "SupplementCategory" AS ENUM (
    'IDENTITY',
    'EDUCATION',
    'EMPLOYMENT',
    'PROJECT',
    'PATENT',
    'HONOR'
);

-- CreateEnum
CREATE TYPE "MaterialReviewRunStatus" AS ENUM (
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);

-- CreateEnum
CREATE TYPE "MaterialReviewTriggerType" AS ENUM (
    'INITIAL_SUBMISSION',
    'SUPPLEMENT_UPLOAD',
    'MANUAL_RETRY'
);

-- CreateEnum
CREATE TYPE "MaterialCategoryReviewStatus" AS ENUM (
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);

-- CreateEnum
CREATE TYPE "SupplementRequestStatus" AS ENUM (
    'PENDING',
    'UPLOADED_WAITING_REVIEW',
    'REVIEWING',
    'SATISFIED',
    'HISTORY_ONLY'
);

-- CreateEnum
CREATE TYPE "SupplementUploadBatchStatus" AS ENUM (
    'DRAFT',
    'CONFIRMED',
    'REVIEWING',
    'COMPLETED',
    'CANCELLED'
);

-- CreateTable
CREATE TABLE "MaterialReviewRun" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "runNo" INTEGER NOT NULL,
    "status" "MaterialReviewRunStatus" NOT NULL DEFAULT 'QUEUED',
    "triggerType" "MaterialReviewTriggerType" NOT NULL,
    "triggeredCategory" "SupplementCategory",
    "externalRunId" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReviewRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCategoryReview" (
    "id" TEXT NOT NULL,
    "reviewRunId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "category" "SupplementCategory" NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "status" "MaterialCategoryReviewStatus" NOT NULL DEFAULT 'QUEUED',
    "aiMessage" TEXT,
    "resultPayload" JSONB,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialCategoryReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementRequest" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "category" "SupplementCategory" NOT NULL,
    "reviewRunId" TEXT NOT NULL,
    "categoryReviewId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "suggestedMaterials" JSONB,
    "aiMessage" TEXT,
    "status" "SupplementRequestStatus" NOT NULL DEFAULT 'PENDING',
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "isSatisfied" BOOLEAN NOT NULL DEFAULT false,
    "satisfiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementUploadBatch" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "category" "SupplementCategory" NOT NULL,
    "status" "SupplementUploadBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "reviewRunId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementUploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementFile" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "category" "SupplementCategory" NOT NULL,
    "supplementRequestId" TEXT,
    "uploadBatchId" TEXT NOT NULL,
    "reviewRunId" TEXT,
    "fileName" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialReviewRun_applicationId_idx"
ON "MaterialReviewRun"("applicationId");

-- CreateIndex
CREATE INDEX "MaterialReviewRun_applicationId_status_idx"
ON "MaterialReviewRun"("applicationId", "status");

-- CreateIndex
CREATE INDEX "MaterialReviewRun_externalRunId_idx"
ON "MaterialReviewRun"("externalRunId");

-- CreateIndex
CREATE INDEX "MaterialReviewRun_createdAt_idx"
ON "MaterialReviewRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReviewRun_applicationId_runNo_key"
ON "MaterialReviewRun"("applicationId", "runNo");

-- CreateIndex
CREATE INDEX "MaterialCategoryReview_applicationId_category_idx"
ON "MaterialCategoryReview"("applicationId", "category");

-- CreateIndex
CREATE INDEX "MaterialCategoryReview_applicationId_category_isLatest_idx"
ON "MaterialCategoryReview"("applicationId", "category", "isLatest");

-- CreateIndex
CREATE INDEX "MaterialCategoryReview_reviewRunId_idx"
ON "MaterialCategoryReview"("reviewRunId");

-- CreateIndex
CREATE INDEX "MaterialCategoryReview_status_updatedAt_idx"
ON "MaterialCategoryReview"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCategoryReview_reviewRunId_category_key"
ON "MaterialCategoryReview"("reviewRunId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCategoryReview_applicationId_category_roundNo_key"
ON "MaterialCategoryReview"("applicationId", "category", "roundNo");

-- CreateIndex
CREATE INDEX "SupplementRequest_applicationId_category_isLatest_idx"
ON "SupplementRequest"("applicationId", "category", "isLatest");

-- CreateIndex
CREATE INDEX "SupplementRequest_applicationId_status_idx"
ON "SupplementRequest"("applicationId", "status");

-- CreateIndex
CREATE INDEX "SupplementRequest_applicationId_isSatisfied_idx"
ON "SupplementRequest"("applicationId", "isSatisfied");

-- CreateIndex
CREATE INDEX "SupplementRequest_reviewRunId_idx"
ON "SupplementRequest"("reviewRunId");

-- CreateIndex
CREATE INDEX "SupplementRequest_categoryReviewId_idx"
ON "SupplementRequest"("categoryReviewId");

-- CreateIndex
CREATE INDEX "SupplementUploadBatch_applicationId_category_idx"
ON "SupplementUploadBatch"("applicationId", "category");

-- CreateIndex
CREATE INDEX "SupplementUploadBatch_applicationId_status_idx"
ON "SupplementUploadBatch"("applicationId", "status");

-- CreateIndex
CREATE INDEX "SupplementUploadBatch_reviewRunId_idx"
ON "SupplementUploadBatch"("reviewRunId");

-- CreateIndex
CREATE INDEX "SupplementUploadBatch_createdAt_idx"
ON "SupplementUploadBatch"("createdAt");

-- CreateIndex
CREATE INDEX "SupplementFile_applicationId_category_idx"
ON "SupplementFile"("applicationId", "category");

-- CreateIndex
CREATE INDEX "SupplementFile_applicationId_uploadBatchId_idx"
ON "SupplementFile"("applicationId", "uploadBatchId");

-- CreateIndex
CREATE INDEX "SupplementFile_reviewRunId_idx"
ON "SupplementFile"("reviewRunId");

-- CreateIndex
CREATE INDEX "SupplementFile_supplementRequestId_idx"
ON "SupplementFile"("supplementRequestId");

-- AddForeignKey
ALTER TABLE "MaterialReviewRun"
ADD CONSTRAINT "MaterialReviewRun_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCategoryReview"
ADD CONSTRAINT "MaterialCategoryReview_reviewRunId_fkey"
FOREIGN KEY ("reviewRunId") REFERENCES "MaterialReviewRun"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCategoryReview"
ADD CONSTRAINT "MaterialCategoryReview_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequest"
ADD CONSTRAINT "SupplementRequest_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequest"
ADD CONSTRAINT "SupplementRequest_reviewRunId_fkey"
FOREIGN KEY ("reviewRunId") REFERENCES "MaterialReviewRun"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequest"
ADD CONSTRAINT "SupplementRequest_categoryReviewId_fkey"
FOREIGN KEY ("categoryReviewId") REFERENCES "MaterialCategoryReview"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementUploadBatch"
ADD CONSTRAINT "SupplementUploadBatch_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementUploadBatch"
ADD CONSTRAINT "SupplementUploadBatch_reviewRunId_fkey"
FOREIGN KEY ("reviewRunId") REFERENCES "MaterialReviewRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementFile"
ADD CONSTRAINT "SupplementFile_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementFile"
ADD CONSTRAINT "SupplementFile_supplementRequestId_fkey"
FOREIGN KEY ("supplementRequestId") REFERENCES "SupplementRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementFile"
ADD CONSTRAINT "SupplementFile_uploadBatchId_fkey"
FOREIGN KEY ("uploadBatchId") REFERENCES "SupplementUploadBatch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementFile"
ADD CONSTRAINT "SupplementFile_reviewRunId_fkey"
FOREIGN KEY ("reviewRunId") REFERENCES "MaterialReviewRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
