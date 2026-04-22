import type { MissingField } from "@/features/analysis/types";

type MissingFieldConfig = Omit<MissingField, "sourceItemName"> & {
  aliases?: string[];
};

export function enrichMissingFieldWithRegistry(field: MissingField): MissingField {
  const config = MISSING_FIELD_REGISTRY[field.fieldKey];

  if (!config) {
    return field;
  }

  return {
    ...field,
    label: config.label,
    type: config.type,
    required: config.required,
    helpText: config.helpText,
    options: config.options,
    defaultValue: config.defaultValue ?? field.defaultValue,
    selectOtherDetails: config.selectOtherDetails ?? field.selectOtherDetails,
    sourceItemName: field.sourceItemName,
  };
}

export function enrichMissingFieldsWithRegistry(
  fields: MissingField[],
): MissingField[] {
  return fields.map(enrichMissingFieldWithRegistry);
}

const MISSING_FIELD_REGISTRY: Record<string, MissingFieldConfig> = {
  doctoral_degree_status: {
    fieldKey: "doctoral_degree_status",
    label: "Doctoral Degree Status",
    type: "text",
    required: true,
    helpText:
      "Describe whether you hold a doctorate, are a candidate, or other status relevant to the program.",
    aliases: ["Doctoral Degree Status"],
  },
  highest_degree: {
    fieldKey: "highest_degree",
    label: "Highest Degree",
    type: "select",
    required: true,
    options: ["Bachelor's degree", "Master's degree", "Doctorate", "Other"],
    selectOtherDetails: {
      triggerOption: "Other",
      detailFieldKey: "highest_degree_other",
      detailLabel: "Please specify your highest degree",
      detailPlaceholder: "e.g. professional diploma, equivalent qualification",
    },
    helpText: "Please provide the highest degree you have completed.",
    aliases: [
      "最高学位",
      "最高学历",
      "Highest Degree",
      "Doctoral Degree or Equivalent",
    ],
  },
  current_employer: {
    fieldKey: "current_employer",
    label: "Current Employer",
    type: "text",
    required: true,
    helpText: "Please provide the organization where you are currently employed.",
    aliases: [
      "当前工作单位",
      "现任单位",
      "就职单位中文",
      "工作单位",
      "Current Employer",
      "Current Institution",
    ],
  },
  birth_date: {
    fieldKey: "birth_date",
    label: "Date of Birth",
    type: "date",
    required: true,
    helpText: "Please enter your actual date of birth.",
    aliases: ["出生日期", "出生年份", "Year of Birth", "Date of Birth"],
  },
  doctoral_graduation_year: {
    fieldKey: "doctoral_graduation_year",
    label: "Doctoral Graduation Year (and month if after 2020)",
    type: "text",
    required: true,
    helpText:
      "Provide the year you completed your doctorate; include month if graduation was after 2020.",
    aliases: [
      "Doctoral Graduation Year",
      "Doctorate Graduation Year",
      "Doctoral Graduation Time",
    ],
  },
  current_job_title: {
    fieldKey: "current_job_title",
    label: "Current Full-Time Job Title",
    type: "text",
    required: true,
    helpText: "Your official title as shown on your CV (before category mapping).",
    aliases: [
      "Current Full-Time Job Title",
      "Current Job Title",
      "Current Title",
      "Current Title Equivalence",
    ],
  },
  work_experience_since_2020: {
    fieldKey: "work_experience_since_2020",
    label: "Work Experience (2020–present)",
    type: "textarea",
    required: true,
    helpText:
      "List roles from 2020 to present with approximate dates, country, institution, and title.",
    aliases: [
      "Work Experience from 2020 to the Present",
      "Work Experience from 2020 to Present",
      "Work Experience 2020 to Present",
      "Work Experience (2020-Present)",
    ],
  },
  source_country: {
    fieldKey: "source_country",
    label: "Source Country / Region",
    type: "text",
    required: true,
    aliases: [
      "来源地/国",
      "来源国家",
      "来源地",
      "Country Where Current Full-Time Job Is Located",
      "Country of Current Full-Time Job",
      "Current Job Country",
    ],
  },
  nationality: {
    fieldKey: "nationality",
    label: "Nationality / Ethnic Group",
    type: "text",
    required: true,
    aliases: ["国籍/族群", "国籍"],
  },
  name: {
    fieldKey: "name",
    label: "Name",
    type: "text",
    required: true,
    helpText: "Please provide your full name exactly as it should be used for contact.",
    aliases: ["姓名", "*姓名", "*Full Name", "Full Name"],
  },
  personal_email: {
    fieldKey: "personal_email",
    label: "Personal Email",
    type: "text",
    required: true,
    aliases: ["个人邮箱", "个人邮箱（唯一）", "Personal Email", "Personal Email (Unique)"],
  },
  work_email: {
    fieldKey: "work_email",
    label: "Work Email",
    type: "text",
    required: false,
    aliases: ["工作邮箱", "工作邮箱（唯一）"],
  },
  phone_number: {
    fieldKey: "phone_number",
    label: "Phone Number",
    type: "text",
    required: true,
    aliases: [
      "手机号",
      "手机号（唯一）",
      "联系电话",
      "Phone Number",
      "Mobile Number",
      "Mobile Number (Unique)",
    ],
  },
  chinese_proficiency: {
    fieldKey: "chinese_proficiency",
    label: "Chinese Language Ability",
    type: "radio",
    required: true,
    options: ["是", "否"],
    aliases: ["能否说中文", "是否会中文", "中文能力"],
  },
  talent_plan_history: {
    fieldKey: "talent_plan_history",
    label:
      "Previous Selection for a Chinese Provincial or National Talent Program",
    type: "textarea",
    required: false,
    helpText: "If applicable, include the program name and year.",
    aliases: ["（省/国）入选信息", "省级或国家级人才计划", "人才计划入选信息"],
  },
  research_direction: {
    fieldKey: "research_direction",
    label: "Research Direction",
    type: "textarea",
    required: false,
    aliases: ["研究方向", "Research Area", "Research Areas", "Research Area(s)"],
  },
  profile_summary: {
    fieldKey: "profile_summary",
    label: "Personal Summary",
    type: "textarea",
    required: false,
    aliases: ["个人简述", "基本情况"],
  },
};

