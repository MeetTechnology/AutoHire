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

const normalizedFeedbackComment = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "";
  },
  z.string().max(2000),
);

const feedbackContextSchema = z.object({
  currentUrl: z.string().url().max(2048).nullable().optional(),
  pageTitle: z.string().trim().max(300).nullable().optional(),
  flowName: z.string().trim().max(120).nullable().optional(),
  flowStep: z.string().trim().max(120).nullable().optional(),
  browserInfo: z.string().trim().max(1000).nullable().optional(),
  deviceType: z.enum(["desktop", "tablet", "mobile", "unknown"]).nullable().optional(),
  viewportWidth: z.number().int().min(0).max(10000).nullable().optional(),
  viewportHeight: z.number().int().min(0).max(10000).nullable().optional(),
  isLoggedIn: z.boolean().nullable().optional(),
  userId: z.string().trim().max(191).nullable().optional(),
  surface: z.string().trim().max(120).nullable().optional(),
});

export const feedbackDraftSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  comment: normalizedFeedbackComment.optional(),
  context: feedbackContextSchema.optional(),
});

export const feedbackSubmitSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  comment: normalizedFeedbackComment.optional(),
  context: feedbackContextSchema.optional(),
}).superRefine((value, context) => {
  const hasRating = typeof value.rating === "number";
  const hasComment = (value.comment ?? "").trim().length > 0;

  if (!hasRating && !hasComment) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rating"],
      message: "Choose a rating or write a comment to send feedback.",
    });
  }
});
