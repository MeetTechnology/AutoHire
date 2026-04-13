export type EligibilityResult =
  | "UNKNOWN"
  | "INSUFFICIENT_INFO"
  | "ELIGIBLE"
  | "INELIGIBLE";

export type MissingField = {
  fieldKey: string;
  sourceItemName: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "radio";
  required: boolean;
  helpText?: string;
  options?: string[];
  defaultValue?: string;
};
