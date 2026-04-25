export const INITIAL_CV_REVIEW_CONTACT_FIELD_KEYS = [
  "name",
  "personal_email",
  "work_email",
  "phone_number",
] as const;

export const REQUIRED_SCREENING_CONTACT_FIELD_KEYS = [
  "name",
  "personal_email",
] as const;

export const INITIAL_CV_REVIEW_CRITICAL_FIELD_KEYS = [
  "year_of_birth",
  "doctoral_degree_status",
  "doctoral_graduation_time",
  "current_title_equivalence",
  "current_country_of_employment",
  "work_experience_2020_present",
  "research_area",
] as const;

export const INITIAL_CV_REVIEW_FIELD_ROWS = [
  { key: "name", label: "Name" },
  { key: "personal_email", label: "Personal Email" },
  { key: "work_email", label: "Work Email" },
  { key: "phone_number", label: "Phone Number" },
  { key: "year_of_birth", label: "Year of Birth" },
  { key: "doctoral_degree_status", label: "Doctoral Degree Status" },
  { key: "doctoral_graduation_time", label: "Doctoral Graduation Time" },
  { key: "current_title_equivalence", label: "Current Title Equivalence" },
  {
    key: "current_country_of_employment",
    label: "Current Country of Employment",
  },
  {
    key: "work_experience_2020_present",
    label: "Work Experience (2020–present)",
  },
  { key: "research_area", label: "Research Area" },
] as const;

export type InitialCvReviewFieldKey =
  (typeof INITIAL_CV_REVIEW_FIELD_ROWS)[number]["key"];

export function hasInitialCvReviewExtract(
  extractedFields: Record<string, unknown> | null | undefined,
) {
  if (!extractedFields) {
    return false;
  }

  for (const row of INITIAL_CV_REVIEW_FIELD_ROWS) {
    if (Object.prototype.hasOwnProperty.call(extractedFields, row.key)) {
      return true;
    }
  }

  return false;
}

export function getInitialCvReviewFieldValue(
  extractedFields: Record<string, unknown>,
  key: string,
) {
  const raw = extractedFields[key];

  if (raw === null || typeof raw === "undefined") {
    return "";
  }

  return String(raw).trim();
}

export function buildInitialCvReviewExtractionText(
  extractedFields: Record<string, unknown>,
) {
  const rows = INITIAL_CV_REVIEW_FIELD_ROWS.map((row) => {
    const value = getInitialCvReviewFieldValue(extractedFields, row.key);
    const correctionLabel =
      row.key === "work_experience_2020_present"
        ? "Work Experience (2020-Present)"
        : row.label;

    return `- ${correctionLabel}: ${value || "!!!null!!!"}`;
  });

  return ["### 1. Extracted Information", ...rows].join("\n");
}
