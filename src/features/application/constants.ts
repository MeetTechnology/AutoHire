export const MATERIAL_CATEGORIES = [
  { key: "IDENTITY", label: "Identity Documents" },
  { key: "EMPLOYMENT", label: "Employment Documents" },
  { key: "EDUCATION", label: "Education Documents" },
  { key: "HONOR", label: "Honors and Awards" },
  { key: "PATENT", label: "Patent Documents" },
  { key: "PROJECT", label: "Project Documents" },
] as const;

export const APPLICATION_STATUSES = [
  "INIT",
  "INTRO_VIEWED",
  "CV_UPLOADED",
  "CV_ANALYZING",
  "INFO_REQUIRED",
  "REANALYZING",
  "INELIGIBLE",
  "ELIGIBLE",
  "MATERIALS_IN_PROGRESS",
  "SUBMITTED",
  "CLOSED",
] as const;

export const APPLICATION_FLOW_STEPS = [
  {
    label: "Resume",
    hint: "Upload your CV for the initial review",
  },
  {
    label: "Review",
    hint: "Read the assessment and complete missing fields if needed",
  },
  {
    label: "Materials",
    hint: "Upload supporting documents by category",
  },
  {
    label: "Submit",
    hint: "Confirm the final package",
  },
] as const;
