import type { MissingField } from "@/features/analysis/types";
import type { EligibilityResult } from "@/features/application/types";
import {
  buildMissingFieldsFromItemNames,
  normalizeSourceItemName,
} from "@/lib/resume-analysis/missing-field-registry";

type ParsedDecision = {
  eligibilityResult: EligibilityResult;
  displaySummary: string | null;
  reasonText: string | null;
  missingFields: MissingField[];
  extractedFields: Record<string, unknown>;
  rawReasoning: string | null;
};

/** Formal verdict sentence inside `{{{ }}}` (English prompt). */
const ELIGIBLE_SENTENCE_EN =
  "After evaluation, your qualifications meet the basic application requirements of this talent program";

/** Distinctive prefix inside `{{{ }}}` for ineligible (English prompt). */
const INELIGIBLE_MARKER_EN =
  "We regret to inform you that your qualifications do not meet the basic application requirements of this talent program";

/** Legacy Chinese prompt (still accepted when upstream returns older text). */
const ELIGIBLE_SENTENCE_CN = "经过判断，您的资历符合本次人才项目的基本申请要求";
const INELIGIBLE_SENTENCE_CN =
  "很遗憾，您的资历不符合本次人才项目的基本申请要求";

const ELIGIBLE_SUMMARY_EN =
  "Your profile meets the basic application requirements for this talent program.";
const INELIGIBLE_SUMMARY_EN =
  "Your profile does not currently meet the basic application requirements for this talent program.";
const INSUFFICIENT_INFO_SUMMARY_EN =
  "The system cannot make a final eligibility decision yet. Please provide the missing information below.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractFirstBlock(text: string, open: string, close: string) {
  const start = text.indexOf(open);

  if (start < 0) {
    return null;
  }

  const end = text.indexOf(close, start + open.length);

  if (end < 0) {
    return null;
  }

  return text.slice(start + open.length, end).trim();
}

function extractMissingItemNames(text: string) {
  const matches = text.matchAll(/!!!\s*([^!\r\n][^!]*)\s*!!!/g);
  const items: string[] = [];

  for (const match of matches) {
    const itemName = normalizeSourceItemName(match[1] ?? "");

    if (itemName) {
      items.push(itemName);
    }
  }

  return items;
}

function extractIneligibleReason(formalResult: string) {
  const trimmed = formalResult.trim();

  const enFollowUp =
    ". If you have any questions, please feel free to contact us at any time by email, WeChat, phone, or WhatsApp";
  const enParts = trimmed.split(enFollowUp);

  if (enParts.length > 1) {
    const beforeFollowUp = enParts[0] ?? "";
    const enReasonLabel = "The specific reasons are:";
    const idx = beforeFollowUp.toLowerCase().indexOf(enReasonLabel.toLowerCase());

    if (idx >= 0) {
      const rawReason = beforeFollowUp.slice(idx + enReasonLabel.length).trim();
      const reason = rawReason.replace(/\.$/, "").trim();

      if (reason) {
        return reason;
      }
    }
  }

  const cnMatch = trimmed.match(/以下是具体原因[:：]\s*([\s\S]*?)(?:，若您有疑问|$)/);
  const reason = cnMatch?.[1]?.trim() || trimmed;

  return reason
    .replace(
      /^当前学历与代表性成果未达到申报要求。?$/,
      "Your current academic qualifications and representative achievements do not meet the application requirements.",
    )
    .replace(
      /^当前学历与代表性成果未达到申报要求，?$/,
      "Your current academic qualifications and representative achievements do not meet the application requirements.",
    );
}

function filterExtractedFields(record: Record<string, unknown>) {
  const ignoredKeys = new Set([
    "eligibility_result",
    "eligibilityResult",
    "reason_text",
    "reasonText",
    "display_summary",
    "displaySummary",
    "missing_fields",
    "missingFields",
    "raw_response",
    "rawResponse",
    "raw_reasoning",
    "rawReasoning",
    "text",
    "content",
    "message",
    "status",
    "error_message",
    "errorMessage",
  ]);

  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !ignoredKeys.has(key)),
  );
}

function coerceExtractedFields(payload: Record<string, unknown>) {
  if (isRecord(payload.extracted_fields)) {
    return payload.extracted_fields;
  }

  if (isRecord(payload.extractedFields)) {
    return payload.extractedFields;
  }

  if (isRecord(payload.fields)) {
    return payload.fields;
  }

  const filtered = filterExtractedFields(payload);

  return Object.keys(filtered).length > 0 ? filtered : {};
}

