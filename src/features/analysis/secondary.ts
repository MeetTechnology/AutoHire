import {
  getVisibleExtractedFieldDefinitions,
  normalizeDisplayValue,
  translateVisibleFieldValue,
} from "@/features/analysis/display";
import { SECONDARY_FIELD_DEFINITIONS } from "@/features/analysis/secondary-fields";

export type SecondaryVisibleField = {
  no: number;
  column: string | null;
  label: string;
  value: string;
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

const SECONDARY_LABELS = new Map(
  getVisibleExtractedFieldDefinitions().map((definition) => [definition.no, definition.label]),
);

function normalizeSecondaryText(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return "";
  }

  const unwrapped =
    trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1)
      : trimmed;

  return unwrapped.replace(/\r\n/g, "\n").trim();
}

function cleanSecondarySegment(segment: string) {
  const beforeSentinel = segment.split("井井井", 1)[0] ?? segment;
  const normalized = beforeSentinel
    .replace(/\^\^\^/g, "\n")
    .replace(/###\s*$/g, "")
    .trim();

  return normalizeDisplayValue(normalized);
}

function parseSecondaryValuesByNo(texts: string[]) {
  const normalizedTexts = texts
    .map((text) => normalizeSecondaryText(text))
    .filter(Boolean);

  if (normalizedTexts.length === 0) {
    return new Map<number, string>();
  }

  const mergedText = normalizedTexts.join("\n");
  const pattern = /NO\.(\d+)\s*###/g;
  const matches = [...mergedText.matchAll(pattern)];
  const valuesByNo = new Map<number, string>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const no = Number.parseInt(match[1] ?? "", 10);

    if (!Number.isFinite(no) || !SECONDARY_LABELS.has(no)) {
      continue;
    }

    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? mergedText.length)
        : mergedText.length;
    const value = cleanSecondarySegment(mergedText.slice(start, end));
    const previous = valuesByNo.get(no);

    if (!previous) {
      valuesByNo.set(no, value);
      continue;
    }

    if (!value || previous === value) {
      continue;
    }

    valuesByNo.set(no, `${previous}\n\n${value}`);
  }

  return valuesByNo;
}

export function parseSecondaryFieldSourceValues(texts: string[]) {
  return parseSecondaryValuesByNo(texts);
}

export function parseSecondaryVisibleFields(texts: string[]) {
  const valuesByNo = parseSecondaryValuesByNo(texts);

  if (valuesByNo.size === 0) {
    return [] satisfies SecondaryVisibleField[];
  }

  return [...valuesByNo.entries()]
    .sort(([leftNo], [rightNo]) => leftNo - rightNo)
    .filter(([no, value]) => {
      if (!value) {
        return false;
      }

      return SECONDARY_FIELD_DEFINITIONS.some(
        (definition) => definition.no === no && definition.expertVisible,
      );
    })
    .map(([no, value]) => ({
      no,
      column: SECONDARY_NO_TO_COLUMN[no] ?? null,
      label: SECONDARY_LABELS.get(no) ?? `NO.${no}`,
      value: translateVisibleFieldValue(no, value),
    }));
}
