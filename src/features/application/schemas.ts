import { z } from "zod";

const uploadConfirmFileFields = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive(),
  objectKey: z.string().min(1),
  uploadId: z.string().min(1),
});

const trimmedNonEmpty = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1),
);

const normalizedEmail = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.string().email(),
);

export const uploadIntentSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive(),
  uploadId: z.string().min(1),
  category: z
    .enum([
      "IDENTITY",
      "EMPLOYMENT",
      "EDUCATION",
      "HONOR",
      "PATENT",
      "PROJECT",
      "PAPER",
      "BOOK",
      "CONFERENCE",
      "PRODUCT",
    ])
    .optional(),
});

export const resumeConfirmSchema = uploadConfirmFileFields.extend({
  screeningPassportFullName: trimmedNonEmpty.optional(),
  screeningContactEmail: normalizedEmail.optional(),
  screeningWorkEmail: normalizedEmail.optional(),
  screeningPhoneNumber: trimmedNonEmpty.optional(),
});

/** Client-side check for the two CV review identity fields (no file fields). */
export const resumeScreeningIdentityOnlySchema = z.object({
  screeningPassportFullName: trimmedNonEmpty,
  screeningContactEmail: normalizedEmail,
  screeningWorkEmail: normalizedEmail.optional(),
  screeningPhoneNumber: trimmedNonEmpty.optional(),
});

export const materialConfirmSchema = uploadConfirmFileFields.extend({
  category: z.enum([
    "IDENTITY",
    "EMPLOYMENT",
    "EDUCATION",
    "HONOR",
    "PATENT",
    "PROJECT",
    "PAPER",
    "BOOK",
    "CONFERENCE",
    "PRODUCT",
  ]),
});

export const productInnovationDescriptionSchema = z.object({
  description: z.string().max(12000),
});

export const supplementalFieldsSchema = z.object({
  fields: z.record(z.string(), z.unknown()),
});

export const secondaryAnalysisSaveSchema = z.object({
  runId: z.string().min(1),
  fields: z.record(z.string(), z.unknown()),
});
