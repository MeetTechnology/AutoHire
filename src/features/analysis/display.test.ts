import { describe, expect, it } from "vitest";

import {
  buildVisibleExtractedFieldSummary,
  getRawReasoning,
} from "@/features/analysis/display";

describe("buildVisibleExtractedFieldSummary", () => {
  it("hides internal fields, renames talent plan history, and strips placeholder values", () => {
    const fields = buildVisibleExtractedFieldSummary({
      "*姓名": "Jane Doe",
      "证件过期日（无则1900-01-01）": "1900-01-01",
      "（省/国）入选信息": "National talent program (2020)",
      "备注": "内部备注",
      "*出生日期（无则1900-01-01）": "1900-01-01",
      "就职单位中文": "Example University",
    });

    expect(fields.map((field) => field.label)).toEqual([
      "*Full Name",
      "Previous Selection for a Chinese Provincial or National Talent Program (include program name and year if applicable)",
    ]);
    expect(fields.some((field) => field.label === "备注")).toBe(false);
    expect(
      fields.some(
        (field) => field.label === "*Date of Birth (use 1900-01-01 if unavailable)",
      ),
    ).toBe(false);
  });

  it("returns raw reasoning only when it is a non-empty string", () => {
    expect(
      getRawReasoning({
        __rawReasoning: "Detailed analysis content",
      }),
    ).toBe("Detailed analysis content");
    expect(getRawReasoning({ __rawReasoning: "   " })).toBeNull();
    expect(getRawReasoning({})).toBeNull();
  });
});
