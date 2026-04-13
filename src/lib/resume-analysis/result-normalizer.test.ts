import { describe, expect, it } from "vitest";

import { normalizeAnalysisResultPayload } from "@/lib/resume-analysis/result-normalizer";

describe("normalizeAnalysisResultPayload", () => {
  it("parses eligible results from the English formal decision block", () => {
    const result = normalizeAnalysisResultPayload({
      raw_response:
        "[[[Assessment: meets threshold]]]\n{{{After evaluation, your qualifications meet the basic application requirements of this talent program}}}",
      parsed_result: {
        extracted_fields: {
          name: "Jane Doe",
        },
      },
    });

    expect(result.eligibilityResult).toBe("ELIGIBLE");
    expect(result.displaySummary).toContain("meets the basic application requirements");
    expect(result.reasonText).toBeNull();
    expect(result.rawReasoning).toContain("meets threshold");
  });

  it("parses ineligible English results and extracts the reason before the contact clause", () => {
    const result = normalizeAnalysisResultPayload({
      raw_response:
        "[[[Assessment: below threshold]]]\n{{{We regret to inform you that your qualifications do not meet the basic application requirements of this talent program. The specific reasons are: The research area is not applicable to manufacturing or technology R&D. If you have any questions, please feel free to contact us at any time by email, WeChat, phone, or WhatsApp}}}",
    });

    expect(result.eligibilityResult).toBe("INELIGIBLE");
    expect(result.reasonText).toBe(
      "The research area is not applicable to manufacturing or technology R&D",
    );
  });

  it("parses eligible results from the formal decision block", () => {
    const result = normalizeAnalysisResultPayload({
      raw_response:
        "[[[姓名：Jane Doe]]]\n{{{经过判断，您的资历符合本次人才项目的基本申请要求}}}",
      parsed_result: {
        extracted_fields: {
          "*姓名": "Jane Doe",
        },
      },
    });

    expect(result.eligibilityResult).toBe("ELIGIBLE");
    expect(result.displaySummary).toContain("meets the basic application requirements");
    expect(result.reasonText).toBeNull();
    expect(result.rawReasoning).toContain("姓名：Jane Doe");
  });

  it("parses ineligible results and extracts the explicit reason", () => {
    const result = normalizeAnalysisResultPayload({
      raw_response:
        "[[[综合判断：当前成果未达到要求]]]\n{{{很遗憾，您的资历不符合本次人才项目的基本申请要求，以下是具体原因：当前成果未达到要求，若您有疑问，可随时通过邮件、微信、电话、WhatsApp联系我们}}}",
    });

    expect(result.eligibilityResult).toBe("INELIGIBLE");
    expect(result.reasonText).toBe("当前成果未达到要求");
  });

  it("prefers missing items over final verdicts", () => {
    const result = normalizeAnalysisResultPayload({
      raw_response:
        "[[[综合判断：仍缺关键信息]]]\n{{{经过判断，您的资历符合本次人才项目的基本申请要求}}}\n!!!出生年份!!!\n!!!最高学位!!!\n!!!出生年份!!!",
    });

    expect(result.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(result.missingFields).toHaveLength(2);
    expect(result.missingFields.map((field) => field.sourceItemName)).toEqual([
      "出生年份",
      "最高学位",
    ]);
  });

  it("prefers English missing markers and maps them to supplemental fields", () => {
    const result = normalizeAnalysisResultPayload({
      raw_response:
        "[[[Notes: cannot finalize]]]\n{{{After evaluation, your qualifications meet the basic application requirements of this talent program}}}\n!!!Year of Birth!!!\n!!!Highest Degree!!!\n!!!Year of Birth!!!",
    });

    expect(result.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(result.missingFields).toHaveLength(2);
    expect(result.missingFields.map((field) => field.fieldKey)).toEqual([
      "birth_date",
      "highest_degree",
    ]);
  });

  it("enriches structured missingFields with the latest registry configuration", () => {
    const result = normalizeAnalysisResultPayload({
      eligibilityResult: "INSUFFICIENT_INFO",
      displaySummary: "Missing information.",
      missingFields: [
        {
          fieldKey: "highest_degree",
          sourceItemName: "最高学位",
          label: "最高学历",
          type: "select",
          required: true,
          options: ["本科", "硕士", "博士", "其他"],
        },
      ],
    });

    expect(result.missingFields[0]?.options?.[3]).toBe("Other");
    expect(result.missingFields[0]?.selectOtherDetails?.detailFieldKey).toBe(
      "highest_degree_other",
    );
  });
});