function buildDecisionFromText(
  text: string,
  extractedFields: Record<string, unknown>,
) {
  const rawReasoning = extractFirstBlock(text, "[[[", "]]]");
  const formalResult = extractFirstBlock(text, "{{{", "}}}");
  const missingFieldNames = extractMissingItemNames(text);

  if (missingFieldNames.length > 0) {
    return {
      eligibilityResult: "INSUFFICIENT_INFO" as const,
      displaySummary: INSUFFICIENT_INFO_SUMMARY_EN,
      reasonText: null,
      missingFields: buildMissingFieldsFromItemNames(missingFieldNames),
      extractedFields,
      rawReasoning,
    };
  }

  const eligible =
    formalResult?.includes(ELIGIBLE_SENTENCE_EN) ||
    formalResult?.includes(ELIGIBLE_SENTENCE_CN);

  if (eligible) {
    return {
      eligibilityResult: "ELIGIBLE" as const,
      displaySummary: ELIGIBLE_SUMMARY_EN,
      reasonText: null,
      missingFields: [],
      extractedFields,
      rawReasoning,
    };
  }

  const ineligible =
    formalResult?.includes(INELIGIBLE_MARKER_EN) ||
    formalResult?.includes(INELIGIBLE_SENTENCE_CN);

  if (ineligible) {
    return {
      eligibilityResult: "INELIGIBLE" as const,
      displaySummary: INELIGIBLE_SUMMARY_EN,
      reasonText: extractIneligibleReason(formalResult),
      missingFields: [],
      extractedFields,
      rawReasoning,
    };
  }

  throw new Error("Unrecognized first-pass analysis result format.");
}

function normalizeTextPayload(payload: Record<string, unknown>) {
  if (typeof payload.text === "string") {
    return payload.text.trim();
  }

  if (typeof payload.content === "string") {
    return payload.content.trim();
  }

  if (typeof payload.raw_response === "string") {
    return payload.raw_response.trim();
  }

  if (typeof payload.rawResponse === "string") {
    return payload.rawResponse.trim();
  }

  return null;
}

function normalizeMissingFieldsFromPayload(payload: Record<string, unknown>) {
  const rawMissingFields = payload.missing_fields ?? payload.missingFields;

  if (!Array.isArray(rawMissingFields)) {
    return [];
  }

  const sourceItemNames = rawMissingFields.flatMap((item) => {
    if (typeof item === "string") {
      return [item];
    }

    if (!isRecord(item)) {
      return [];
    }

    const sourceItemName =
      typeof item.sourceItemName === "string"
        ? item.sourceItemName
        : typeof item.field_key === "string"
          ? item.field_key
          : typeof item.fieldKey === "string"
            ? item.fieldKey
            : typeof item.label === "string"
              ? item.label
              : null;

    return sourceItemName ? [sourceItemName] : [];
  });

  return buildMissingFieldsFromItemNames(sourceItemNames);
}

export function normalizeAnalysisResultPayload(payload: unknown): ParsedDecision {
  if (!isRecord(payload)) {
    throw new Error("Resume analysis payload must be an object.");
  }

  if (
    typeof payload.eligibilityResult === "string" &&
    typeof payload.displaySummary !== "undefined"
  ) {
    const normalizedMissingFields = Array.isArray(payload.missingFields)
      ? (payload.missingFields as MissingField[]).map((field) => ({
          ...field,
          sourceItemName:
            field.sourceItemName || field.label || field.fieldKey,
        }))
      : [];

    return {
      eligibilityResult: payload.eligibilityResult as EligibilityResult,
      displaySummary:
        typeof payload.displaySummary === "string" ? payload.displaySummary : null,
      reasonText: typeof payload.reasonText === "string" ? payload.reasonText : null,
      missingFields: normalizedMissingFields,
      extractedFields: isRecord(payload.extractedFields)
        ? payload.extractedFields
        : {},
      rawReasoning:
        typeof payload.rawReasoning === "string" ? payload.rawReasoning : null,
    };
  }

  const parsedResult = isRecord(payload.parsed_result)
    ? payload.parsed_result
    : isRecord(payload.parsedResult)
      ? payload.parsedResult
      : null;
  const baseRecord = parsedResult ?? payload;
  const extractedFields = coerceExtractedFields(baseRecord);
  const normalizedText = normalizeTextPayload(baseRecord) ?? normalizeTextPayload(payload);

  if (normalizedText) {
    return buildDecisionFromText(normalizedText, extractedFields);
  }

  const missingFields = normalizeMissingFieldsFromPayload(baseRecord);
  const eligibilityValue = baseRecord.eligibility_result ?? baseRecord.eligibilityResult;

  if (typeof eligibilityValue === "string") {
    return {
      eligibilityResult: eligibilityValue as EligibilityResult,
      displaySummary:
        typeof (baseRecord.display_summary ?? baseRecord.displaySummary) === "string"
          ? ((baseRecord.display_summary ?? baseRecord.displaySummary) as string)
          : null,
      reasonText:
        typeof (baseRecord.reason_text ?? baseRecord.reasonText) === "string"
          ? ((baseRecord.reason_text ?? baseRecord.reasonText) as string)
          : null,
      missingFields,
      extractedFields,
      rawReasoning:
        typeof (baseRecord.raw_reasoning ?? baseRecord.rawReasoning) === "string"
          ? ((baseRecord.raw_reasoning ?? baseRecord.rawReasoning) as string)
          : null,
    };
  }

  throw new Error("Resume analysis result is missing both text payload and structured fields.");
}
