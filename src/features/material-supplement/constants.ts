import type { SupplementCategory } from "@/features/material-supplement/types";

export const SUPPLEMENT_CATEGORIES = [
  { key: "IDENTITY", label: "Identity Documents" },
  { key: "EDUCATION", label: "Education Documents" },
  { key: "EMPLOYMENT", label: "Employment Documents" },
  { key: "PROJECT", label: "Project Documents" },
  { key: "PATENT", label: "Patent Documents" },
  { key: "HONOR", label: "Honor Documents" },
] as const satisfies ReadonlyArray<{
  key: SupplementCategory;
  label: string;
}>;

export const SUPPORTED_SUPPLEMENT_CATEGORIES = SUPPLEMENT_CATEGORIES.map(
  ({ key }) => key,
);

export const SUPPLEMENT_CATEGORY_LABELS: Record<SupplementCategory, string> = {
  IDENTITY: "Identity Documents",
  EDUCATION: "Education Documents",
  EMPLOYMENT: "Employment Documents",
  PROJECT: "Project Documents",
  PATENT: "Patent Documents",
  HONOR: "Honor Documents",
};

export const SUPPLEMENT_REVIEW_MAX_ROUNDS = 3;
export const SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH = 10;

export const SUPPLEMENT_PAGE_PATH = "/apply/supplement";
export const SUPPLEMENT_HISTORY_PAGE_PATH = "/apply/supplement/history";

export function isSupplementCategory(
  value: unknown,
): value is SupplementCategory {
  return (
    typeof value === "string" &&
    SUPPORTED_SUPPLEMENT_CATEGORIES.includes(value as SupplementCategory)
  );
}

export function assertSupplementCategory(
  value: unknown,
): asserts value is SupplementCategory {
  if (!isSupplementCategory(value)) {
    throw new Error(`Unsupported supplement category: ${String(value)}`);
  }
}

export function toSupplementCategoryLabel(category: SupplementCategory) {
  return SUPPLEMENT_CATEGORY_LABELS[category];
}
