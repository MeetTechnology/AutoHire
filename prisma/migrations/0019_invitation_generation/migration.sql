-- CreateEnum
CREATE TYPE "InviteHashAlgorithm" AS ENUM ('SHA256', 'SHA384', 'SHA512');

-- AlterTable
ALTER TABLE "ExpertInvitation"
ADD COLUMN "hashAlgorithm" "InviteHashAlgorithm" NOT NULL DEFAULT 'SHA256';

-- CreateTable
CREATE TABLE "InvitationGenerationBatch" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "hashAlgorithm" "InviteHashAlgorithm" NOT NULL,
  "requestedCount" INTEGER NOT NULL,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "expiredDays" INTEGER NOT NULL DEFAULT 90,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvitationGenerationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationGenerationItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "expertId" TEXT NOT NULL,
  "plaintextToken" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "inviteLink" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InvitationGenerationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpertInvitation_hashAlgorithm_idx" ON "ExpertInvitation"("hashAlgorithm");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationGenerationBatch_idempotencyKey_key" ON "InvitationGenerationBatch"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationGenerationItem_invitationId_key" ON "InvitationGenerationItem"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationGenerationItem_tokenHash_key" ON "InvitationGenerationItem"("tokenHash");

-- CreateIndex
CREATE INDEX "InvitationGenerationItem_batchId_idx" ON "InvitationGenerationItem"("batchId");

-- AddForeignKey
ALTER TABLE "InvitationGenerationItem"
ADD CONSTRAINT "InvitationGenerationItem_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "InvitationGenerationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationGenerationItem"
ADD CONSTRAINT "InvitationGenerationItem_invitationId_fkey"
FOREIGN KEY ("invitationId") REFERENCES "ExpertInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
