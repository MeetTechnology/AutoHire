import { describe, expect, it } from "vitest";

import {
  buildMissingFieldsFromItemNames,
  buildSupplementalFieldPayload,
  resolveMissingField,
} from "@/lib/resume-analysis/missing-field-registry";

describe("missing field registry", () => {
  it("maps known missing item names to configured fields", () => {
    const field = resolveMissingField("最高学位");

    expect(field.fieldKey).toBe("highest_degree");
    expect(field.label).toBe("Highest Degree");
    expect(field.type).toBe("select");
    expect(field.sourceItemName).toBe("最高学位");
  });

  it("maps English prompt missing item names", () => {
    expect(resolveMissingField("Year of Birth").fieldKey).toBe("birth_date");
    expect(resolveMissingField("Doctoral Graduation Year").fieldKey).toBe(
      "doctoral_graduation_year",
    );
  });

  it("falls back to a generic text field for unknown items", () => {
    const field = resolveMissingField("主要科研平台");

    expect(field.fieldKey).toBe("主要科研平台");
    expect(field.type).toBe("text");
    expect(field.sourceItemName).toBe("主要科研平台");
  });

  it("builds supplemental payloads with both field keys and source item names", () => {
    const missingFields = buildMissingFieldsFromItemNames([
      "最高学位",
      "当前工作单位",
    ]);
    const payload = buildSupplementalFieldPayload(
      {
        highest_degree: "Doctorate",
        current_employer: "Example University",
      },
      missingFields,
    );

    expect(payload.valuesByFieldKey.highest_degree).toBe("Doctorate");
    expect(payload.valuesBySourceItemName["最高学位"]).toBe("Doctorate");
    expect(payload.valuesBySourceItemName["当前工作单位"]).toBe(
      "Example University",
    );
    expect(payload.fieldMeta.highest_degree).toMatchObject({
      sourceItemName: "最高学位",
    });
  });
});
