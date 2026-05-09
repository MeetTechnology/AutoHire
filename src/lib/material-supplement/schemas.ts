import { z } from "zod";

import { SUPPORTED_SUPPLEMENT_CATEGORIES } from "@/features/material-supplement/constants";

const trimmedNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1),
);

const isoDatetimeString = z.string().datetime({ offset: true });
const trimmedIsoDatetimeString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  isoDatetimeString,
);

export const supplementApplicationParamsSchema = z.object({
  applicationId: trimmedNonEmptyString,
});

export const supplementReviewRunParamsSchema = z.object({
  applicationId: trimmedNonEmptyString,
  reviewRunId: trimmedNonEmptyString,
});

export const supplementFileParamsSchema = z.object({
  applicationId: trimmedNonEmptyString,
  fileId: trimmedNonEmptyString,
});

export const supplementBatchParamsSchema = z.object({
  applicationId: trimmedNonEmptyString,
  batchId: trimmedNonEmptyString,
});

export const supplementInitialReviewRequestSchema = z.object({}).strict();

export const supplementUploadBatchRequestSchema = z
  .object({
    category: trimmedNonEmptyString,
  })
  .strict();

export const supplementUploadIntentRequestSchema = z
  .object({
    uploadBatchId: trimmedNonEmptyString,
    category: trimmedNonEmptyString,
    supplementRequestId: trimmedNonEmptyString.optional(),
    fileName: trimmedNonEmptyString,
    fileType: trimmedNonEmptyString,
    fileSize: z.number().int().positive(),
  })
  .strict();

export const supplementConfirmFileRequestSchema = z
  .object({
    uploadBatchId: trimmedNonEmptyString,
    category: trimmedNonEmptyString,
    supplementRequestId: trimmedNonEmptyString.optional(),
    fileName: trimmedNonEmptyString,
    fileType: trimmedNonEmptyString,
    fileSize: z.number().int().positive(),
    objectKey: trimmedNonEmptyString,
  })
  .strict();

export const supplementConfirmUploadBatchRequestSchema =
  supplementUploadBatchRequestSchema;

export const supplementCallbackHeadersSchema = z.object({
  "x-material-review-signature": trimmedNonEmptyString,
  "x-material-review-timestamp": trimmedIsoDatetimeString,
});

export const supplementCallbackRequestStatusSchema = z.enum([
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

export const supplementCallbackCategorySchema = z.enum(
  SUPPORTED_SUPPLEMENT_CATEGORIES,
);

export const supplementCallbackRequestItemStatusSchema = z.enum([
  "PENDING",
  "UPLOADED_WAITING_REVIEW",
  "REVIEWING",
  "SATISFIED",
  "HISTORY_ONLY",
]);

export const supplementCallbackRequestItemSchema = z.object({
  title: trimmedNonEmptyString,
  reason: z.string().trim().nullish(),
  suggestedMaterials: z.array(trimmedNonEmptyString).nullish(),
  aiMessage: z.string().trim().nullish(),
  status: supplementCallbackRequestItemStatusSchema,
});

export const supplementCallbackResultPayloadSchema = z.object({
  supplementRequired: z.boolean(),
  requests: z.array(supplementCallbackRequestItemSchema),
});

export const supplementCallbackCategoryResultSchema = z.object({
  category: supplementCallbackCategorySchema,
  status: supplementCallbackRequestStatusSchema,
  reviewedAt: isoDatetimeString.nullish(),
  aiMessage: z.string().trim().nullish(),
  resultPayload: supplementCallbackResultPayloadSchema,
  rawResultPayload: z.unknown().nullable().optional(),
});

export const supplementReviewCallbackBodySchema = z.object({
  externalRunId: trimmedNonEmptyString,
  status: supplementCallbackRequestStatusSchema,
  finishedAt: isoDatetimeString.nullish(),
  categories: z.array(supplementCallbackCategoryResultSchema),
});

export function getSupplementCallbackHeaders(input: Headers) {
  return {
    "x-material-review-signature":
      input.get("x-material-review-signature") ?? "",
    "x-material-review-timestamp":
      input.get("x-material-review-timestamp") ?? "",
  };
}
