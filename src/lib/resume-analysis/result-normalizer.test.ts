import { describe, expect, it } from "vitest";

import {
  normalizeAnalysisResultPayload,
  normalizeExtractionResultPayload,
} from "@/lib/resume-analysis/result-normalizer";

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
    expect(eligible.extractedFields.personal_email).toBe(
      "jane.doe@example.com",
    );
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
    expect(borderline.missingFields.map((f) => f.fieldKey)).toEqual([
      "birth_date",
    ]);

    const ambiguousWorkExperience = normalizeAnalysisResultPayload({
      raw_response: `${base}{{{Cannot determine due to ambiguous work-experience dates}}}`,
    });
    expect(ambiguousWorkExperience.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(ambiguousWorkExperience.displaySummary).toBe(
      "Cannot determine due to ambiguous work-experience dates",
    );
    expect(ambiguousWorkExperience.reasonText).toBe(
      "Cannot determine due to ambiguous work-experience dates",
    );
    expect(ambiguousWorkExperience.missingFields.map((f) => f.fieldKey)).toEqual(
      ["work_experience_since_2020"],
    );

    const borderlineInferred = normalizeAnalysisResultPayload({
      raw_response: `${base}{{{Cannot determine due to borderline inferred birth year}}}`,
    });
    expect(borderlineInferred.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(borderlineInferred.missingFields.map((f) => f.fieldKey)).toEqual([
      "birth_date",
    ]);

    const postdocSpecialTrack = normalizeAnalysisResultPayload({
      raw_response: `${base}{{{Only eligible for the Postdoctoral Special Track: Overseas postdoctoral researchers returning to China for work}}}`,
    });
    expect(postdocSpecialTrack.eligibilityResult).toBe("ELIGIBLE");
    expect(postdocSpecialTrack.reasonText).toContain("Postdoctoral Special Track");

    const youngResearcherSpecialTrack = normalizeAnalysisResultPayload({
      raw_response: `${base}{{{Only eligible for the Postdoctoral Special Track: Overseas doctoral graduates returning to China to conduct postdoctoral research}}}`,
    });
    expect(youngResearcherSpecialTrack.eligibilityResult).toBe("ELIGIBLE");
    expect(youngResearcherSpecialTrack.reasonText).toContain(
      "Overseas doctoral graduates",
    );

    const youngResearcherSpecialTrackTypo = normalizeAnalysisResultPayload({
      raw_response: `${base}{{{Only eligible for or the Postdoctoral Special Track: Overseas doctoral graduates returning to China to conduct postdoctoral research}}}`,
    });
    expect(youngResearcherSpecialTrackTypo.eligibilityResult).toBe("ELIGIBLE");

    const ineligibleSpecialTrackAmbiguous = normalizeAnalysisResultPayload({
      raw_response: `${base}{{{Not eligible, but special-track eligibility cannot be determined due to ambiguous work-experience dates}}}`,
    });
    expect(ineligibleSpecialTrackAmbiguous.eligibilityResult).toBe("INELIGIBLE");
    expect(ineligibleSpecialTrackAmbiguous.reasonText).toContain(
      "special-track eligibility cannot be determined",
    );
  });

  it("maps ambiguous work-experience dates in the two-step judgment contract", () => {
    const result = normalizeAnalysisResultPayload({
      parsed_result: {
        text: `### 1. Analysis Process
[[[Known facts: born 1981; PhD completed; currently in USA as Professor. The current role start/end dates are unclear, so overseas tenure cannot be verified.]]]

### 2. Determination Result
{{{Cannot determine due to ambiguous work-experience dates}}}`,
      },
    });

    expect(result.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(result.reasonText).toBe(
      "Cannot determine due to ambiguous work-experience dates",
    );
    expect(result.missingFields.map((field) => field.fieldKey)).toEqual([
      "work_experience_since_2020",
    ]);
    expect(result.rawReasoning).toContain("overseas tenure cannot be verified");
  });

  it("parses the remaining prompt contract outputs in the two-step judgment path", () => {
    const twoStepJudgment = (determination: string) =>
      normalizeAnalysisResultPayload({
        parsed_result: {
          text: `### 1. Analysis Process
[[[Judgment reasoning.]]]

### 2. Determination Result
{{{${determination}}}}`,
        },
      });

    const borderlineInferred = twoStepJudgment(
      "Cannot determine due to borderline inferred birth year",
    );
    expect(borderlineInferred.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(borderlineInferred.missingFields.map((field) => field.fieldKey)).toEqual(
      ["birth_date"],
    );

    const missingCritical = twoStepJudgment(
      "Cannot make a final determination due to missing critical information. Missing fields: Doctoral Degree Status",
    );
    expect(missingCritical.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(missingCritical.missingFields.map((field) => field.fieldKey)).toEqual(
      ["doctoral_degree_status"],
    );

    const postdocSpecialTrack = twoStepJudgment(
      "Only eligible for the Postdoctoral Special Track: Overseas postdoctoral researchers returning to China for work",
    );
    expect(postdocSpecialTrack.eligibilityResult).toBe("ELIGIBLE");
    expect(postdocSpecialTrack.reasonText).toContain("Postdoctoral Special Track");

    const ineligibleSpecialTrackAmbiguous = twoStepJudgment(
      "Not eligible, but special-track eligibility cannot be determined due to ambiguous work-experience dates",
    );
    expect(ineligibleSpecialTrackAmbiguous.eligibilityResult).toBe("INELIGIBLE");
    expect(ineligibleSpecialTrackAmbiguous.reasonText).toContain(
      "special-track eligibility cannot be determined",
    );
  });

  it("preserves extraction fields when the judgment uses the two-step contract", () => {
    const result = normalizeAnalysisResultPayload({
      extraction_parsed_result: {
        extracted_fields: {
          name: "Jane Doe",
          personal_email: "jane.doe@example.com",
          year_of_birth: "1989",
          current_title_equivalence: "Associate Professor",
          current_job_country: "United States",
          research_area: "Artificial Intelligence",
        },
      },
      parsed_result: {
        text: `### 1. Analysis Process
[[[The scholar meets the requirements via the title bypass.]]]

### 2. Determination Result
{{{After evaluation, your qualifications meet the basic application requirements of this talent program}}}`,
      },
    });

    expect(result.eligibilityResult).toBe("ELIGIBLE");
    expect(result.extractedFields).toMatchObject({
      name: "Jane Doe",
      personal_email: "jane.doe@example.com",
      year_of_birth: "1989",
      current_title_equivalence: "Associate Professor",
      current_country_of_employment: "United States",
      research_area: "Artificial Intelligence",
    });
    expect(result.rawReasoning).toContain("title bypass");
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

describe("normalizeExtractionResultPayload", () => {
  it("parses the complete extraction contract and preserves multiline fields", () => {
    const result = normalizeExtractionResultPayload({
      text: `### 1. Extracted Information
- Name: DR. DAMIEN PASSEMIER
- Personal Email: damien.passemier@gmail.com
- Work Email: !!!null!!!
- Phone Number: (+852) 5169 8244

- Year of Birth: 1984
- Year of Birth Source: Inferred from bachelor's graduation year

- Highest Degree Level: Doctorate or doctoral-equivalent
- Education History:
  1. **2003 - 2006**: France | University François Rabelais, Tours | Mathematics | BSc in Mathematics
  2. **2012 - 2014**: France | University of Rennes 1 | Statistics | PhD in Statistics

- Doctoral Degree Status: Yes, obtained
- Doctoral Graduation Time: 2014
- Doctoral Degree Institution and Country/Region: University of Rennes 1 | France

- Current Raw Title:
  1. Hong Kong | Alternative Data Limited (Measurable AI) | Chief Data Scientist
- Current Title Equivalence: Enterprise senior R&D/technical position
- Current Employment Country/Region:
  1. Alternative Data Limited (Measurable AI) | Hong Kong
- Current Employment Nature:
  1. Hong Kong | Alternative Data Limited (Measurable AI) | Chief Data Scientist | 无
- Current Employment Formality Judgment: Formal but full-time unclear

- Complete Work Experience Timeline:
  1. **Aug 2017 - Nov 2020**: Hong Kong | Tas Alpha | !!!null!!! | Senior Data Scientist | 无
  2. **Jan 2021 - Present**: Hong Kong | Alternative Data Limited (Measurable AI) | !!!null!!! | Chief Data Scientist | 无
- Complete Overseas Work Experience Timeline:
  1. **Jan 2021 - Present**: Hong Kong | Alternative Data Limited (Measurable AI) | !!!null!!! | Chief Data Scientist | 无
- Overseas Enterprise Work Experience Timeline:
  1. **Jan 2021 - Present**: Hong Kong | Alternative Data Limited (Measurable AI) | !!!null!!! | Chief Data Scientist | 无

- Postdoctoral Experience Timeline: !!!null!!!
- Overseas Postdoctoral Experience Timeline: !!!null!!!

- Work Experience Date Ambiguity: Yes
- Work Experience Date Ambiguity Notes: Some roles lack exact days.

- Research Area:
  - High-dimensional statistics
  - Random matrix theory
  - Statistical inference
- Applied/Industrial Relevance: Clear applied relevance in alternative data analytics.`,
    });

    expect(result.extractedFields).toMatchObject({
      name: "DR. DAMIEN PASSEMIER",
      work_email: "",
      year_of_birth: "1984",
      year_of_birth_source: "Inferred from bachelor's graduation year",
      highest_degree_level: "Doctorate or doctoral-equivalent",
      doctoral_degree_status: "Yes, obtained",
      current_country_of_employment:
        "1. Alternative Data Limited (Measurable AI) | Hong Kong",
      work_experience_date_ambiguity: "Yes",
    });
    expect(result.extractedFields.education_history).toContain(
      "2. 2012 - 2014",
    );
    expect(result.extractedFields.work_experience_2020_present).toContain(
      "2. Jan 2021 - Present",
    );
    expect(result.extractedFields.research_area).toBe(
      "- High-dimensional statistics\n  - Random matrix theory\n  - Statistical inference",
    );
    expect(Object.keys(result.extractedFields)).toHaveLength(25);
  });

  it("keeps legacy field labels compatible with the complete contract", () => {
    const result = normalizeExtractionResultPayload({
      text: `### 1. Extracted Information
- Current Country of Employment: United States
- Work Experience (2020-Present): Industry R&D`,
    });

    expect(result.extractedFields.current_country_of_employment).toBe(
      "United States",
    );
    expect(result.extractedFields.work_experience_2020_present).toBe(
      "Industry R&D",
    );
  });
});
