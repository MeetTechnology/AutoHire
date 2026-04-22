export type VisibleExtractedFieldDefinition = {
  no: number;
  label: string;
  aliases?: string[];
};

export type VisibleExtractedField = {
  no: number;
  label: string;
  value: string;
};

export const HIDDEN_FIELD_NOS = new Set([
  8,
  9,
  10,
  11,
  18,
  24,
  28,
  30,
  31,
  34,
]);

export const EXTRACTED_FIELD_DEFINITIONS: VisibleExtractedFieldDefinition[] = [
  { no: 1, label: "*Full Name", aliases: ["*姓名", "姓名", "name"] },
  { no: 2, label: "Gender", aliases: ["gender"] },
  {
    no: 3,
    label: "*Date of Birth (use 1900-01-01 if unavailable)",
    aliases: ["*出生日期（无则1900-01-01）", "出生日期", "birth_date", "birthDate"],
  },
  { no: 4, label: "Nationality / Ethnic Group", aliases: ["国籍", "nationality"] },
  { no: 5, label: "Country of Birth", aliases: ["birth_country", "birthCountry"] },
  {
    no: 6,
    label: "*Source Country / Region",
    aliases: ["来源地/国", "来源地", "source_country", "sourceCountry"],
  },
  { no: 7, label: "Ethnic Chinese", aliases: ["ethnic_chinese", "ethnicChinese"] },
  {
    no: 12,
    label: "Personal Email (Unique)",
    aliases: ["个人邮箱", "personal_email", "personalEmail"],
  },
  {
    no: 13,
    label: "Work Email (Unique)",
    aliases: ["工作邮箱", "work_email", "workEmail"],
  },
  {
    no: 14,
    label: "Mobile Number (Unique)",
    aliases: ["手机号", "phone_number", "phoneNumber"],
  },
  {
    no: 15,
    label: "Highest Degree",
    aliases: ["最高学历", "highest_degree", "highestDegree"],
  },
  {
    no: 16,
    label: "Doctoral Graduation Date",
    aliases: ["doctoral_graduation_date", "doctoralGraduationDate"],
  },
  {
    no: 17,
    label: "Doctoral Graduation Country",
    aliases: ["doctoral_graduation_country", "doctoralGraduationCountry"],
  },
  {
    no: 18,
    label: "Doctoral Institution (Chinese)",
    aliases: ["doctoral_school_cn", "doctoralSchoolCn"],
  },
  {
    no: 19,
    label: "Doctoral Institution (English)",
    aliases: ["doctoral_school_en", "doctoralSchoolEn"],
  },
  { no: 20, label: "Doctoral Major", aliases: ["doctoral_major", "doctoralMajor"] },
  {
    no: 21,
    label: "Doctoral Institution QS Ranking",
    aliases: ["doctoral_qs_rank", "doctoralQsRank"],
  },
  { no: 22, label: "Current Title", aliases: ["current_title", "currentTitle"] },
  { no: 23, label: "Title in English", aliases: ["current_title_en", "currentTitleEn"] },
  {
    no: 24,
    label: "Current Employer (Chinese)",
    aliases: [
      "当前工作单位",
      "就职单位中文",
      "current_employer",
      "currentEmployer",
      "employer_cn",
      "employerCn",
    ],
  },
  { no: 25, label: "Current Employer (English)", aliases: ["employer_en", "employerEn"] },
  {
    no: 26,
    label: "Current Employer QS Ranking",
    aliases: ["current_qs_rank", "currentQsRank"],
  },
  {
    no: 27,
    label: "Representative Honors or Titles",
    aliases: ["representative_honors", "representativeHonors"],
  },
  {
    no: 29,
    label:
      "Previous Selection for a Chinese Provincial or National Talent Program (include program name and year if applicable)",
    aliases: ["（省/国）入选信息", "省级或国家级人才计划", "talent_plan_history", "talentPlanHistory"],
  },
  { no: 32, label: "Research Direction", aliases: ["research_direction", "researchDirection"] },
  { no: 33, label: "Education and Work Experience", aliases: ["career_history", "careerHistory"] },
  { no: 35, label: "Personal Summary", aliases: ["profile_summary", "profileSummary"] },
  { no: 36, label: "Project Experience", aliases: ["project_experience", "projectExperience"] },
  { no: 37, label: "Publications", aliases: ["papers"] },
  {
    no: 38,
    label:
      "Top-Tier Journal Details (journals with an impact factor greater than 30)",
    aliases: ["top_journal_details", "topJournalDetails"],
  },
  { no: 39, label: "Patents", aliases: ["patents"] },
  { no: 40, label: "Awards, Honors, and Other Achievements", aliases: ["awards_and_others", "awardsAndOthers"] },
  { no: 41, label: "Chinese Language Ability", aliases: ["中文能力", "chinese_proficiency", "chineseProficiency"] },
];