const SOURCE_NAME_TO_FIELD_KEY = new Map<string, string>();

for (const [fieldKey, config] of Object.entries(MISSING_FIELD_REGISTRY)) {
  const aliases = [config.label, ...(config.aliases ?? [])];

  for (const alias of aliases) {
    SOURCE_NAME_TO_FIELD_KEY.set(normalizeSourceItemName(alias), fieldKey);
  }
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeSourceItemName(sourceItemName: string) {
  return collapseWhitespace(sourceItemName);
}

export function resolveMissingField(sourceItemName: string): MissingField {
  const normalized = normalizeSourceItemName(sourceItemName);
  const fieldKey = SOURCE_NAME_TO_FIELD_KEY.get(normalized);

  if (!fieldKey) {
    return {
      fieldKey: normalized
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "_")
        .replace(/^_+|_+$/g, "") || "additional_info",
      label: normalized,
      type: "text",
      required: true,
      helpText: "Please provide the requested information.",
      sourceItemName: normalized,
    };
  }

  const config = MISSING_FIELD_REGISTRY[fieldKey];

  return {
    fieldKey: config.fieldKey,
    label: config.label,
    type: config.type,
    required: config.required,
    helpText: config.helpText,
    options: config.options,
    defaultValue: config.defaultValue,
    selectOtherDetails: config.selectOtherDetails,
    sourceItemName: normalized,
  };
}

export function buildMissingFieldsFromItemNames(sourceItemNames: string[]) {
  const seen = new Set<string>();
  const missingFields: MissingField[] = [];

  for (const itemName of sourceItemNames) {
    const normalized = normalizeSourceItemName(itemName);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    missingFields.push(resolveMissingField(normalized));
  }

  return missingFields;
}

export function buildSupplementalFieldPayload(
  fields: Record<string, unknown>,
  missingFields: MissingField[],
) {
  const fieldMeta = Object.fromEntries(
    missingFields.map((field) => [
      field.fieldKey,
      {
        label: field.label,
        type: field.type,
        required: field.required,
        sourceItemName: field.sourceItemName,
      },
    ]),
  );
  const valuesByFieldKey = { ...fields };
  const valuesBySourceItemName: Record<string, unknown> = {};

  for (const [fieldKey, value] of Object.entries(fields)) {
    const meta = missingFields.find((field) => field.fieldKey === fieldKey);
    const sourceItemName = meta?.sourceItemName ?? fieldKey;
    valuesBySourceItemName[sourceItemName] = value;
  }

  return {
    valuesByFieldKey,
    valuesBySourceItemName,
    fieldMeta,
  };
}
