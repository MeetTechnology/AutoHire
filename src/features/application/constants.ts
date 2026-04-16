export const MATERIAL_CATEGORIES = [
  { key: "IDENTITY", label: "Identity Documents" },
  { key: "EDUCATION", label: "Education Documents" },
  { key: "EMPLOYMENT", label: "Employment Documents" },
  { key: "PROJECT", label: "Project Documents" },
  { key: "PAPER", label: "Paper Publications" },
  { key: "BOOK", label: "Authored Books" },
  { key: "CONFERENCE", label: "Conference Materials" },
  { key: "PATENT", label: "Patent Documents" },
  { key: "HONOR", label: "Honors and Awards" },
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
  "SECONDARY_ANALYZING",
  "SECONDARY_REVIEW",
  "SECONDARY_FAILED",
  "MATERIALS_IN_PROGRESS",
  "SUBMITTED",
  "CLOSED",
] as const;

/** Placeholder inbox for expert feedback; replace with the operations-provided address. */
export const EXPERT_PROGRAM_CONTACT_EMAIL = "screening-contact@example.com";

export const APPLICATION_FLOW_STEPS = [
  {
    label: "Upload CV",
    hint: "Provide identity basics and your latest CV file.",
  },
  {
    label: "Resume screening",
    hint: "Wait for the screening outcome and complete any required follow-up before supporting materials.",
  },
  {
    label: "Additional Information",
    hint: "Upload supporting materials by category (or complete missing fields on the review page when required).",
  },
  {
    label: "Submission Complete",
    hint: "Finalize the package and review the tracking summary.",
  },
] as const;

/** Full journey including Step 0 (program brief on `/apply`) before formal steps. */
export const APPLICATION_FLOW_STEPS_WITH_INTRO = [
  {
    label: "Project Introduction",
    hint: "Review the GESF program scope, eligibility, and process.",
  },
  ...APPLICATION_FLOW_STEPS,
] as const;
