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
    expect(result.displaySummary).toContain(
      "Congratulations, you are eligible to apply. We have saved your current progress.",
    );
    expect(result.displaySummary).toContain("certification documents");
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
    expect(result.displaySummary).toContain(
      "Congratulations, you are eligible to apply. We have saved your current progress.",
    );
    expect(result.displaySummary).toContain("certification documents");
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

  it("parses the new three-step contract without treating !!!null!!! as supplemental markers", () => {
    const raw = `### 1. Extracted Information
- Name: Jane Doe
- Personal Email: !!!null!!!
- Work Email: !!!null!!!
- Phone Number: !!!null!!!
- Year of Birth: !!!null!!!
- Doctoral Degree Status: Doctorate completed
- Doctoral Graduation Time: 2019
- Current Title Equivalence: Professor
- Current Country of Employment: United States
- Work Experience (2020-Present): Industry R&D
- Research Area: !!!null!!!

### 2. Analysis Process
[[[Cannot evaluate condition 7 without research area.]]]

### 3. Determination Result
{{{Cannot make a final determination due to missing critical information. Missing fields: Year of Birth, Research Area}}}`;

    const result = normalizeAnalysisResultPayload({ raw_response: raw });

    expect(result.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(result.missingFields.map((f) => f.fieldKey).sort()).toEqual(
      ["birth_date", "research_direction"].sort(),
    );
    expect(result.extractedFields.name).toBe("Jane Doe");
    expect(result.extractedFields.personal_email).toBe("");
    expect(result.extractedFields.work_email).toBe("");
    expect(result.extractedFields.phone_number).toBe("");
    expect(result.extractedFields.year_of_birth).toBe("");
    expect(result.extractedFields.research_area).toBe("");
    expect(result.rawReasoning).toContain("Cannot evaluate condition 7");
  });

  it("parses new-contract eligible, ineligible, bypass, and borderline determinations", () => {
    const base = `### 1. Extracted Information
- Name: Jane Doe
- Personal Email: jane.doe@example.com
- Work Email: jane.doe@university.edu
- Phone Number: +1 555 010 2000
- Year of Birth: 1990
- Doctoral Degree Status: PhD
- Doctoral Graduation Time: 2018
- Current Title Equivalence: AP
- Current Country of Employment: UK
- Work Experience (2020-Present): Lab
- Research Area: AI

### 2. Analysis Process
[[[ok]]]

### 3. Determination Result
`;

    const eligible = normalizeAnalysisResultPayload({
      raw_response: `${base}{{{After evaluation, your qualifications meet the basic application requirements of this talent program}}}`,
    });
    expect(eligible.eligibilityResult).toBe("ELIGIBLE");
    expect(eligible.reasonText).toBeNull();
    expect(eligible.extractedFields.personal_email).toBe("jane.doe@example.com");
    expect(eligible.extractedFields.work_email).toBe("jane.doe@university.edu");
    expect(eligible.extractedFields.current_country_of_employment).toBe("UK");

    const ineligible = normalizeAnalysisResultPayload({
      raw_response: `${base}{{{We regret to inform you that your qualifications do not meet the basic application requirements of this talent program. The specific reasons are: Area mismatch. If you have any questions, please feel free to contact us at any time by email, WeChat, phone, or WhatsApp}}}`,
    });
    expect(ineligible.eligibilityResult).toBe("INELIGIBLE");
    expect(ineligible.reasonText).toBe("Area mismatch");

    const bypass = normalizeAnalysisResultPayload({
      raw_response: `${base}{{{Only eligible to apply as an overseas postdoctoral researcher coming to work in China}}}`,
    });
    expect(bypass.eligibilityResult).toBe("ELIGIBLE");
    expect(bypass.reasonText).toContain("overseas postdoctoral");

    const borderline = normalizeAnalysisResultPayload({
      raw_response: `${base}{{{Cannot make a final determination. The exact birth year is missing, and the inferred birth year (1992) is within 2 years of the threshold (1990), requiring further confirmation.}}}`,
    });
    expect(borderline.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(borderline.missingFields.map((f) => f.fieldKey)).toEqual(["birth_date"]);
  });

  it("does not infer missing contact fields as critical when the determination says critical information is missing", () => {
    const raw = `### 1. Extracted Information
- Name: !!!null!!!
- Personal Email: !!!null!!!
- Work Email: !!!null!!!
- Phone Number: !!!null!!!
- Year of Birth: 1990
- Doctoral Degree Status: !!!null!!!
- Doctoral Graduation Time: !!!null!!!
- Current Title Equivalence: Associate Professor
- Current Country of Employment: United States
- Work Experience (2020-Present): 2020-Present, United States, Example University, Associate Professor
- Research Area: AI

### 2. Analysis Process
[[[The contact details are not required for eligibility, but the doctoral status is still missing.]]]

### 3. Determination Result
{{{Cannot make a final determination due to missing critical information. Missing fields: Doctoral Degree Status}}}`;

    const result = normalizeAnalysisResultPayload({ raw_response: raw });

    expect(result.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(result.missingFields.map((field) => field.fieldKey)).toEqual([
      "doctoral_degree_status",
    ]);
  });

  it("maps legacy Current Job Country to the new employment country key", () => {
    const result = normalizeAnalysisResultPayload({
      raw_response: `### 1. Extracted Information
- Name: Jane Doe
- Personal Email: jane.doe@example.com
- Work Email: !!!null!!!
- Phone Number: !!!null!!!
- Year of Birth: 1990
- Doctoral Degree Status: PhD
- Doctoral Graduation Time: 2018
- Current Title Equivalence: Associate Professor
- Current Job Country: United States
- Work Experience (2020-Present): Lab
- Research Area: AI

### 2. Analysis Process
[[[ok]]]

### 3. Determination Result
{{{After evaluation, your qualifications meet the basic application requirements of this talent program}}}`,
    });

    expect(result.extractedFields.current_country_of_employment).toBe(
      "United States",
    );
    expect(result.extractedFields.current_job_country).toBeUndefined();
  });
});
