-- CreateEnum
CREATE TYPE "ApplicationFeedbackStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "ApplicationFeedback" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "ApplicationFeedbackStatus" NOT NULL DEFAULT 'DRAFT',
    "rating" INTEGER,
    "comment" TEXT,
    "draftSavedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationFeedback_applicationId_key" ON "ApplicationFeedback"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationFeedback_status_updatedAt_idx" ON "ApplicationFeedback"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ApplicationFeedback_submittedAt_idx" ON "ApplicationFeedback"("submittedAt");

-- AddForeignKey
ALTER TABLE "ApplicationFeedback" ADD CONSTRAINT "ApplicationFeedback_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
