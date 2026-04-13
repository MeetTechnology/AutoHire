import { describe, expect, it } from "vitest";

import { parseSecondaryVisibleFields } from "@/features/analysis/secondary";

describe("parseSecondaryVisibleFields", () => {
  it("parses visible NO fields, applies label mapping, and strips placeholder values", () => {
    const fields = parseSecondaryVisibleFields([
      `NO.1###Jane Doe
NO.10###1900-01-01
NO.15###Doctorate
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
});
