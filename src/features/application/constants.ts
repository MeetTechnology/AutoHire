export const MATERIAL_CATEGORIES = [
  { key: "IDENTITY", label: "身份证明" },
  { key: "EMPLOYMENT", label: "工作证明" },
  { key: "EDUCATION", label: "学历证明" },
  { key: "HONOR", label: "荣誉证明" },
  { key: "PATENT", label: "专利证明" },
  { key: "PROJECT", label: "项目证明" },
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