export function buildLookupKeys(label: string, aliases?: string[]) {
  const normalized = new Set<string>([
    label,
    label.replace(/^\*/, ""),
    label.replace(/（.*?）/g, ""),
    label.replace(/^\*/, "").replace(/（.*?）/g, ""),
    label.replace(/\(.*?\)/g, ""),
    label.replace(/^\*/, "").replace(/\(.*?\)/g, ""),
    ...(aliases ?? []),
  ]);

  return [...normalized];
}

export function normalizeDisplayValue(value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeDisplayValue(item))
      .filter(Boolean)
      .join(" / ");
  }

  if (typeof value === "object") {
    if ("value" in value && typeof value.value !== "undefined") {
      return normalizeDisplayValue(value.value);
    }

    if ("text" in value && typeof value.text !== "undefined") {
      return normalizeDisplayValue(value.text);
    }

    return "";
  }

  const text = String(value).trim();

  if (
    !text ||
    text === "1900-01-01" ||
    text === "1900/01/01" ||
    text === "无+客户号"
  ) {
    return "";
  }

  return text;
}

function translateSharedValue(value: string) {
  const normalized = value.trim().toLowerCase();

  const translations: Record<string, string> = {
    女: "Female",
    男: "Male",
    是: "Yes",
    否: "No",
    本科: "Bachelor's",
    硕士: "Master's",
    博士: "Doctorate",
    其他: "Other",
    待确认: "To be confirmed",
    讲师: "Lecturer",
  };

  if (translations[value]) {
    return translations[value];
  }

  const normalizedTranslations: Record<string, string> = {
    female: "Female",
    male: "Male",
    yes: "Yes",
    no: "No",
    bachelor: "Bachelor's",
    "bachelor's": "Bachelor's",
    master: "Master's",
    "master's": "Master's",
    doctorate: "Doctorate",
    phd: "Doctorate",
    other: "Other",
  };

  return normalizedTranslations[normalized] ?? value;
}

export function translateVisibleFieldValue(no: number, value: string) {
  if (!value.trim()) {
    return value;
  }

  if ([2, 7, 15, 22, 41].includes(no)) {
    return value
      .split(" / ")
      .map((part) => translateSharedValue(part))
      .join(" / ");
  }

  return value;
}

export function getVisibleExtractedFieldDefinitions() {
  return EXTRACTED_FIELD_DEFINITIONS.filter(
    (definition) => !HIDDEN_FIELD_NOS.has(definition.no),
  );
}

export function getRawReasoning(
  extractedFields: Record<string, unknown> | null | undefined,
) {
  const value = extractedFields?.__rawReasoning;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildVisibleExtractedFieldSummary(
  extractedFields: Record<string, unknown>,
) {
  return getVisibleExtractedFieldDefinitions()
    .map<VisibleExtractedField | null>((definition) => {
      const lookupKeys = buildLookupKeys(definition.label, definition.aliases);
      const matchedKey = lookupKeys.find((key) =>
        Object.prototype.hasOwnProperty.call(extractedFields, key),
      );

      if (!matchedKey) {
        return null;
      }

      const value = normalizeDisplayValue(extractedFields[matchedKey]);

      if (!value) {
        return null;
      }

      return {
        no: definition.no,
        label: definition.label,
        value: translateVisibleFieldValue(definition.no, value),
      };
    })
    .filter((item): item is VisibleExtractedField => item !== null);
}
