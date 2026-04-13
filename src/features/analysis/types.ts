export type EligibilityResult =
  | "UNKNOWN"
  | "INSUFFICIENT_INFO"
  | "ELIGIBLE"
  | "INELIGIBLE";

export type SelectOtherDetails = {
  triggerOption: string;
  detailFieldKey: string;
  detailLabel: string;
  detailPlaceholder?: string;
};

export type MissingField = {
  fieldKey: string;
  sourceItemName: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "radio";
  required: boolean;
  helpText?: string;
  options?: string[];
  defaultValue?: string;
  selectOtherDetails?: SelectOtherDetails;
};

export type StructuredFieldInputType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "radio";

export type SecondaryFieldDefinition = {
  no: number;
  fieldKey: string;
  column: string | null;
  label: string;
  inputType: StructuredFieldInputType;
  required: boolean;
  options?: string[];
  helpText?: string;
  placeholder?: string;
  expertVisible: boolean;
};

export type EditableSecondaryField = SecondaryFieldDefinition & {
  sourceValue: string;
  editedValue: string;
  effectiveValue: string;
  hasOverride: boolean;
  isMissing: boolean;
  isEdited: boolean;
  savedAt: string | null;
};
