import { z } from "zod";

export const uploadIntentSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive(),
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
    ])
    .optional(),
});

export const resumeConfirmSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive(),
  objectKey: z.string().min(1),
});

export const materialConfirmSchema = resumeConfirmSchema.extend({
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
  ]),
});

export const supplementalFieldsSchema = z.object({
  fields: z.record(z.string(), z.unknown()),
});

export const secondaryAnalysisSaveSchema = z.object({
  runId: z.string().min(1),
  fields: z.record(z.string(), z.unknown()),
});
