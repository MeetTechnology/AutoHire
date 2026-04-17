export const INITIAL_CV_REVIEW_FIELD_ROWS = [
  { key: "year_of_birth", label: "Year of Birth" },
  { key: "doctoral_degree_status", label: "Doctoral Degree Status" },
  { key: "doctoral_graduation_time", label: "Doctoral Graduation Time" },
  { key: "current_title_equivalence", label: "Current Title Equivalence" },
  { key: "current_job_country", label: "Current Job Country" },
  {
    key: "work_experience_2020_present",
    label: "Work Experience (2020–present)",
  },
  { key: "research_area", label: "Research Area" },
] as const;

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
