import { EXTRACTED_FIELD_DEFINITIONS } from "@/features/analysis/display";
import type {
  EditableSecondaryField,
  SecondaryFieldDefinition,
  StructuredFieldInputType,
} from "@/features/analysis/types";

type SecondaryFieldConfig = {
  inputType?: StructuredFieldInputType;
  required?: boolean;
  options?: string[];
  helpText?: string;
  placeholder?: string;
  expertVisible?: boolean;
};

const SECONDARY_NO_TO_COLUMN: Record<number, string> = {
  1: "K",
  2: "L",
  3: "M",
  4: "N",
  5: "O",
  6: "P",
  7: "Q",
  8: "R",
  9: "S",
  10: "T",
  11: "U",
  12: "V",
  13: "W",
  14: "X",
  15: "Y",
  16: "Z",
  17: "AA",
  18: "AB",
  19: "AC",
  20: "AD",
  21: "AE",
  22: "AF",
  23: "AG",
  24: "AH",
  25: "AI",
  26: "AJ",
  27: "AN",
  28: "AL",
  29: "AM",
  30: "AO",
  31: "AP",
  32: "AQ",
  33: "AR",
  34: "AS",
  35: "AT",
  36: "AU",
  37: "AV",
  38: "AW",
  39: "AX",
  40: "AY",
  41: "AK",
};

const LABELS_BY_NO = new Map(
  EXTRACTED_FIELD_DEFINITIONS.map((definition) => [definition.no, definition.label]),
);

const SECONDARY_FIELD_CONFIGS: Record<number, SecondaryFieldConfig> = {
  1: {
    required: true,
    placeholder: "Enter the expert's full legal name.",
  },
  2: {
    inputType: "select",
    options: ["Female", "Male", "Other"],
    placeholder: "Select a gender if known.",
  },
  3: {
    inputType: "date",
    required: true,
    helpText: "Leave this blank if the date is unavailable.",
  },
  4: {
    placeholder: "Enter the nationality or ethnic group.",
  },
  5: {
    placeholder: "Enter the country of birth.",
  },
  6: {
    required: true,
    placeholder: "Enter the current source country or region.",
  },
  7: {
    inputType: "radio",
    options: ["Yes", "No"],
    placeholder: "Select whether the expert is ethnic Chinese.",
  },
  8: {
    expertVisible: false,
    placeholder: "Enter the document type.",
  },
  9: {
    expertVisible: false,
    placeholder: "Enter the document number.",
  },
  10: {
    expertVisible: false,
    inputType: "date",
    placeholder: "Select the document expiration date.",
  },
  11: {
    expertVisible: false,
    placeholder: "Enter any additional contact details.",
  },
  12: {
    inputType: "text",
    placeholder: "Enter the personal email address.",
  },
  13: {
    inputType: "text",
    placeholder: "Enter the work email address.",
  },
  14: {
    inputType: "text",
    placeholder: "Enter the mobile phone number.",
  },
  15: {
    inputType: "select",
    required: true,
    options: ["Bachelor's", "Master's", "Doctorate", "Other"],
    placeholder: "Select the highest completed degree.",
  },
  16: {
    inputType: "date",
    placeholder: "Select the doctoral graduation date.",
  },
  17: {
    placeholder: "Enter the doctoral graduation country.",
  },
  18: {
    expertVisible: false,
    placeholder: "Enter the doctoral institution name in Chinese.",
  },
  19: {
    placeholder: "Enter the doctoral institution name in English.",
  },
  20: {
    placeholder: "Enter the doctoral major.",
  },
  21: {
    inputType: "number",
    placeholder: "Enter the doctoral institution QS ranking.",
  },
  22: {
    placeholder: "Enter the current title.",
  },
  23: {
    placeholder: "Enter the current title in English.",
  },
  24: {
    expertVisible: false,
    placeholder: "Enter the current employer in Chinese.",
  },
  25: {
    placeholder: "Enter the current employer in English.",
  },
  26: {
    inputType: "number",
    placeholder: "Enter the current employer QS ranking.",
  },
  27: {
    placeholder: "Enter representative honors or titles.",
  },
  28: {
    expertVisible: false,
    inputType: "textarea",
    placeholder: "Record any competition-related information.",
  },
  29: {
    inputType: "textarea",
    placeholder: "Describe any provincial or national talent program selection.",
  },
  30: {
    expertVisible: false,
    inputType: "textarea",
    placeholder: "Add any internal notes.",
  },
  31: {
    expertVisible: false,
    inputType: "textarea",
    placeholder: "Add any important communication records.",
  },
  32: {
    inputType: "textarea",
    placeholder: "Summarize the research direction.",
  },
  33: {
    inputType: "textarea",
    placeholder: "Summarize the education and work experience.",
  },
  34: {
    expertVisible: false,
    inputType: "textarea",
    placeholder: "Summarize the applicant background.",
  },
  35: {
    inputType: "textarea",
    placeholder: "Write a concise personal summary.",
  },
  36: {
    inputType: "textarea",
    placeholder: "List the relevant project experience.",
  },
  37: {
    inputType: "textarea",
    placeholder: "List the publications.",
  },
  38: {
    inputType: "textarea",
    placeholder: "List top-tier journal details if applicable.",
  },
  39: {
    inputType: "textarea",
    placeholder: "List patents.",
  },
  40: {
    inputType: "textarea",
    placeholder: "List awards, honors, and other achievements.",
  },
  41: {
    inputType: "textarea",
    placeholder: "Describe the Chinese language ability.",
  },
};

const FALLBACK_LABELS: Record<number, string> = {
  8: "Document Type",
  9: "Document Number",
  10: "Document Expiration Date",
  11: "Additional Contact Details",
  28: "Competition Information",
  30: "Notes",
  31: "Important Communication Records",
  34: "Applicant Background",
};

function buildFieldKey(no: number) {
  return `secondary_field_${String(no).padStart(2, "0")}`;
}

function buildDefinition(no: number): SecondaryFieldDefinition {
  const config = SECONDARY_FIELD_CONFIGS[no] ?? {};

  return {
    no,
    fieldKey: buildFieldKey(no),
    column: SECONDARY_NO_TO_COLUMN[no] ?? null,
    label: LABELS_BY_NO.get(no) ?? FALLBACK_LABELS[no] ?? `NO.${no}`,
    inputType: config.inputType ?? "text",
    required: config.required ?? false,
    options: config.options,
    helpText: config.helpText,
    placeholder: config.placeholder,
    expertVisible: config.expertVisible ?? true,
  };
}

export const ALL_SECONDARY_FIELD_DEFINITIONS = Array.from(
  { length: 41 },
  (_, index) => buildDefinition(index + 1),
);

export const SECONDARY_FIELD_DEFINITIONS = ALL_SECONDARY_FIELD_DEFINITIONS.filter(
  (definition) => definition.expertVisible,
);

export function getSecondaryFieldDefinition(no: number) {
  return SECONDARY_FIELD_DEFINITIONS.find((definition) => definition.no === no) ?? null;
}

export function buildEditableSecondaryField(
  definition: SecondaryFieldDefinition,
  input: {
    sourceValue: string;
    editedValue: string;
    effectiveValue: string;
    hasOverride: boolean;
    isMissing: boolean;
    isEdited: boolean;
    savedAt: string | null;
  },
): EditableSecondaryField {
  return {
    ...definition,
    sourceValue: input.sourceValue,
    editedValue: input.editedValue,
    effectiveValue: input.effectiveValue,
    hasOverride: input.hasOverride,
    isMissing: input.isMissing,
    isEdited: input.isEdited,
    savedAt: input.savedAt,
  };
}
