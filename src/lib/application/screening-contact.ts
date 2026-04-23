import type { MissingField } from "@/features/analysis/types";
import {
  INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS,
  REQUIRED_SCREENING_CONTACT_FIELD_KEYS,
  type InitialCvReviewFieldKey,
} from "@/features/analysis/initial-cv-review-extract";
import type { EligibilityResult } from "@/features/application/types";
import { buildMissingFieldsFromItemNames } from "@/lib/resume-analysis/missing-field-registry";

type ScreeningContactStorage = {
  screeningPassportFullName?: string | null;
  screeningContactEmail?: string | null;
  screeningWorkEmail?: string | null;
  screeningPhoneNumber?: string | null;
};

const CONTACT_FIELD_LABELS = {
  name: "Name",
  personal_email: "Personal Email",
  work_email: "Work Email",
  phone_number: "Phone Number",
} satisfies Record<(typeof INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS)[number], string>;

const CONTACT_FIELD_TO_STORAGE_KEY = {
  name: "screeningPassportFullName",
  personal_email: "screeningContactEmail",
  work_email: "screeningWorkEmail",
  phone_number: "screeningPhoneNumber",
} as const satisfies Record<
  (typeof INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS)[number],
  keyof Required<ScreeningContactStorage>
>;

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: unknown) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeContactValue(
  key: (typeof INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS)[number],
  value: unknown,
) {
  return key === "personal_email" || key === "work_email"
    ? normalizeEmail(value)
    : normalizeString(value);
}

export function getStoredScreeningContactExtractValues(
  input: ScreeningContactStorage,
): Record<(typeof INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS)[number], string> {
  return {
    name: normalizeContactValue("name", input.screeningPassportFullName) ?? "",
    personal_email:
      normalizeContactValue("personal_email", input.screeningContactEmail) ?? "",
    work_email: normalizeContactValue("work_email", input.screeningWorkEmail) ?? "",
    phone_number:
      normalizeContactValue("phone_number", input.screeningPhoneNumber) ?? "",
  };
}

export function getScreeningContactPatchFromExtractedFields(
  extractedFields: Record<string, unknown>,
): ScreeningContactStorage {
  const patch: ScreeningContactStorage = {};

  for (const key of INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS) {
    const normalized = normalizeContactValue(key, extractedFields[key]);

    if (!normalized) {
      continue;
    }

    patch[CONTACT_FIELD_TO_STORAGE_KEY[key]] = normalized;
  }

  return patch;
}

export function getScreeningContactPatchFromFieldValues(
  fields: Record<string, unknown>,
): ScreeningContactStorage {
  const patch: ScreeningContactStorage = {};

  for (const key of INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) {
      continue;
    }

    const normalized = normalizeContactValue(key, fields[key]);
    patch[CONTACT_FIELD_TO_STORAGE_KEY[key]] = normalized;
  }

  return patch;
}

export function mergeStoredScreeningContactValuesIntoExtractedFields(
  extractedFields: Record<string, unknown>,
  input: ScreeningContactStorage,
) {
  const merged = { ...extractedFields };
  const stored = getStoredScreeningContactExtractValues(input);

  for (const key of INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS) {
    const extracted = normalizeContactValue(key, merged[key]);

    if (!extracted && stored[key]) {
      merged[key] = stored[key];
    }
  }

  return merged;
}

export function getMissingScreeningContactFieldNames(
  extractedFields: Record<string, unknown>,
  input: ScreeningContactStorage,
) {
  const merged = mergeStoredScreeningContactValuesIntoExtractedFields(
    extractedFields,
    input,
  );

  return REQUIRED_SCREENING_CONTACT_FIELD_KEYS.flatMap((key) => {
    const value = normalizeContactValue(key, merged[key]);
    return value ? [] : [CONTACT_FIELD_LABELS[key]];
  });
}

function getSupplementalScreeningContactFieldNames(
  extractedFields: Record<string, unknown>,
  input: ScreeningContactStorage,
) {
  const requiredMissing = getMissingScreeningContactFieldNames(
    extractedFields,
    input,
  );

  if (requiredMissing.length === 0) {
    return [];
  }

  const merged = mergeStoredScreeningContactValuesIntoExtractedFields(
    extractedFields,
    input,
  );

  return INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS.flatMap((key) => {
    const value = normalizeContactValue(key, merged[key]);
    return value ? [] : [CONTACT_FIELD_LABELS[key]];
  });
}

export function mergeMissingFieldsWithScreeningContactRequirements(
  baseMissingFields: MissingField[],
  eligibilityResult: EligibilityResult,
  extractedFields: Record<string, unknown>,
  input: ScreeningContactStorage,
) {
  if (eligibilityResult === "INELIGIBLE") {
    return baseMissingFields;
  }

  const contactMissingFields = buildMissingFieldsFromItemNames(
    getSupplementalScreeningContactFieldNames(extractedFields, input),
  );

  if (eligibilityResult === "ELIGIBLE") {
    return contactMissingFields;
  }

  if (contactMissingFields.length === 0) {
    return baseMissingFields;
  }

  const byFieldKey = new Map<string, MissingField>();

  for (const field of [...baseMissingFields, ...contactMissingFields]) {
    byFieldKey.set(field.fieldKey, field);
  }

  return Array.from(byFieldKey.values());
}

export function hasMissingScreeningContactFields(
  extractedFields: Record<string, unknown>,
  input: ScreeningContactStorage,
) {
  return getMissingScreeningContactFieldNames(extractedFields, input).length > 0;
}

export function isScreeningContactFieldKey(
  key: string,
): key is (typeof INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS)[number] {
  return (
    INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS as readonly InitialCvReviewFieldKey[]
  ).includes(key as InitialCvReviewFieldKey);
}
