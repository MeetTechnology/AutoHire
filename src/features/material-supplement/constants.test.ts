import { describe, expect, it } from "vitest";

import {
  SUPPLEMENT_CATEGORY_LABELS,
  isSupplementCategory,
  toSupplementCategoryLabel,
} from "@/features/material-supplement/constants";

describe("material supplement constants", () => {
  it("accepts all supported supplement categories", () => {
    expect(isSupplementCategory("IDENTITY")).toBe(true);
    expect(isSupplementCategory("EDUCATION")).toBe(true);
    expect(isSupplementCategory("EMPLOYMENT")).toBe(true);
    expect(isSupplementCategory("PROJECT")).toBe(true);
    expect(isSupplementCategory("PATENT")).toBe(true);
    expect(isSupplementCategory("HONOR")).toBe(true);
  });

  it("rejects unsupported categories and unknown values", () => {
    expect(isSupplementCategory("PRODUCT")).toBe(false);
    expect(isSupplementCategory("PAPER")).toBe(false);
    expect(isSupplementCategory("BOOK")).toBe(false);
    expect(isSupplementCategory("CONFERENCE")).toBe(false);
    expect(isSupplementCategory("UNKNOWN")).toBe(false);
    expect(isSupplementCategory(123)).toBe(false);
    expect(isSupplementCategory(null)).toBe(false);
  });

  it("returns stable english labels for supported categories", () => {
    expect(SUPPLEMENT_CATEGORY_LABELS).toEqual({
      IDENTITY: "Identity Documents",
      EDUCATION: "Education Documents",
      EMPLOYMENT: "Employment Documents",
      PROJECT: "Project Documents",
      PATENT: "Patent Documents",
      HONOR: "Honor Documents",
    });

    expect(toSupplementCategoryLabel("IDENTITY")).toBe("Identity Documents");
    expect(toSupplementCategoryLabel("EDUCATION")).toBe("Education Documents");
    expect(toSupplementCategoryLabel("EMPLOYMENT")).toBe(
      "Employment Documents",
    );
    expect(toSupplementCategoryLabel("PROJECT")).toBe("Project Documents");
    expect(toSupplementCategoryLabel("PATENT")).toBe("Patent Documents");
    expect(toSupplementCategoryLabel("HONOR")).toBe("Honor Documents");
  });
});
