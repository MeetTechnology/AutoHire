import { describe, expect, it } from "vitest";

import {
  parseSecondaryFieldSourceValues,
  parseSecondaryVisibleFields,
} from "@/features/analysis/secondary";
import { SECONDARY_FIELD_DEFINITIONS } from "@/features/analysis/secondary-fields";

describe("parseSecondaryVisibleFields", () => {
  it("parses visible NO fields, applies label mapping, and strips placeholder values", () => {
    const fields = parseSecondaryVisibleFields([
      `NO.1###Jane Doe
NO.10###1900-01-01
NO.18###北京大学
NO.15###Doctorate
NO.24###清华大学
NO.29###National talent program (2024)
NO.32###Biochemistry^^^Biotechnology
NO.34###Internal summary`,
    ]);

    expect(fields).toEqual([
      {
        no: 1,
        column: "K",
        label: "*Full Name",
        value: "Jane Doe",
      },
      {
        no: 15,
        column: "Y",
        label: "Highest Degree",
        value: "Doctorate",
      },
      {
        no: 29,
        column: "AM",
        label:
          "Previous Selection for a Chinese Provincial or National Talent Program (include program name and year if applicable)",
        value: "National talent program (2024)",
      },
      {
        no: 32,
        column: "AQ",
        label: "Research Direction",
        value: "Biochemistry\nBiotechnology",
      },
    ]);
  });

  it("excludes explicit Chinese-name fields from applicant-visible definitions", () => {
    expect(SECONDARY_FIELD_DEFINITIONS.map((field) => field.no)).not.toContain(18);
    expect(SECONDARY_FIELD_DEFINITIONS.map((field) => field.no)).not.toContain(24);
  });

  it("merges duplicate NO blocks from multiple generated texts", () => {
    const fields = parseSecondaryVisibleFields([
      `NO.33###2013-2021 Researcher`,
      `NO.33###2021-present Senior researcher`,
    ]);

    expect(fields).toEqual([
      {
        no: 33,
        column: "AR",
        label: "Education and Work Experience",
        value: "2013-2021 Researcher\n\n2021-present Senior researcher",
      },
    ]);
  });

  it("returns source values for empty and duplicated NO blocks", () => {
    const fields = parseSecondaryFieldSourceValues([
      `NO.1###Jane Doe
NO.15###
NO.32###Biochemistry^^^Biotechnology井井井ignored`,
      `NO.32###Genetic engineering`,
    ]);

    expect(fields.get(1)).toBe("Jane Doe");
    expect(fields.get(15)).toBe("");
    expect(fields.get(32)).toBe(
      "Biochemistry\nBiotechnology\n\nGenetic engineering",
    );
  });
});
