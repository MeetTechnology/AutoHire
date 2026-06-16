import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { z } from "zod";

import {
  generateInvitePlaintextToken,
  hashInviteToken,
  INVITE_HASH_ALGORITHMS,
  type InviteHashAlgorithm,
} from "@/lib/auth/token";
import {
  createInvitationGenerationBatch,
  findInvitationGenerationBatchById,
  findInvitationGenerationBatchByIdempotencyKey,
  type InvitationGenerationBatchWithItems,
} from "@/lib/data/store";
import { getEnv } from "@/lib/env";

export const INVITATION_GENERATION_MAX_COUNT = 1000;
export const INVITATION_GENERATION_DEFAULT_EXPIRED_DAYS = 90;

export const invitationGenerationRequestSchema = z.object({
  algorithm: z.enum(INVITE_HASH_ALGORITHMS),
  count: z.coerce.number().int().min(1).max(INVITATION_GENERATION_MAX_COUNT),
  idempotencyKey: z.string().trim().min(8).max(120),
  expiredDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(3650)
    .default(INVITATION_GENERATION_DEFAULT_EXPIRED_DAYS),
});

export type InvitationGenerationRequest = z.infer<
  typeof invitationGenerationRequestSchema
>;

export type InvitationGenerationItemSummary = {
  readonly sequence: number;
  readonly invitationId: string;
  readonly expertId: string;
  readonly plaintextToken: string;
  readonly tokenHash: string;
  readonly inviteLink: string;
  readonly hashAlgorithm: InviteHashAlgorithm;
  readonly createdAt: string;
};

export type InvitationGenerationBatchSummary = {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly hashAlgorithm: InviteHashAlgorithm;
  readonly requestedCount: number;
  readonly createdCount: number;
  readonly expiredDays: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items: readonly InvitationGenerationItemSummary[];
};

export class InvitationGenerationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationGenerationConflictError";
  }
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function createBatchId() {
  return `invite_batch_${randomUUID().replaceAll("-", "")}`;
}

function getInviteBaseUrl() {
  return getEnv().APP_BASE_URL.replace(/\/$/, "");
}

function buildInviteLink(token: string) {
  return `${getInviteBaseUrl()}/apply?t=${encodeURIComponent(token)}`;
}

function toBatchSummary(
  batch: InvitationGenerationBatchWithItems,
): InvitationGenerationBatchSummary {
  return {
    id: batch.id,
    idempotencyKey: batch.idempotencyKey,
    hashAlgorithm: batch.hashAlgorithm,
    requestedCount: batch.requestedCount,
    createdCount: batch.createdCount,
    expiredDays: batch.expiredDays,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    items: batch.items.map((item, index) => ({
      sequence: index + 1,
      invitationId: item.invitationId,
      expertId: item.expertId,
      plaintextToken: item.plaintextToken,
      tokenHash: item.tokenHash,
      inviteLink: item.inviteLink,
      hashAlgorithm: batch.hashAlgorithm,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function getInvitationGenerationBatchSummary(batchId: string) {
  const batch = await findInvitationGenerationBatchById(batchId);

  return batch ? toBatchSummary(batch) : null;
}

export async function generateInvitationBatch(
  input: InvitationGenerationRequest,
): Promise<InvitationGenerationBatchSummary> {
  const existing = await findInvitationGenerationBatchByIdempotencyKey(
    input.idempotencyKey,
  );

  if (existing) {
    if (
      existing.hashAlgorithm !== input.algorithm ||
      existing.requestedCount !== input.count ||
      existing.expiredDays !== input.expiredDays
    ) {
      throw new InvitationGenerationConflictError(
        "The idempotency key was already used with different generation settings.",
      );
    }

    return toBatchSummary(existing);
  }

  const batchId = createBatchId();
  const now = new Date();
  const expiredAt = addDays(now, input.expiredDays);
  const invitations = Array.from({ length: input.count }, (_, index) => {
    const plaintextToken = generateInvitePlaintextToken();

    return {
      expertId: `generated_${batchId}_${index + 1}`,
      plaintextToken,
      tokenHash: hashInviteToken(plaintextToken, input.algorithm),
      inviteLink: buildInviteLink(plaintextToken),
      expiredAt,
    };
  });

  const batch = await createInvitationGenerationBatch({
    id: batchId,
    idempotencyKey: input.idempotencyKey,
    hashAlgorithm: input.algorithm,
    requestedCount: input.count,
    expiredDays: input.expiredDays,
    invitations,
  });

  return toBatchSummary(batch);
}

export function buildInvitationGenerationWorkbook(
  batch: InvitationGenerationBatchSummary,
) {
  const rows = batch.items.map((item) => ({
    sequence: item.sequence,
    invitationId: item.invitationId,
    expertId: item.expertId,
    plaintextToken: item.plaintextToken,
    inviteLink: item.inviteLink,
    hashAlgorithm: item.hashAlgorithm,
    expiredAt: addDays(
      new Date(batch.createdAt),
      batch.expiredDays,
    ).toISOString(),
    createdAt: item.createdAt,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      "sequence",
      "invitationId",
      "expertId",
      "plaintextToken",
      "inviteLink",
      "hashAlgorithm",
      "expiredAt",
      "createdAt",
    ],
  });
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Invitation Tokens");

  const workbookBuffer: Buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return workbookBuffer;
}
